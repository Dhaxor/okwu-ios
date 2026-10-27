// What every flashcard screen reads: the bundle and the learner's cards,
// their decks (theirs and the course's), each card's view and recording,
// and Plus's path rule for unit decks (a unit deck opens exactly where the
// Learn path does: free units free, the rest with Plus, "full-path").
import { useCallback, useMemo } from "react";
import { useContent, useLearning, usePlus, useProfile } from "@/lib/state";
import { builtInDecks, cardView, deckCards, setFace as withFace, summarize, useDecks, userDeckView, type CardView, type DeckSummary, type DeckView, type StudyCard, type StudyFace } from "@/lib/tools";
import { useCardAudio } from "./ToolsParts";

export const DUE_DECK = "due";

export function useFlashcards() {
  const { bundle, status } = useContent();
  const learning = useLearning();
  const { profile } = useProfile();
  const decks = useDecks();
  const plus = usePlus();
  const audio = useCardAudio();
  const now = useMemo(() => new Date(), [learning.progress, learning.reviewLog]); // eslint-disable-line react-hooks/exhaustive-deps
  const track = profile.track || undefined;
  const face = decks.file.face;

  const cache = useMemo(() => new Map<string, CardView | null>(), [bundle, decks.file.words]); // eslint-disable-line react-hooks/exhaustive-deps
  const card = useCallback(
    (ref: string): CardView | null => {
      if (!bundle) return null;
      if (!cache.has(ref)) cache.set(ref, cardView(bundle, decks.file, ref));
      return cache.get(ref) ?? null;
    },
    [bundle, cache, decks.file]
  );
  const audible = useCallback(
    (ref: string) => {
      const c = card(ref);
      return !!c && audio.available(c);
    },
    [card, audio]
  );

  const builtIns = useMemo(
    () => (bundle ? builtInDecks(bundle, decks.file, learning.progress, learning.reviewLog, now, track) : []),
    [bundle, decks.file, learning.progress, learning.reviewLog, now, track]
  );
  const mine = useMemo(() => decks.file.decks.map(userDeckView), [decks.file.decks]);
  const locked = useCallback((d: DeckView) => d.kind === "unit" && !!d.unit && !plus.can("full-path", { unitFree: d.unit.free }), [plus]);

  /** Every card the learner may study now, across their decks and the open course decks (for "Study due cards"). */
  const dueDeck = useMemo<DeckView>(() => {
    const refs: string[] = [];
    for (const d of [...mine, ...builtIns]) if (!locked(d)) for (const r of d.refs) if (!refs.includes(r)) refs.push(r);
    return { id: DUE_DECK, kind: "user", name: "Due cards", detail: "From every deck", refs };
  }, [mine, builtIns, locked]);

  const cardsOf = useCallback(
    (d: DeckView, f: StudyFace = face): StudyCard[] =>
      bundle ? deckCards({ bundle, progress: learning.progress, scheduler: learning.scheduler, refs: d.refs.filter((r) => card(r)), face: f, now, audible }) : [],
    [bundle, learning.progress, learning.scheduler, now, card, audible, face]
  );
  const summaryOf = useCallback(
    (d: DeckView, f: StudyFace = face): DeckSummary => summarize(cardsOf(d, f), learning.progress, learning.scheduler, now),
    [cardsOf, learning.progress, learning.scheduler, now, face]
  );

  const findDeck = useCallback((id: string): DeckView | null => (id === DUE_DECK ? dueDeck : (mine.find((d) => d.id === id) ?? builtIns.find((d) => d.id === id) ?? null)), [dueDeck, mine, builtIns]);
  const setFace = useCallback((f: StudyFace) => decks.update((file) => withFace(file, f)), [decks]);

  return {
    ready: !!bundle && learning.ready && decks.ready,
    failed: status === "error",
    bundle,
    learning,
    profile,
    decks,
    plus,
    audio,
    now,
    face,
    setFace,
    card,
    audible,
    builtIns,
    mine,
    dueDeck,
    locked,
    cardsOf,
    summaryOf,
    findDeck,
  };
}
