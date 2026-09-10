-- Club of Cthulhu schema: public lobby/game rows, secret decks, RPCs.

create extension if not exists pgcrypto;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  password_hash text not null,
  scoring_deity text not null,
  max_players integer not null default 4 check (max_players between 2 and 4),
  host_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  seat_index integer not null check (seat_index >= 0 and seat_index <= 3),
  display_name text not null,
  controller_user_id uuid not null references auth.users (id) on delete cascade,
  is_ready boolean not null default false,
  created_at timestamptz not null default now(),
  unique (room_id, seat_index)
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.rooms (id) on delete cascade,
  public_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.game_secrets (
  game_id uuid primary key references public.games (id) on delete cascade,
  state jsonb not null
);

create table public.deck_cards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  pile_index integer not null check (pile_index between 0 and 4),
  position integer not null,
  card_id text not null
);

create index deck_cards_game_pile on public.deck_cards (game_id, pile_index, position);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_secrets enable row level security;
alter table public.deck_cards enable row level security;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players
    where room_id = p_room_id
      and controller_user_id = auth.uid()
  );
$$;

create policy "members read rooms"
  on public.rooms for select
  to authenticated
  using (public.is_room_member(id));

create policy "members read players"
  on public.players for select
  to authenticated
  using (public.is_room_member(room_id));

create policy "members read games"
  on public.games for select
  to authenticated
  using (public.is_room_member(room_id));

-- game_secrets and deck_cards: no client policies (service role only)

grant select on public.rooms, public.players, public.games to authenticated;
grant usage on schema public to authenticated, anon;

create or replace function public.create_room(
  p_password text,
  p_display_name text,
  p_scoring_deity text,
  p_max_players integer default 4
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_room public.rooms;
  v_player public.players;
begin
  if v_user is null then
    raise exception 'Sign in first';
  end if;
  if length(trim(p_display_name)) < 1 then
    raise exception 'Name required';
  end if;
  if length(p_password) < 4 then
    raise exception 'Password must be at least 4 characters';
  end if;
  if p_max_players < 2 or p_max_players > 4 then
    raise exception '2 to 4 researchers';
  end if;
  if p_scoring_deity not in (
    'kingInYellow', 'shubNiggurath', 'cthulhu', 'yidhra', 'nyarlathotep'
  ) then
    raise exception 'Unknown scoring card';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;

  insert into public.rooms (code, password_hash, scoring_deity, max_players, host_user_id)
  values (
    v_code,
    crypt(p_password, gen_salt('bf')),
    p_scoring_deity,
    p_max_players,
    v_user
  )
  returning * into v_room;

  insert into public.players (room_id, seat_index, display_name, controller_user_id)
  values (v_room.id, 0, trim(p_display_name), v_user)
  returning * into v_player;

  return jsonb_build_object(
    'room', to_jsonb(v_room) - 'password_hash',
    'player', to_jsonb(v_player)
  );
end;
$$;

create or replace function public.join_room(
  p_code text,
  p_password text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_player public.players;
  v_seat integer;
begin
  if v_user is null then
    raise exception 'Sign in first';
  end if;
  if length(trim(p_display_name)) < 1 then
    raise exception 'Name required';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(trim(p_code));

  if v_room.id is null then
    raise exception 'No circle with that code';
  end if;
  if v_room.password_hash <> crypt(p_password, v_room.password_hash) then
    raise exception 'Wrong password';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'This ritual has already begun';
  end if;

  select * into v_player
  from public.players
  where room_id = v_room.id
    and controller_user_id = v_user
  order by seat_index
  limit 1;

  if v_player.id is not null then
    return jsonb_build_object(
      'room', to_jsonb(v_room) - 'password_hash',
      'player', to_jsonb(v_player)
    );
  end if;

  select count(*)::int into v_seat from public.players where room_id = v_room.id;
  if v_seat >= v_room.max_players then
    raise exception 'The circle is full';
  end if;

  insert into public.players (room_id, seat_index, display_name, controller_user_id)
  values (v_room.id, v_seat, trim(p_display_name), v_user)
  returning * into v_player;

  return jsonb_build_object(
    'room', to_jsonb(v_room) - 'password_hash',
    'player', to_jsonb(v_player)
  );
end;
$$;

create or replace function public.add_local_seat(
  p_room_id uuid,
  p_display_name text
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_player public.players;
  v_seat integer;
begin
  if v_user is null then
    raise exception 'Sign in first';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if v_room.id is null then
    raise exception 'Unknown room';
  end if;
  if v_room.host_user_id <> v_user then
    raise exception 'Only the host can add local researchers';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'The ritual has already begun';
  end if;
  if length(trim(p_display_name)) < 1 then
    raise exception 'Name required';
  end if;

  select count(*)::int into v_seat from public.players where room_id = p_room_id;
  if v_seat >= v_room.max_players then
    raise exception 'The circle is full';
  end if;

  insert into public.players (room_id, seat_index, display_name, controller_user_id)
  values (p_room_id, v_seat, trim(p_display_name), v_user)
  returning * into v_player;

  return v_player;
end;
$$;

create or replace function public.set_ready(p_player_id uuid, p_ready boolean)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_player public.players;
begin
  select * into v_player from public.players where id = p_player_id;
  if v_player.id is null then
    raise exception 'Unknown seat';
  end if;
  if v_player.controller_user_id <> v_user then
    raise exception 'Not your seat';
  end if;

  update public.players
  set is_ready = p_ready
  where id = p_player_id
  returning * into v_player;

  return v_player;
end;
$$;

grant execute on function public.create_room(text, text, text, integer) to authenticated;
grant execute on function public.join_room(text, text, text) to authenticated;
grant execute on function public.add_local_seat(uuid, text) to authenticated;
grant execute on function public.set_ready(uuid, boolean) to authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;

alter table public.rooms replica identity full;
alter table public.players replica identity full;
alter table public.games replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.rooms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.players;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.games;
  exception when duplicate_object then null;
  end;
end $$;
