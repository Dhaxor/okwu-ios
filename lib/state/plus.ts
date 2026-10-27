// Okwu Plus: products, prices, the purchase decisions and what Plus opens.
// Pure (no React, no React Native) and tested (plus.test.ts). The provider
// is ./PlusProvider.tsx; the paywall is app/paywall.tsx.
//
// The purchase logic is the owner's StoreKit-verified pattern from Vela and
// Anker (vela/lib/purchase.ts): a cancel is a normal choice, an unreachable
// App Store decides nothing, a restore only re-grants an unrevoked purchase,
// and a price is shown only when StoreKit handed us one.
//
// Guideline 3.1.2(c) (the owner's WishSmart app was rejected for this): on
// every plan the BILLED amount is the largest, most prominent price. A free
// trial and any per-month equivalent sit in a smaller line under it, and the
// buy button never carries a price. `planLines` builds both lines; the plan
// card renders `billed` at the title size and `detail` at the caption size.
//
// Free forever: the first units of each track, daily review, the
// dictionary, Family Circle and cohorts. Plus: the full path, the tone and
// speaking trainers without a daily limit, every story, the dialect lens
// and offline packs.

// ---------------------------------------------------------------------------
// Products. Change the ids here (App Store Connect must match).
// ---------------------------------------------------------------------------

export const PLUS_PRODUCT_PREFIX = "app.okwu.learn.plus";

export const PLUS_PRODUCTS = {
  yearly: `${PLUS_PRODUCT_PREFIX}.yearly`,
  monthly: `${PLUS_PRODUCT_PREFIX}.monthly`,
  family: `${PLUS_PRODUCT_PREFIX}.family.yearly`,
  lifetime: `${PLUS_PRODUCT_PREFIX}.lifetime`,
} as const;

export type PlanId = keyof typeof PLUS_PRODUCTS;

/** The order on the paywall; yearly is the default choice. */
export const PLAN_ORDER: readonly PlanId[] = ["yearly", "monthly", "family", "lifetime"];
export const DEFAULT_PLAN: PlanId = "yearly";

/** Auto-renewing subscriptions (one subscription group in App Store Connect). */
export const SUBSCRIPTION_PLANS: readonly PlanId[] = ["yearly", "monthly", "family"];
/** The non-consumable. */
export const ONE_TIME_PLANS: readonly PlanId[] = ["lifetime"];

export const SUBSCRIPTION_SKUS: readonly string[] = SUBSCRIPTION_PLANS.map((p) => PLUS_PRODUCTS[p]);
export const ONE_TIME_SKUS: readonly string[] = ONE_TIME_PLANS.map((p) => PLUS_PRODUCTS[p]);
export const ALL_SKUS: readonly string[] = [...SUBSCRIPTION_SKUS, ...ONE_TIME_SKUS];

/**
 * The prices to set in App Store Connect (USD tier), and the free trial on
 * yearly (an introductory offer there). Reference only: the app shows
 * StoreKit's own prices, never these, except the web layout check
 * (`?demoPrices=1` in a development build).
 */
export const LIST_PRICES: Readonly<Record<PlanId, { amount: number; currency: string; display: string }>> = {
  yearly: { amount: 59.99, currency: "USD", display: "$59.99" },
  monthly: { amount: 9.99, currency: "USD", display: "$9.99" },
  family: { amount: 89.99, currency: "USD", display: "$89.99" },
  lifetime: { amount: 149.99, currency: "USD", display: "$149.99" },
};
export const TRIAL_DAYS_CONFIGURED: Readonly<Partial<Record<PlanId, number>>> = { yearly: 7 };

export const PLUS_KEY = "okwu.plus.v1";

export function planOfSku(sku: string | undefined | null): PlanId | null {
  if (!sku) return null;
  return PLAN_ORDER.find((p) => PLUS_PRODUCTS[p] === sku) ?? null;
}

// ---------------------------------------------------------------------------
// Purchase decisions (from Vela's verified module)
// ---------------------------------------------------------------------------

/**
 * purchased · cancelled (a normal choice) · unavailable (no StoreKit here) ·
 * failed (the store answered: the purchase failed, or a restore found
 * nothing) · error (the App Store could not be reached; nothing was decided).
 */
export type PurchaseResult = "purchased" | "cancelled" | "unavailable" | "failed" | "error";

