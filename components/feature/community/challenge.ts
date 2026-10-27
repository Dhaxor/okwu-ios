// Words for the Family Circle's weekly challenge, pure and tested
// (challenge.test.ts). Co-op only: the copy never ranks, never counts down
// to a loss, and names helpers without amounts.
import type { AccountId, FamilyChallengeKind, FamilyChallengeView, PublicProfile } from "@/lib/social";

export interface ChallengeCopy {
  /** "Finish 18 lessons together". */
  title: (target: number) => string;
  unit: readonly [singular: string, plural: string];
  /** How a person adds to it. */
  how: string;
  /** For the empty state: the first step anyone can take. */
  start: string;
}

export const CHALLENGE_COPY: Record<FamilyChallengeKind, ChallengeCopy> = {
  lessons: {
    title: (n) => `Finish ${n} ${n === 1 ? "lesson" : "lessons"} together`,
    unit: ["lesson", "lessons"],
    how: "Every lesson anyone in the family finishes counts.",
    start: "Finish a lesson to start the family off.",
  },
  words: {
    title: (n) => `Learn ${n} new ${n === 1 ? "word" : "words"} together`,
    unit: ["new word", "new words"],
    how: "Every new word anyone meets in a lesson counts.",
    start: "Meet a new word in a lesson to start the family off.",
  },
  "voice-replies": {
    title: (n) => `Answer ${n} voice ${n === 1 ? "prompt" : "prompts"}`,
    unit: ["reply", "replies"],
    how: "When someone records a prompt for you, say it back in a voice note. Each answer counts once.",
    start: "Record a prompt for someone, or answer one sent to you.",
  },
};

export const unitFor = (kind: FamilyChallengeKind, n: number) => CHALLENGE_COPY[kind].unit[n === 1 ? 0 : 1];

/** The helpers in the order they joined, the learner last as "you". */
export function orderedHelpers<T extends { id: AccountId }>(helpers: readonly T[], me: AccountId | null): T[] {
  return [...helpers.filter((p) => p.id !== me), ...helpers.filter((p) => p.id === me)];
}

/** "Mama Ngozi, Adaeze and you": others in the order they joined, then "you"; long lists end "and 3 more". */
export function helperNames(helpers: readonly PublicProfile[], me: AccountId | null, max = 4): string {
  const others = helpers.filter((p) => p.id !== me).map((p) => p.displayName);
  const withMe = helpers.some((p) => p.id === me);
  const room = Math.max(1, max - (withMe ? 1 : 0));
  let names = others.length > room ? [...others.slice(0, room - 1), `${others.length - (room - 1)} more`] : others;
  if (withMe) names = [...names, "you"];
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The helpers line under the bar. */
export function helpersLine(c: Pick<FamilyChallengeView, "helpers" | "completed" | "kind">, me: AccountId | null): string {
  if (!c.helpers.length) return CHALLENGE_COPY[c.kind].start;
  const names = helperNames(c.helpers, me);
  const sentence = names.charAt(0).toUpperCase() + names.slice(1);
  const one = c.helpers.length === 1;
  if (c.completed) return one ? `${sentence} did it for the family.` : `${sentence} did it together.`;
  if (one && c.helpers[0]!.id === me) return "You started the family off.";
  return `${sentence} ${one ? "has" : "have"} helped this week.`;
}

/** "4 days left", "Last day". Never a countdown to failure: a new challenge simply starts Monday. */
export function daysLeftLabel(endsAt: string, now: Date): string {
  const ms = Date.parse(endsAt) - now.getTime();
  const days = Math.max(1, Math.ceil(ms / 86_400_000));
  return days === 1 ? "Last day" : `${days} days left`;
}

/** The viewer's own part, kindly. */
export function mineLine(c: Pick<FamilyChallengeView, "kind" | "mine">): string {
  return c.mine > 0 ? `You added ${c.mine} ${unitFor(c.kind, c.mine)}` : "Your part will show here";
}

/** The compact line on the Community tab's circle card. */
export function stripLine(c: Pick<FamilyChallengeView, "kind" | "target" | "progress" | "completed">): string {
  if (c.completed) return `${c.target} ${unitFor(c.kind, c.target)} together this week`;
  return `${c.progress} of ${c.target} ${unitFor(c.kind, c.target)}`;
}

/** Screen-reader summary of the bar. */
export function challengeA11y(c: FamilyChallengeView): string {
  const unit = unitFor(c.kind, c.target);
  return c.completed
    ? `This week's family challenge is done: ${c.target} ${unit} together.`
    : `This week's family challenge: ${c.progress} of ${c.target} ${unit} together. You added ${c.mine}.`;
}
