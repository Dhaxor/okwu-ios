// A thin adapter from the server's Ọgbọ cohort quest to the game's QuestCard,
// for every goal kind the server rotates through (reviews, lessons,
// minutes). The game's quest model stays as it is: QuestCard takes the unit
// words for the goals it has no metric for. Pure; tested in
// cohortQuest.test.ts.
import type { QuestView } from "@/lib/game/types";
import type { CohortGoalKind, CohortView } from "@/lib/social";

interface GoalCopy {
  title: string;
  detail: string;
  units: readonly [singular: string, plural: string];
}

export const COHORT_GOAL_COPY: Record<CohortGoalKind, GoalCopy> = {
  lessons: {
    title: "Lessons together",
    detail: "Finish lessons as a cohort. Every lesson anyone finishes counts for everyone.",
    units: ["lesson", "lessons"],
  },
  reviews: {
    title: "Reviews together",
    detail: "Go over words you've learnt. Every review anyone does counts for everyone.",
    units: ["review", "reviews"],
  },
  minutes: {
    title: "Minutes together",
    detail: "Practise a little most days. Every minute anyone practises counts for everyone.",
    units: ["minute of practice", "minutes of practice"],
  },
};

export interface CohortQuestCardProps {
  view: QuestView;
  units: readonly [singular: string, plural: string];
}

/** The QuestCard's props for this week's cohort goal, whatever its kind. */
/** The quest card's line about the cohort: "1 learner", never "1 learners". */
export function cohortLine(members: number): string {
  return `Your cohort · ${members} ${members === 1 ? "learner" : "learners"} who started when you did`;
}

export function cohortQuestCard(c: CohortView, now: Date): CohortQuestCardProps {
  const kind = c.quest.goal.kind;
  const copy = COHORT_GOAL_COPY[kind] ?? COHORT_GOAL_COPY.lessons;
  const target = Math.max(1, c.quest.goal.target);
  const total = Math.max(0, Math.min(c.quest.progress, target));
  const mine = Math.max(0, Math.min(c.mine[kind] ?? 0, total));
  const daysLeft = Math.max(0, Math.ceil((Date.parse(c.quest.endsAt) - now.getTime()) / 86_400_000));
  return {
    view: {
      questId: `cohort-${kind}`,
      // The game has a metric for lessons only; for reviews and minutes the card shows `units` instead.
      metric: "lessons",
      title: copy.title,
      detail: copy.detail,
      target,
      total,
      mine,
      members: c.members.length,
      progress: total / target,
      daysLeft,
      complete: c.completed || total >= target,
    },
    units: copy.units,
  };
}