/** Did the person cancel (never an error message), or did it fail? Machine signals first. */
export function isCancellation(error: unknown): boolean {
  if (!error) return false;
  const e = error as { code?: string | number; message?: string; userCancelled?: boolean };
  if (e.userCancelled === true) return true;
  const code = typeof e.code === "string" ? e.code.toLowerCase() : e.code;
  // SKErrorPaymentCancelled is 2.
  if (code === 2) return true;
  if (typeof code === "string" && (code.includes("cancel") || code === "e_user_cancelled")) return true;
  const msg = String(e.message ?? error).toLowerCase();
  return /cancel/.test(msg);
}

/** expo-iap (OpenIAP) codes that mean the App Store was not reached. */
const UNREACHABLE_CODES: ReadonlySet<string> = new Set([
  "network-error",
  "service-error",
  "service-timeout",
  "service-disconnected",
  "connection-closed",
  "init-connection",
  "remote-error",
  "sync-error",
  "not-prepared",
]);

export function isStoreUnreachable(error: unknown): boolean {
  if (!error) return false;
  const e = error as { code?: string | number; message?: string };
  if (typeof e.code === "string") {
    const code = e.code.toLowerCase().replace(/_/g, "-").replace(/^e-/, "");
    if (UNREACHABLE_CODES.has(code)) return true;
  }
  return /network|offline|not connected to the internet|timed out/.test(String(e.message ?? "").toLowerCase());
}

export function classifyPurchaseError(error: unknown): PurchaseResult {
  if (isCancellation(error)) return "cancelled";
  return isStoreUnreachable(error) ? "error" : "failed";
}

/** The fields of an expo-iap Purchase that decide ownership. A refund (revocation) never grants. */
export interface OwnedPurchase {
  productId?: string;
  id?: string;
  revocationDateIOS?: number | null;
  revocationDate?: number | string | null;
}

const revoked = (p: OwnedPurchase) => (p.revocationDateIOS !== undefined && p.revocationDateIOS !== null) || (p.revocationDate !== undefined && p.revocationDate !== null);

const proves = (purchases: readonly OwnedPurchase[] | null | undefined, skus: readonly string[]) =>
  (purchases ?? []).some((p) => {
    const id = p.productId ?? p.id;
    return !!id && skus.includes(id) && !revoked(p);
  });

/** Does this payload prove Plus (any of the four products, never a revoked one)? */
export function ownsPlus(purchases: readonly OwnedPurchase[] | null | undefined): boolean {
  return proves(purchases, ALL_SKUS);
}

export type PlusPlan = "lifetime" | "subscription";

/** 'lifetime' wins over a subscription; null when nothing proves Plus. */
export function plusPlanOf(purchases: readonly OwnedPurchase[] | null | undefined): PlusPlan | null {
  if (proves(purchases, ONE_TIME_SKUS)) return "lifetime";
  return proves(purchases, SUBSCRIPTION_SKUS) ? "subscription" : null;
}

/**
 * What a restore decided. Only an App Store that answered with nothing is a
 * genuine none ('failed', Plus off). A sync that could not reach the store
 * decides nothing ('error', or 'cancelled' for a dismissed Apple sign-in).
 */
export function restoreOutcome(owned: readonly OwnedPurchase[] | null | undefined, syncError: unknown): { result: PurchaseResult; entitlement: boolean | null } {
  if (ownsPlus(owned)) return { result: "purchased", entitlement: true };
  if (syncError !== null && syncError !== undefined) return { result: isCancellation(syncError) ? "cancelled" : "error", entitlement: null };
  return { result: "failed", entitlement: false };
}

// ---------------------------------------------------------------------------
// Prices (StoreKit's strings only; nothing invented)
// ---------------------------------------------------------------------------

export interface PlanAmount {
  readonly amount: number;
  readonly currency: string;
}

const CURRENCY_RE = /^[A-Za-z]{3}$/;

/** Show a price only when the store handed us a real, non-empty string. */
export function displayablePrice(product: { displayPrice?: unknown } | null | undefined): string | null {
  const p = product?.displayPrice;
  if (typeof p !== "string") return null;
  const t = p.trim();
  return t ? t : null;
}

