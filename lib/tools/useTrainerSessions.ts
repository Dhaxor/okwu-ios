// The Practice trainers' free daily session (okwu.trainersessions.v1),
// gated by usePlus().can("tone-trainer" | "speaking-trainer", { sessionsToday }).
// Screens call `begin()` from their start button: it counts the session and
// says whether it may start; when it may not, the screen opens
// /paywall?from=trainer. Nothing here ever interrupts a running session.
import { useCallback, useMemo } from "react";
import { deviceCalendar } from "@/lib/game";
import { usePlus } from "@/lib/state";
import { shared, useShared } from "./persisted";
import { TRAINER_SESSIONS_KEY, countSession, parseTrainerSessions, sessionsToday, trainerGate, type TrainerGate, type TrainerKind, type TrainerSessions } from "./trainers";

export const trainerSessionsStore = shared<TrainerSessions>({ key: TRAINER_SESSIONS_KEY, parse: parseTrainerSessions, debounceMs: 0 });

export interface TrainerAllowance {
  /** Plus and today's count are both read (avoid showing a limit to a Plus member for a beat). */
  ready: boolean;
  sessionsToday: number;
  /** "open": a session may start now; "plus": today's free session is used. */
  gate: TrainerGate;
  /** Call as a session starts. False (nothing counted) when the gate is closed. */
  begin: () => boolean;
}

export function useTrainerAllowance(kind: TrainerKind): TrainerAllowance {
  const plus = usePlus();
  const { value, ready } = useShared(trainerSessionsStore);
  const today = deviceCalendar.dayKey(new Date());
  const count = sessionsToday(value, kind, today);
  const gate = trainerGate(plus.can, kind, count);
  const begin = useCallback(() => {
    const day = deviceCalendar.dayKey(new Date());
    const now = sessionsToday(trainerSessionsStore.get(), kind, day);
    if (trainerGate(plus.can, kind, now) !== "open") return false;
    trainerSessionsStore.set((s) => countSession(s, kind, day));
    return true;
  }, [plus.can, kind]);
  return useMemo(() => ({ ready: ready && plus.ready, sessionsToday: count, gate, begin }), [ready, plus.ready, count, gate, begin]);
}
