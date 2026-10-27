// The one soft paywall: after the learner's first finished lesson, on the
// Learn tab (never inside a lesson), once. After that, Plus is offered only
// where the learner reaches for it (a locked unit, a trainer limit).
// The rule is `softOfferDue` in ./plus (tested); this is the hook.
import { useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { deviceKV } from "./kv";
import { EMPTY_OFFER, OFFER_KEY, parseOfferMemory, softOfferDue, type OfferMemory } from "./plus";
import { usePlus } from "./PlusProvider";
import { createStore } from "./store";

export const offerStore = createStore<OfferMemory>({ key: OFFER_KEY, kv: deviceKV, parse: parseOfferMemory, debounceMs: 0 });

/** A beat after the screen settles, so the paywall rises over a calm Learn tab. */
const SETTLE_MS = 900;

/** Call from the Learn tab with the number of lessons done (null while loading). */
export function useSoftPaywall(lessonsDone: number | null): void {
  const plus = usePlus();
  const router = useRouter();
  const ready = plus.ready && lessonsDone !== null;
  const isPlus = plus.isPlus;
  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let live = true;
      let timer: ReturnType<typeof setTimeout> | null = null;
      offerStore
        .load()
        .then((memory) => {
          if (!live || !softOfferDue({ isPlus, ready, lessonsDone: lessonsDone ?? 0, memory, inLesson: false })) return;
          timer = setTimeout(() => {
            if (!live) return;
            offerStore.save({ shownAt: new Date().toISOString() });
            router.push({ pathname: "/paywall", params: { from: "first-lesson" } });
          }, SETTLE_MS);
        })
        .catch(() => {});
      return () => {
        live = false;
        if (timer) clearTimeout(timer);
      };
    }, [ready, isPlus, lessonsDone, router])
  );
}

export { EMPTY_OFFER };