export function numericPrice(product: { price?: unknown; currency?: unknown } | null | undefined): PlanAmount | null {
  const amount = product?.price;
  const currency = product?.currency;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  if (typeof currency !== "string" || !CURRENCY_RE.test(currency.trim())) return null;
  return { amount, currency: currency.trim().toUpperCase() };
}

export function formatMoney(amount: number, currency: string, locale?: string): string | null {
  if (!Number.isFinite(amount) || amount <= 0 || !CURRENCY_RE.test(currency)) return null;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return null;
  }
}

/** A free trial the store offers on a product (introductory offer, paid nothing). */
export interface Trial {
  days: number;
}

type Unit = "day" | "week" | "month" | "year" | string;
const DAYS_PER: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

function trialDays(unit: Unit | null | undefined, value: number, count: number): number | null {
  const per = unit ? DAYS_PER[unit] : undefined;
  if (!per || !Number.isFinite(value) || !Number.isFinite(count) || value <= 0 || count <= 0) return null;
  return Math.round(per * value * count);
}

/**
 * The free trial on a StoreKit product, if any. Reads the cross-platform
 * `subscriptionOffers` first (an introductory free-trial offer), then the
 * iOS introductory-price fields. Never assumes one.
 */
export function trialOf(product: unknown): Trial | null {
  if (typeof product !== "object" || product === null) return null;
  const p = product as {
    subscriptionOffers?: { type?: string; paymentMode?: string | null; period?: { unit?: string; value?: number } | null; periodCount?: number | null; numberOfPeriodsIOS?: number | null }[] | null;
    introductoryPricePaymentModeIOS?: string | null;
    introductoryPriceSubscriptionPeriodIOS?: string | null;
    introductoryPriceNumberOfPeriodsIOS?: string | null;
  };
  for (const o of p.subscriptionOffers ?? []) {
    if (o?.type !== "introductory" || o.paymentMode !== "free-trial") continue;
    const days = trialDays(o.period?.unit, o.period?.value ?? 1, o.periodCount ?? o.numberOfPeriodsIOS ?? 1);
    if (days) return { days };
  }
  if (p.introductoryPricePaymentModeIOS === "free-trial") {
    const days = trialDays(p.introductoryPriceSubscriptionPeriodIOS, 1, Number(p.introductoryPriceNumberOfPeriodsIOS ?? 1) || 1);
    if (days) return { days };
  }
  return null;
}

/** What StoreKit told us about one plan. Every field null until it answers (web: always). */
export interface PlanQuote {
  /** StoreKit's display string for what is charged ('$59.99'). */
  readonly display: string | null;
  readonly amount: PlanAmount | null;
  /** A free trial this person is eligible for (null: none, or eligibility unknown). */
  readonly trial: Trial | null;
}

export const NO_QUOTE: PlanQuote = { display: null, amount: null, trial: null };
export const NO_QUOTES: Readonly<Record<PlanId, PlanQuote>> = { yearly: NO_QUOTE, monthly: NO_QUOTE, family: NO_QUOTE, lifetime: NO_QUOTE };

/** How each plan bills. */
export const PLAN_COPY: Readonly<Record<PlanId, { label: string; per: string; cadence: string; note: string | null }>> = {
  yearly: { label: "Yearly", per: "a year", cadence: "Billed once a year", note: null },
  monthly: { label: "Monthly", per: "a month", cadence: "Billed every month", note: null },
  family: { label: "Family", per: "a year", cadence: "Billed once a year", note: "Up to 6 people through Apple Family Sharing" },
  lifetime: { label: "Lifetime", per: "once", cadence: "One payment, yours for good", note: null },
};

/**
 * The two price lines of a plan card. `billed` is the charge, rendered as the
 * largest price on the card; `detail` (trial, per-month equivalent, how it
 * bills) is rendered smaller. With no StoreKit price, `billed` is null and
 * the card stays neutral.
 */
export interface PlanLines {
  readonly billed: string | null;
  /** 'a year', 'a month', 'once': set beside the billed amount at the same size or smaller. */
  readonly per: string;
  readonly detail: string;
}

