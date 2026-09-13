"use client";

import {
  DEITIES,
  DEITY_META,
  GIFTS,
  cardDeities,
  formatDeityList,
  legalGiftDeities,
  legalSacrificeCards,
  type GameAction,
  type PrivateView,
  type PublicGameState,
  type PublicPlayer,
} from "@/game";
import { ManuscriptTile } from "./ManuscriptTile";
import { PlayerAvatar } from "./PlayerAvatar";

export function ActionDock({
  game,
  actor,
  privateView,
  selectedCardId,
  selectedPile,
  onAct,
}: {
  game: PublicGameState;
  actor: PublicPlayer | null;
  privateView: PrivateView;
  selectedCardId: string | null;
  selectedPile: number | null;
  onAct: (action: GameAction) => void | Promise<void>;
}) {
  if (!actor) {
    return (
      <div className="text-sm text-[#9a917c]">
        Watching the circle.
      </div>
    );
  }

  const pending = game.pending;
  const youAct =
    (!pending && game.currentPlayerId === actor.id) ||
    pending?.actorPlayerId === actor.id ||
    pending?.targetPlayerId === actor.id ||
    (game.phase === "setup" && actor.setupHand.length > 0);

  if (game.phase === "setup") {
    const card = actor.setupHand[0];
    if (!card) {
      return (
        <p className="text-sm text-[#9a917c]">
          Waiting for the others to seat their first pages.
        </p>
      );
    }
    const options = cardDeities(card.cardId);
    return (
      <div>
        <p className="mb-2 text-[0.7rem] uppercase tracking-[0.2em] text-[#c9a227]">
          File opening pages onto a matching color
        </p>
        <div className="flex flex-wrap gap-2">
          {options.map((deity) => (
            <button
              key={deity}
              type="button"
              className="min-h-10 rounded-sm px-3 py-2 text-sm active:brightness-90"
              style={{ background: DEITY_META[deity].color, color: DEITY_META[deity].ink }}
              onClick={() =>
                onAct({
                  type: "setup_assign",
                  instanceId: card.instanceId,
                  deity,
                })
              }
            >
              {DEITY_META[deity].short}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!youAct) {
    const current = game.players.find((p) => p.id === game.currentPlayerId);
    return (
      <div className="text-sm text-[#9a917c]">
        {current?.displayName ?? "Another researcher"} is acting.
      </div>
    );
  }

  if (game.phase === "apply_desecration") {
    return (
      <Prompt>
        Place the desecration token on a card you just gained.
        {selectedCardId ? (
          <DockButton onClick={() => onAct({ type: "apply_desecration", instanceId: selectedCardId })}>
            Mark selected omen
          </DockButton>
        ) : (
          <Hint>Select a gained omen card.</Hint>
        )}
      </Prompt>
    );
  }

  if (game.phase === "choose_overflow" || pending?.kind === "overflow") {
    const sane = DEITIES.filter((deity) => !actor.mad[deity]);
    const wentMad = pending?.newlyMad ?? [];
    return (
      <Prompt>
        {wentMad.length > 0 ? (
          <p className="text-[#e6dcc4]">
            You went mad in {formatDeityList(wentMad)}.
          </p>
        ) : null}
        Overflowing blessing — go mad in another color.
        <div className="mt-3 flex flex-wrap gap-2">
          {sane.map((deity) => (
            <DockButton
              key={deity}
              onClick={() => onAct({ type: "choose_overflow", deity })}
            >
              {DEITY_META[deity].short}
            </DockButton>
          ))}
        </div>
      </Prompt>
    );
  }

  if (game.phase === "assign_journal" || pending?.kind === "assign_journal" || pending?.kind === "dark_young_assign") {
    const card = actor.omen.find((omenCard) => !omenCard.assignedDeity) ?? actor.omen[0];
    if (!card) {
      return <Hint>Assigning pages…</Hint>;
    }
    const wentMad = pending?.reason === "madness" ? pending.newlyMad ?? [] : [];
    return (
      <Prompt>
        {wentMad.length > 0 ? (
          <p className="text-[#e6dcc4]">
            You went mad in {formatDeityList(wentMad)}. File your omen pages.
          </p>
        ) : pending?.reason === "madness" ? (
          <p className="text-[#e6dcc4]">You went mad. File your omen pages.</p>
        ) : null}
        Drag this page onto a matching color, or tap a color here.
        <div className="flex flex-wrap gap-2">
          {cardDeities(card.cardId).map((deity) => (
            <DockButton
              key={deity}
              onClick={() =>
                onAct({
                  type: "assign_journal",
                  instanceId: card.instanceId,
                  deity,
                })
              }
            >
              {DEITY_META[deity].short}
            </DockButton>
          ))}
        </div>
      </Prompt>
    );
  }

  if (game.phase === "activate_gift") {
    const sourceIds =
      pending?.kind === "mind_control_gift" && pending.activatedInstanceId
        ? [pending.activatedInstanceId]
        : game.gainedThisSacrifice;
    const legal = new Set(legalGiftDeities(game, actor));
    const deities = DEITIES.filter(
      (deity) =>
        legal.has(deity) &&
        actor.omen.some(
          (card) =>
            sourceIds.includes(card.instanceId) &&
            cardDeities(card.cardId).includes(deity),
        ),
    );
    if (deities.length === 0) {
      return (
        <Prompt>
          None of the gifts on the cards you just drew can be used.
        </Prompt>
      );
    }
    return (
      <Prompt>
        Choose a power from a color you just drew.
        <div className="flex flex-wrap gap-2">
          {deities.map((deity) => {
            const blessed = actor.mad[deity];
            const gift = blessed ? GIFTS[deity].blessed : GIFTS[deity].gift;
            const meta = DEITY_META[deity];
            return (
              <button
                key={deity}
                type="button"
                title={gift.text}
                onClick={() => onAct({ type: "activate_gift", deity })}
                className="min-h-10 max-w-[16rem] rounded-sm px-3 py-2 text-left text-sm active:brightness-90"
                style={{ background: meta.color, color: meta.ink }}
              >
                <span className="block text-[0.65rem] uppercase tracking-wider opacity-80">
                  {meta.short}
                  {blessed ? " · blessed" : ""}
                </span>
                {gift.name}
              </button>
            );
          })}
        </div>
      </Prompt>
    );
  }

  if (pending?.kind === "telepathy") {
    return (
      <Prompt>
        Telepathy: tap a sealed (face-down) deck on the star to look at its top.
        <Hint>The burned face-up deck cannot be peeked.</Hint>
        {privateView.peekedCards?.length ? <PeekCards view={privateView} /> : null}
      </Prompt>
    );
  }

  if (pending?.kind === "memory_pick") {
    return (
      <Prompt>
        Memory Distortion: tap two sealed decks.
        {selectedPile != null ? (
          <Hint>First deck chosen. Tap a second sealed deck.</Hint>
        ) : (
          <Hint>Tap the first sealed deck.</Hint>
        )}
      </Prompt>
    );
  }

  if (pending?.kind === "memory_place") {
    return (
      <Prompt>
        Place both peeked cards face-down, one on each chosen deck.
        <PeekCards view={privateView} />
        <MemoryPlace pendingPiles={pending.pileIndexes ?? []} view={privateView} onAct={onAct} />
      </Prompt>
    );
  }

  if (pending?.kind === "cover") {
    return (
      <Prompt>
        Cover the other card you just drew. It will not count toward madness.
        <Hint>Tap the other Drawn omen in your omen zone.</Hint>
      </Prompt>
    );
  }

  if (pending?.kind === "unfair_target" || pending?.kind === "whisper_take") {
    return (
      <Prompt>
        {pending.kind === "whisper_take"
          ? "Take one journal card from another researcher."
          : "Choose a researcher to trade with."}
        <div className="flex flex-wrap gap-2">
          {game.players
            .filter((p) => p.id !== actor.id)
            .map((p) =>
              pending.kind === "whisper_take" ? (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-2 rounded-sm border border-[#3a3324] px-3 py-2 text-sm text-[#9a917c]"
                >
                  <PlayerAvatar name={p.displayName} src={p.avatarUrl} size="sm" />
                  {p.displayName}
                </span>
              ) : (
                <DockButton
                  key={p.id}
                  onClick={() => onAct({ type: "gift_unfair_target", playerId: p.id })}
                >
                  <span className="inline-flex items-center gap-2">
                    <PlayerAvatar name={p.displayName} src={p.avatarUrl} size="sm" />
                    {p.displayName}
                  </span>
                </DockButton>
              ),
            )}
        </div>
        {pending.kind === "whisper_take" ? (
          <Hint>Open their journal, select a card, then confirm below.</Hint>
        ) : null}
        {pending.kind === "whisper_take" && selectedCardId ? (
          <WhisperTake players={game.players} actorId={actor.id} selectedCardId={selectedCardId} onAct={onAct} />
        ) : null}
      </Prompt>
    );
  }

  if (pending?.kind === "unfair_victim_give" && pending.targetPlayerId === actor.id) {
    return (
      <Prompt>
        Give one journal card to the demanding researcher.
        {selectedCardId ? (
          <DockButton onClick={() => onAct({ type: "gift_give_card", instanceId: selectedCardId })}>
            Give selected page
          </DockButton>
        ) : (
          <Hint>Select a card in your journal.</Hint>
        )}
      </Prompt>
    );
  }

  if (
    (pending?.kind === "unfair_actor_give" || pending?.kind === "whisper_give") &&
    pending.actorPlayerId === actor.id
  ) {
    return (
      <Prompt>
        Give them one page from your journal.
        {selectedCardId ? (
          <DockButton onClick={() => onAct({ type: "gift_give_card", instanceId: selectedCardId })}>
            Give selected page
          </DockButton>
        ) : (
          <Hint>Select a card in your journal.</Hint>
        )}
      </Prompt>
    );
  }

  if (pending?.kind === "defile") {
    return (
      <Prompt>
        Mark another researcher with a desecration token.
        <div className="mt-3 flex flex-wrap gap-2">
          {game.players
            .filter((p) => p.id !== actor.id && !p.hasDesecration)
            .map((p) => (
              <DockButton
                key={p.id}
                onClick={() => onAct({ type: "gift_defile", playerId: p.id })}
              >
                <span className="inline-flex items-center gap-2">
                  <PlayerAvatar name={p.displayName} src={p.avatarUrl} size="sm" />
                  {p.displayName}
                </span>
              </DockButton>
            ))}
        </div>
        {game.players.every((p) => p.id === actor.id || p.hasDesecration) ? (
          <Hint>Every other researcher already holds a desecration token.</Hint>
        ) : null}
      </Prompt>
    );
  }

  if (pending?.kind === "brooding" || pending?.kind === "dark_young") {
    return (
      <Prompt>
        {pending.kind === "brooding" ? "Brooding" : "Dark Young"}: tap a sealed deck to draw its top.
        <Hint>Face-up decks cannot be drawn.</Hint>
      </Prompt>
    );
  }

  if (game.phase === "waiting_sacrifice" || game.phase === "choose_continue") {
    const legal = legalSacrificeCards(actor);
    return (
      <Prompt>
        {game.phase === "choose_continue"
          ? "Sacrifice again, or close the journal."
          : "Drag a journal page onto a non-empty deck. The two opposite tops move to your omen zone."}
        {privateView.peekedCards?.length ? <PeekCards view={privateView} /> : null}
        {game.phase === "choose_continue" ? (
          <DockButton onClick={() => onAct({ type: "stop" })}>Stop</DockButton>
        ) : null}
        {selectedCardId && selectedPile != null ? (
          <DockButton
            onClick={() =>
              onAct({
                type: "sacrifice",
                instanceId: selectedCardId,
                pileIndex: selectedPile,
              })
            }
          >
            Sacrifice onto pile {selectedPile + 1}
          </DockButton>
        ) : (
          <Hint>
            {legal.length === 0
              ? "No legal pages remain."
              : "Drag a legal journal card onto a deck, or select both then confirm."}
          </Hint>
        )}
      </Prompt>
    );
  }

  return (
    <div className="text-sm text-[#9a917c]">
      The star waits.
      {privateView.peekedCards?.length ? <PeekCards view={privateView} /> : null}
    </div>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#9a917c]">{children}</p>;
}

function DockButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="min-h-11 rounded-sm bg-[#c9a227] px-4 py-2.5 text-sm font-medium tracking-wide text-[#14110b] active:brightness-90 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function PeekCards({ view }: { view: PrivateView }) {
  if (!view.peekedCards?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {view.peekedCards.map((peek) => (
        <div key={peek.card.instanceId}>
          <p className="mb-1 text-[0.65rem] uppercase text-[#c9a227]">
            Pile {peek.pileIndex + 1}
          </p>
          <ManuscriptTile card={peek.card} />
        </div>
      ))}
    </div>
  );
}

function MemoryPlace({
  pendingPiles,
  view,
  onAct,
}: {
  pendingPiles: number[];
  view: PrivateView;
  onAct: (action: GameAction) => void;
}) {
  const cards = view.peekedCards ?? [];
  if (cards.length !== 2 || pendingPiles.length !== 2) {
    return <Hint>Waiting for the private vision of both cards…</Hint>;
  }
  const [a, b] = cards;
  const [p0, p1] = pendingPiles;
  if (!a || !b || p0 == null || p1 == null) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <DockButton
        onClick={() =>
          onAct({
            type: "gift_memory_place",
            placements: [
              { instanceId: a.card.instanceId, pileIndex: p0 },
              { instanceId: b.card.instanceId, pileIndex: p1 },
            ],
          })
        }
      >
        Keep original order
      </DockButton>
      <DockButton
        onClick={() =>
          onAct({
            type: "gift_memory_place",
            placements: [
              { instanceId: a.card.instanceId, pileIndex: p1 },
              { instanceId: b.card.instanceId, pileIndex: p0 },
            ],
          })
        }
      >
        Swap the two tops
      </DockButton>
    </div>
  );
}

function WhisperTake({
  players,
  actorId,
  selectedCardId,
  onAct,
}: {
  players: PublicPlayer[];
  actorId: string;
  selectedCardId: string;
  onAct: (action: GameAction) => void;
}) {
  const owner = players.find(
    (player) =>
      player.id !== actorId &&
      DEITIES.some((deity) =>
        player.journal[deity].some((card) => card.instanceId === selectedCardId),
      ),
  );
  if (!owner) return <Hint>Select a card from another researcher&apos;s journal.</Hint>;
  return (
    <DockButton
      onClick={() =>
        onAct({
          type: "gift_whisper_take",
          playerId: owner.id,
          instanceId: selectedCardId,
        })
      }
    >
      Take this page from {owner.displayName}
    </DockButton>
  );
}
