// FSRS-6 scheduling (the algorithm is MIT-licensed open research; this is
// our own implementation of the published formulas, following the
// reference py-fsrs 6 scheduler: same default weights, learning and
// relearning steps, same-day short-term stability and interval fuzz).
// Nothing else in the app imports this file; use `createScheduler`.
//
// Pure: no clock, no randomness except a fuzz seeded by the card and time.
import type { IsoTime, ItemId } from "@/lib/content/types";
import { rng, seedFrom } from "./rng";
import type { CardState, Facet, FsrsCard, FsrsParams, Rating, ReviewLog, Scheduler } from "./types";

/** FSRS-6 default weights (py-fsrs 6 / ts-fsrs 5). Replace once our own logs allow optimisation. */
export const FSRS6_DEFAULT_W: readonly number[] = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912,
  0.0658, 0.1542,
];

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;
const S_MIN = 0.001;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function defaultParams(over: Partial<FsrsParams> = {}): FsrsParams {
  return {
    w: FSRS6_DEFAULT_W,
    requestRetention: 0.9,
    maximumInterval: 365,
    enableFuzz: true,
    learningSteps: [1, 10],
    relearningSteps: [10],
    ...over,
  };
}

/** The FSRS model maths, exposed for tests and the optimiser later. */
export class FsrsModel {
  readonly decay: number;
  readonly factor: number;
  constructor(readonly p: FsrsParams) {
    if (p.w.length < 21) throw new Error(`FSRS-6 needs 21 weights, got ${p.w.length}`);
    this.decay = -(p.w[20] as number);
    this.factor = Math.pow(0.9, 1 / this.decay) - 1;
  }
  private w(i: number): number {
    return this.p.w[i] as number;
  }
  /** Probability of recall after `t` days at stability `s`. */
  retrievability(t: number, s: number): number {
    return Math.pow(1 + (this.factor * Math.max(0, t)) / Math.max(s, S_MIN), this.decay);
  }
  initialStability(r: Rating): number {
    return Math.max(this.w(r - 1), S_MIN);
  }
  initialDifficulty(r: Rating, clampIt = true): number {
    const d = this.w(4) - Math.exp(this.w(5) * (r - 1)) + 1;
    return clampIt ? clamp(d, 1, 10) : d;
  }
  nextDifficulty(d: number, r: Rating): number {
    const delta = -this.w(6) * (r - 3);
    const damped = d + ((10 - d) * delta) / 9;
    const reverted = this.w(7) * this.initialDifficulty(4, false) + (1 - this.w(7)) * damped;
    return clamp(reverted, 1, 10);
  }
  shortTermStability(s: number, r: Rating): number {
    let inc = Math.exp(this.w(17) * (r - 3 + this.w(18))) * Math.pow(s, -this.w(19));
    if (r >= 3) inc = Math.max(inc, 1);
    return Math.max(s * inc, S_MIN);
  }
  recallStability(d: number, s: number, retr: number, r: Rating): number {
    const hard = r === 2 ? this.w(15) : 1;
    const easy = r === 4 ? this.w(16) : 1;
    return Math.max(s * (1 + Math.exp(this.w(8)) * (11 - d) * Math.pow(s, -this.w(9)) * (Math.exp((1 - retr) * this.w(10)) - 1) * hard * easy), S_MIN);
  }
  forgetStability(d: number, s: number, retr: number): number {
    const long = this.w(11) * Math.pow(d, -this.w(12)) * (Math.pow(s + 1, this.w(13)) - 1) * Math.exp((1 - retr) * this.w(14));
    const short = s / Math.exp(this.w(17) * this.w(18));
    return Math.max(Math.min(long, short), S_MIN);
  }
  /** Days until retrievability falls to the target retention, rounded, 1..maximumInterval. */
  interval(s: number): number {
    const raw = (s / this.factor) * (Math.pow(this.p.requestRetention, 1 / this.decay) - 1);
    return clamp(Math.round(raw), 1, this.p.maximumInterval);
  }
}

const FUZZ_RANGES = [
  { start: 2.5, end: 7, factor: 0.15 },
  { start: 7, end: 20, factor: 0.1 },
  { start: 20, end: Infinity, factor: 0.05 },
];

/** FSRS interval fuzz (py-fsrs ranges), with a seeded generator so a review is reproducible. */
export function fuzzInterval(days: number, max: number, random: () => number): number {
  if (days < 2.5) return days;
  let delta = 1;
  for (const r of FUZZ_RANGES) delta += r.factor * Math.max(Math.min(days, r.end) - r.start, 0);
  let lo = Math.round(days - delta);
  let hi = Math.round(days + delta);
  lo = Math.max(2, lo);
  hi = Math.min(hi, max);
  lo = Math.min(lo, hi);
  // floor (as ts-fsrs): rounding would sometimes land one day past the range
  return Math.min(Math.floor(random() * (hi - lo + 1) + lo), max);
}

const iso = (ms: number): IsoTime => new Date(ms).toISOString();