export function planLines(plan: PlanId, quote: PlanQuote, locale?: string): PlanLines {
  const copy = PLAN_COPY[plan];
  const billed = quote.display ?? (quote.amount ? formatMoney(quote.amount.amount, quote.amount.currency, locale) : null);
  if (!billed) return { billed: null, per: copy.per, detail: [copy.cadence, copy.note].filter(Boolean).join(" · ") };
  const parts: string[] = [];
  if (quote.trial && SUBSCRIPTION_PLANS.includes(plan)) parts.push(`${quote.trial.days} days free, then ${billed} ${copy.per}`);
  else parts.push(copy.cadence);
  if ((plan === "yearly" || plan === "family") && quote.amount) {
    const perMonth = formatMoney(quote.amount.amount / 12, quote.amount.currency, locale);
    if (perMonth) parts.push(`about ${perMonth} a month`);
  }
  if (copy.note) parts.push(copy.note);
  return { billed, per: copy.per, detail: parts.join(" · ") };
}

/** 'Best value' only when it is honestly so: same currency, yearly under twelve months of monthly. */
export function yearlyIsBetterValue(quotes: Readonly<Record<PlanId, PlanQuote>>): boolean {
  const y = quotes.yearly.amount;
  const m = quotes.monthly.amount;
  if (!y || !m || y.currency !== m.currency) return false;
  return y.amount < m.amount * 12;
}

export function anyPrice(quotes: Readonly<Record<PlanId, PlanQuote>>): boolean {
  return PLAN_ORDER.some((p) => !!planLines(p, quotes[p]).billed);
}

export function pricesMissing(quotes: Readonly<Record<PlanId, PlanQuote>>): boolean {
  return PLAN_ORDER.some((p) => !quotes[p].display);
}

/** The buy button. Never a price (3.1.2(c)): the price lives on the plan card. */
export function buyLabel(plan: PlanId, quote: PlanQuote): string {
  if (plan === "lifetime") return "Unlock Plus for life";
  if (quote.trial && quote.display) return `Start ${quote.trial.days}-day free trial`;
  return "Subscribe to Plus";
}

/** The auto-renewal terms shown under the plans (App Review looks for them beside the price). */
export const RENEWAL_TERMS =
  "Yearly, Monthly and Family renew automatically at the price shown until you cancel. Payment is charged to your Apple Account when you confirm, or when a free trial ends. Cancel at least 24 hours before the end of a period to avoid the next charge; manage or cancel in Settings › Apple Account › Subscriptions. Lifetime is a single payment that never renews.";

// ---------------------------------------------------------------------------
// What Plus opens
// ---------------------------------------------------------------------------

export type PlusFeature =
  /** Units beyond each track's free units. */
  | "full-path"
  /** Tone trainer sessions beyond the free daily one. */
  | "tone-trainer"
  /** Speaking trainer sessions beyond the free daily one. */
  | "speaking-trainer"
  /** Every graded story (the free units' stories are free). */
  | "stories"
  /** "Also said as": regional voices for every word. */
  | "dialect-lens"
  /** Lesson audio downloaded for offline use. */
  | "offline-packs";

/** Free sessions a day of each trainer before Plus (daily review itself is never limited). */
export const FREE_TRAINER_SESSIONS_PER_DAY = 1;

export const FREE_FOREVER: readonly string[] = [
  "The first units of each track",
  "Daily review of everything you learn",
  "The dictionary, with tones and audio",
  "Family Circle and your cohort",
];

export const PLUS_BENEFITS: readonly { feature: PlusFeature; title: string; detail: string }[] = [
  { feature: "full-path", title: "The whole path", detail: "Every unit, from first greetings to real conversations." },
  { feature: "tone-trainer", title: "Tone and speaking trainers", detail: "Practise as long as you like, every day." },
  { feature: "stories", title: "Every story", detail: "Graded folktales and family scenes, read by real voices." },
  { feature: "dialect-lens", title: "The dialect lens", detail: "Hear how a word is said in other places." },
  { feature: "offline-packs", title: "Offline packs", detail: "Take lessons and audio with you, no signal needed." },
];

export interface PlusUse {
  /** Trainer sessions already started today (for the trainers). */
  sessionsToday?: number;
  /** The unit's free flag (for the path and its stories). */
  unitFree?: boolean;
}

