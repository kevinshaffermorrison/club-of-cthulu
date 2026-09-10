create extension if not exists pgcrypto with schema extensions;

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
    extensions.crypt(p_password, extensions.gen_salt('bf')),
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
  if v_room.password_hash <> extensions.crypt(p_password, v_room.password_hash) then
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
