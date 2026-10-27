// The contract between the lesson player and each exercise view.
import type { ContentBundle, ItemId } from "@/lib/content/types";
import type { CheckOutcome, Exercise, Response } from "@/lib/learning";
import type { ItemAudio, ToneMarks, VoiceRecorder } from "@/lib/state";

/** What the footer offers while the learner answers. */
export type FooterMode =
  /** "Check", enabled once the view reports a draft response. */
  | { kind: "check" }
  /** Self-assessment: "Not yet" and "Matched". Never a score. */
  | { kind: "self" }
  /** One step forward (a dialogue's next line, "I've read it"). */
  | { kind: "next"; label: string; onPress: () => void };

export interface ExerciseViewProps {
  exercise: Exercise;
  bundle: ContentBundle;
  /** "feedback" once checked: show the verdict on the tiles, lock input. */
  phase: "answering" | "feedback";
  outcome: CheckOutcome | null;
  marks: ToneMarks;
  audio: ItemAudio;
  recorder: VoiceRecorder;
  /** The current answer (null: not ready to check). */
  onDraft: (response: Response | null, chosen?: ItemId | null) => void;
  /** Answer now (self-assessed and step-through exercises). */
  onSubmit: (response: Response) => void;
  onMode: (mode: FooterMode) => void;
  /** "Can't listen now": skip this exercise (nothing is scheduled). */
  onSkip: () => void;
  testID: string;
}

/** Items an exercise shows, for the draft tag. */
export function itemsShown(ex: Exercise): ItemId[] {
  const s = ex.spec;
  switch (s.type) {
    case "listen-choose":
      return [s.prompt, ...s.options];
    case "tone-pair":
      return s.set;
    case "dialogue":
      return s.lines.map((l) => l.item);
    case "story":
      return s.items;
    default:
      return [s.target];
  }
}