function wholeDaysBetween(from: IsoTime | undefined, now: Date): number | null {
  if (!from) return null;
  const t = Date.parse(from);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

function stepsFor(state: CardState, p: FsrsParams): readonly number[] {
  return state === "relearning" ? p.relearningSteps : p.learningSteps;
}

/** The FSRS scheduler behind the contract's `Scheduler`. */
export function fsrsScheduler(params: Partial<FsrsParams> = {}): Scheduler & { model: FsrsModel; params: FsrsParams } {
  const p = defaultParams(params);
  const model = new FsrsModel(p);

  function newCard(item: ItemId, facet: Facet, now: Date): FsrsCard {
    return { item, facet, state: "new", due: iso(now.getTime()), stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0, step: 0, reps: 0, lapses: 0 };
  }

  function next(card: FsrsCard, rating: Rating, now: Date): FsrsCard {
    const nowMs = now.getTime();
    const days = wholeDaysBetween(card.lastReview, now);
    const sameDay = days !== null && days < 1;
    const retr = days === null ? 0 : model.retrievability(days, card.stability);
    let { stability: s, difficulty: d, step, state, lapses } = card;

    if (state === "new") {
      s = model.initialStability(rating);
      d = model.initialDifficulty(rating);
      state = "learning";
      step = 0;
    } else {
      if (sameDay) s = model.shortTermStability(s, rating);
      else if (rating === 1) s = model.forgetStability(d, s, retr);
      else s = model.recallStability(d, s, retr, rating);
      d = model.nextDifficulty(d, rating);
    }

    let intervalMs = 0;
    let scheduledDays = 0;
    const review = () => {
      state = "review";
      step = 0;
      let days = model.interval(s);
      if (p.enableFuzz) days = fuzzInterval(days, p.maximumInterval, rng(seedFrom(`${card.item}|${card.facet}|${card.reps}|${nowMs}`)));
      scheduledDays = days;
      intervalMs = days * DAY_MS;
    };

    if (card.state === "review") {
      if (rating === 1) {
        lapses += 1;
        if (p.relearningSteps.length === 0) review();
        else {
          state = "relearning";
          step = 0;
          intervalMs = (p.relearningSteps[0] as number) * MIN_MS;
        }
      } else review();
    } else {
      // new, learning or relearning: walk the steps
      const steps = stepsFor(state === "relearning" ? "relearning" : "learning", p);
      if (steps.length === 0 || (step >= steps.length && rating >= 2)) review();
      else if (rating === 1) {
        step = 0;
        intervalMs = (steps[0] as number) * MIN_MS;
      } else if (rating === 2) {
        const first = steps[0] as number;
        if (step === 0 && steps.length === 1) intervalMs = first * 1.5 * MIN_MS;
        else if (step === 0) intervalMs = ((first + (steps[1] as number)) / 2) * MIN_MS;
        else intervalMs = (steps[step] as number) * MIN_MS;
      } else if (rating === 3) {
        if (step + 1 >= steps.length) review();
        else {
          step += 1;
          intervalMs = (steps[step] as number) * MIN_MS;
        }
      } else review();
    }

    return {
      ...card,
      state,
      stability: s,
      difficulty: d,
      step,
      lapses,
      reps: card.reps + 1,
      elapsedDays: days ?? 0,
      scheduledDays,
      due: iso(nowMs + intervalMs),
      lastReview: iso(nowMs),
    };
  }

  function retrievability(card: FsrsCard, now: Date): number {
    if (card.state === "new" || !card.lastReview) return 0;
    const t = (now.getTime() - Date.parse(card.lastReview)) / DAY_MS;
    return model.retrievability(Math.max(0, t), card.stability);
  }

  return {
    model,
    params: p,
    newCard,
    review(card, rating, now, meta) {
      const updated = next(card, rating, now);
      const log: ReviewLog = {
        id: `r_${seedFrom(`${card.item}|${card.facet}|${card.reps}|${now.toISOString()}`).toString(36)}_${card.reps}`,
        item: card.item,
        facet: card.facet,
        rating,
        state: card.state,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsedDays: updated.elapsedDays,
        scheduledDays: card.scheduledDays,
        reviewedAt: now.toISOString(),
        durationMs: Math.max(0, Math.round(meta.durationMs)),
        exercise: meta.exercise,
        source: meta.source,
        selfAssessed: meta.selfAssessed,
      };
      if (meta.voice) log.voice = meta.voice;
      return { card: updated, log };
    },
    preview(card, now) {
      return { 1: next(card, 1, now), 2: next(card, 2, now), 3: next(card, 3, now), 4: next(card, 4, now) };
    },
    retrievability,
    due(cards, now, limit) {
      const t = now.getTime();
      const r = (c: FsrsCard) => retrievability(c, now);
      const due = cards
        .filter((c) => c.state !== "new" && Date.parse(c.due) <= t)
        .map((c) => ({ c, r: r(c) }))
        .sort((a, b) => a.r - b.r || Date.parse(a.c.due) - Date.parse(b.c.due) || (`${a.c.item}|${a.c.facet}` < `${b.c.item}|${b.c.facet}` ? -1 : 1))
        .map((x) => x.c);
      return limit === undefined ? due : due.slice(0, Math.max(0, limit));
    },
  };
}
