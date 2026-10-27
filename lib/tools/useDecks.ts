// The learner's flashcard decks (okwu.decks.v1), shared by every screen:
// the Flashcards hub, a deck, study, and the "Add to deck" control on the
// dictionary word page and a lesson's results. Pure logic: ./decks.ts.
import { useCallback } from "react";
import { DECKS_KEY, parseDecks, serializeDecks, type DecksFile } from "./decks";
import { shared, useShared } from "./persisted";

export const decksStore = shared<DecksFile>({ key: DECKS_KEY, parse: parseDecks, serialize: serializeDecks });

export function useDecks(): { ready: boolean; file: DecksFile; update: (fn: (f: DecksFile) => DecksFile) => DecksFile } {
  const { value, ready } = useShared(decksStore);
  const update = useCallback((fn: (f: DecksFile) => DecksFile) => decksStore.set(fn), []);
  return { ready, file: value, update };
}