/** May this learner use the feature now? Plus opens everything; the free core stays free. */
export function plusAllows(feature: PlusFeature, isPlus: boolean, use: PlusUse = {}): boolean {
  if (isPlus) return true;
  switch (feature) {
    case "full-path":
    case "stories":
      return use.unitFree === true;
    case "tone-trainer":
    case "speaking-trainer":
      return (use.sessionsToday ?? 0) < FREE_TRAINER_SESSIONS_PER_DAY;
    case "dialect-lens":
    case "offline-packs":
      return false;
  }
}

// ---------------------------------------------------------------------------
// The soft offer: once, after the first lesson, never mid-lesson
// ---------------------------------------------------------------------------

export interface OfferMemory {
  /** When the soft offer was shown (null: never). */
  shownAt: string | null;
}

export const OFFER_KEY = "okwu.plusoffer.v1";
export const EMPTY_OFFER: OfferMemory = { shownAt: null };

export function parseOfferMemory(raw: string | null): OfferMemory {
  try {
    const v = raw ? (JSON.parse(raw) as { shownAt?: unknown }) : null;
    return { shownAt: typeof v?.shownAt === "string" && !Number.isNaN(Date.parse(v.shownAt)) ? v.shownAt : null };
  } catch {
    return EMPTY_OFFER;
  }
}

/**
 * Is the one soft paywall due? Only for someone without Plus, after their
 * first finished lesson, on a calm screen (never inside a lesson), and only
 * once: after that, Plus is offered only where the learner reaches for it.
 */
export function softOfferDue(input: { isPlus: boolean; ready: boolean; lessonsDone: number; memory: OfferMemory; inLesson: boolean }): boolean {
  return input.ready && !input.isPlus && !input.inLesson && input.lessonsDone >= 1 && input.memory.shownAt === null;
}

/** Where the paywall was opened from (its header copy). */
export type PaywallSource = "first-lesson" | "path" | "trainer" | "stories" | "dialect-lens" | "offline-packs" | "me" | "settings";

const SOURCES: readonly PaywallSource[] = ["first-lesson", "path", "trainer", "stories", "dialect-lens", "offline-packs", "me", "settings"];

export function paywallSource(raw: unknown): PaywallSource {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return SOURCES.includes(v as PaywallSource) ? (v as PaywallSource) : "settings";
}

export function paywallCopy(source: PaywallSource): { title: string; lead: string } {
  switch (source) {
    case "first-lesson":
      // Not every first lesson has tones in it (a heritage learner placed at Unit 3 starts with market days).
      return { title: "Your first lesson is done", lead: "Keep going for free, or open the whole path with Okwu Plus. Everything you need to start speaking stays free." };
    case "path":
      return { title: "The rest of the path is in Plus", lead: "Your first units stay free forever. Plus opens every unit after them, from greetings to real conversations." };
    case "trainer":
      return { title: "Practise as long as you like", lead: "One trainer session a day is free. Plus takes the limit away." };
    case "stories":
      return { title: "Every story, with Plus", lead: "The stories in your free units stay free. Plus opens every story and folktale." };
    case "dialect-lens":
      return { title: "Hear Igbo from every place", lead: "The dialect lens plays how a word is said in other towns, recorded by speakers from there." };
    case "offline-packs":
      return { title: "Learn with no signal", lead: "Offline packs keep lessons and their audio on your phone for flights and trips home." };
    default:
      return { title: "Okwu Plus", lead: "Everything you need to start speaking stays free. Plus opens the whole path." };
  }
}

/** What a purchase or restore says afterwards; null for nothing (a cancel is a normal choice). */
export function purchaseMessage(action: "buy" | "restore", result: PurchaseResult): { message: string; tone: "neutral" | "success" | "warning" | "error" } | null {
  if (result === "cancelled") return null;
  if (result === "error") return { message: "Couldn't reach the App Store. Check your connection and try again.", tone: "warning" };
  if (action === "buy") {
    if (result === "unavailable") return { message: "Purchases work in the iPhone app. Everything free stays yours.", tone: "neutral" };
    if (result === "failed") return { message: "That purchase didn't go through. Nothing was charged; you can try again.", tone: "error" };
    return null; // purchased: the grant arrives through the listener
  }
  if (result === "purchased") return { message: "Okwu Plus is restored on this device.", tone: "success" };
  if (result === "unavailable") return { message: "Restore works in the iPhone app.", tone: "neutral" };
  return { message: "No Okwu Plus purchase was found for this Apple Account.", tone: "neutral" };
}
