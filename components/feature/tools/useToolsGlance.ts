// One line for each tool on the Me tab: cards due, what is kept offline,
// and this week so far. Light: no audio players, no card views.
import { useMemo } from "react";
import { deviceCalendar } from "@/lib/game";
import { useContent, useGame, useLearning, usePlus, useProfile } from "@/lib/state";
import { builtInDecks, deckCards, formatBytes, storageUsed, useDecks, useOffline, userDeckView, weekOf, weekStats } from "@/lib/tools";

export interface ToolsGlance {
  flashcards: string;
  offline: string;
  report: string;
}

export function useToolsGlance(): ToolsGlance {
  const { bundle } = useContent();
  const learning = useLearning();
  const game = useGame();
  const { profile } = useProfile();
  const { file, ready } = useDecks();
  const plus = usePlus();
  const off = useOffline();
  return useMemo(() => {
    const now = new Date();
    let flashcards = "Your own decks, and one for every unit";
    let report = "Your week in minutes, words and tones";
    if (bundle && learning.ready && ready) {
      const decks = [...file.decks.map(userDeckView), ...builtInDecks(bundle, file, learning.progress, learning.reviewLog, now, profile.track || undefined)].filter(
        (d) => !(d.kind === "unit" && d.unit && !plus.can("full-path", { unitFree: d.unit.free }))
      );
      const refs = [...new Set(decks.flatMap((d) => d.refs))];
      const due = deckCards({ bundle, progress: learning.progress, scheduler: learning.scheduler, refs, face: file.face, now, audible: (r) => !r.startsWith("dict:") }).filter((c) => c.due).length;
      if (due > 0) flashcards = `${due} ${due === 1 ? "card" : "cards"} due`;
      else if (file.decks.length > 0) flashcards = `${file.decks.length} ${file.decks.length === 1 ? "deck" : "decks"} of your own · all caught up`;
      const s = weekStats(
        { bundle, progress: learning.progress, log: learning.reviewLog, game: game.state, view: game.view, scheduler: learning.scheduler, now, dayKey: (d) => deviceCalendar.dayKey(d) },
        weekOf(deviceCalendar.dayKey(now))
      );
      if (s.minutes > 0 || s.lessons > 0) report = `This week: ${s.minutes} min · ${s.lessons} ${s.lessons === 1 ? "lesson" : "lessons"}`;
    }
    const used = storageUsed(off.state);
    const offline = used > 0 ? `${formatBytes(used)} kept on this phone` : "Recordings for when there's no signal";
    return { flashcards, offline, report };
  }, [bundle, learning.ready, learning.progress, learning.reviewLog, learning.scheduler, ready, file, profile.track, plus, game.state, game.view, off.state]);
}
