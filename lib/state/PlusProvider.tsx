// Okwu Plus entitlement, prices and purchases (expo-iap, StoreKit 2).
// The owner's Vela/Anker architecture, which Apple approved:
// - The grant arrives through purchaseUpdatedListener, the only path Apple
//   guarantees for deferred and interrupted purchases.
// - Restore asks the App Store to sync first, and tells "nothing owned"
//   ('failed') apart from "the App Store could not be reached" ('error').
// - Prices are fetched at launch, then again while they are missing (an
//   offline launch): on foreground, on a short backoff, and when the paywall
//   opens. Nothing is ever invented; with no prices the paywall is neutral.
// - A read that began before a purchase granted Plus never takes it back.
// - The okwu.plus.v1 cache shows Plus before StoreKit answers and keeps it
//   while StoreKit is offline.
//
//   const plus = usePlus();
//   plus.isPlus, plus.can("full-path", { unitFree }), plus.quotes, plus.purchase("yearly"), plus.restore()
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LIST_PRICES,
  NO_QUOTES,
  ONE_TIME_SKUS,
  PLAN_ORDER,
  PLUS_KEY,
  PLUS_PRODUCTS,
  SUBSCRIPTION_SKUS,
  TRIAL_DAYS_CONFIGURED,
  classifyPurchaseError,
  displayablePrice,
  numericPrice,
  ownsPlus,
  plusAllows,
  plusPlanOf,
  restoreOutcome,
  trialOf,
  type PlanId,
  type PlanQuote,
  type PlusFeature,
  type PlusPlan,
  type PlusUse,
  type PurchaseResult,
} from "./plus";

export const PURCHASES_ENABLED = Platform.OS === "ios";

const PRICE_RETRY_MS = [5_000, 20_000, 60_000] as const;

type Iap = typeof import("expo-iap");

function iap(): Iap | null {
  if (!PURCHASES_ENABLED) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-iap") as Iap;
  } catch {
    return null;
  }
}

/** Layout check only: `?demoPrices=1` on the web development build fills the plans with the list prices. Never on iOS or in a release. */
export function demoPricesRequested(): boolean {
  if (typeof __DEV__ === "undefined" || !__DEV__ || Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("demoPrices") === "1";
  } catch {
    return false;
  }
}

export function demoQuotes(): Record<PlanId, PlanQuote> {
  const out = {} as Record<PlanId, PlanQuote>;
  for (const p of PLAN_ORDER) {
    const l = LIST_PRICES[p];
    const days = TRIAL_DAYS_CONFIGURED[p];
    out[p] = { display: l.display, amount: { amount: l.amount, currency: l.currency }, trial: days ? { days } : null };
  }
  return out;
}

export interface PlusState {
  ready: boolean;
  isPlus: boolean;
  /** How Plus is owned, as StoreKit answered this session (null: not known yet, or no Plus). */
  plan: PlusPlan | null;
  /** May the learner use this now? Plus opens everything; the free core is always open. */
  can: (feature: PlusFeature, use?: PlusUse) => boolean;
  /** StoreKit's prices and trials per plan (all null on web and before the store answers). */
  quotes: Record<PlanId, PlanQuote>;
  reloadPrices: () => void;
  purchase: (plan: PlanId) => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
  /** Apple's subscription management sheet (iOS). */
  manageSubscriptions: () => Promise<void>;
  /** Development builds only: turn Plus on or off to check both states. */
  setPlusForTesting: ((on: boolean) => void) | null;
}

const Ctx = createContext<PlusState | null>(null);

export function PlusProvider({ children }: { children?: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isPlus, setIsPlus] = useState(false);
  const [plan, setPlan] = useState<PlusPlan | null>(null);
  const [quotes, setQuotes] = useState<Record<PlanId, PlanQuote>>(NO_QUOTES);
  const grants = useRef(0);

  useEffect(() => {
    let stale = false;
    AsyncStorage.getItem(PLUS_KEY)
      .then((v) => {
        if (!stale && v === "1") setIsPlus(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!stale) setReady(true);
      });
    return () => {
      stale = true;
    };
  }, []);

  const setEntitlement = useCallback((owned: boolean) => {
    setIsPlus(owned);
    AsyncStorage.setItem(PLUS_KEY, owned ? "1" : "0").catch(() => {});
  }, []);

  // ---- prices -------------------------------------------------------------
  const pricesKnown = useRef(false);
  const fetching = useRef(false);
  const alive = useRef(true);
  const retry = useRef<{ timer: ReturnType<typeof setTimeout> | null; attempt: number }>({ timer: null, attempt: 0 });

  const loadProducts = useCallback(async () => {
    const store = iap();
    if (!store || pricesKnown.current || fetching.current) return;
    fetching.current = true;
    let got = false;
    try {
      await store.initConnection();
      const [subs, inapp] = await Promise.all([
        store.fetchProducts({ skus: [...SUBSCRIPTION_SKUS], type: "subs" }),
        store.fetchProducts({ skus: [...ONE_TIME_SKUS], type: "in-app" }),
      ]);
      if (!alive.current) return;
      const all = [...((subs ?? []) as unknown[]), ...((inapp ?? []) as unknown[])] as { id?: string; productId?: string; displayPrice?: string; price?: number | null; currency?: string; subscriptionGroupIdIOS?: string | null }[];
      const productFor = (sku: string) => all.find((x) => (x.productId ?? x.id) === sku);
      // A trial is shown only when the store offers one AND this Apple Account is still eligible.
      const eligible = new Map<string, boolean>();
      const isEligible = async (groupId: string | null | undefined): Promise<boolean> => {
        if (!groupId) return false;
        if (eligible.has(groupId)) return eligible.get(groupId)!;
        let ok = false;
        try {
          ok = (await store.isEligibleForIntroOfferIOS(groupId)) === true;
        } catch {
          ok = false;
        }
        eligible.set(groupId, ok);
        return ok;
      };
      const next = {} as Record<PlanId, PlanQuote>;
      for (const p of PLAN_ORDER) {
        const product = productFor(PLUS_PRODUCTS[p]);
        const trial = trialOf(product);
        next[p] = {
          display: displayablePrice(product),
          amount: numericPrice(product),
          trial: trial && (await isEligible(product?.subscriptionGroupIdIOS)) ? trial : null,
        };
      }
      if (!alive.current) return;
      setQuotes(next);
      got = PLAN_ORDER.some((p) => next[p].display !== null);
    } catch {
      // prices stay null; the paywall stays neutral rather than inventing any
    } finally {
      fetching.current = false;
    }
    if (got) {
      pricesKnown.current = true;
      retry.current.attempt = 0;
      return;
    }
    if (alive.current && retry.current.timer === null && retry.current.attempt < PRICE_RETRY_MS.length) {
      const delay = PRICE_RETRY_MS[retry.current.attempt];
      retry.current.attempt += 1;
      retry.current.timer = setTimeout(() => {
        retry.current.timer = null;
        void loadProducts();
      }, delay);
    }
  }, []);

  const reloadPrices = useCallback(() => {
    if (pricesKnown.current) return;
    retry.current.attempt = 0;
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const store = iap();
    if (!store) return;
    let cancelled = false;

    const sub = store.purchaseUpdatedListener(async (p) => {
      if (!ownsPlus([p as never])) return;
      grants.current += 1;
      try {
        await store.finishTransaction({ purchase: p, isConsumable: false });
      } catch {
        // best-effort; the entitlement still stands
      }
      if (cancelled) return;
      setEntitlement(true);
      setPlan((prev) => (prev === "lifetime" ? "lifetime" : plusPlanOf([p as never])));
    });

    const refreshEntitlement = async () => {
      const grantsAtStart = grants.current;
      try {
        await store.initConnection();
        const owned = await store.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
        if (cancelled) return;
        const has = ownsPlus(owned as never);
        if (!has && grants.current !== grantsAtStart) return;
        setEntitlement(has);
        setPlan(plusPlanOf(owned as never));
      } catch {
        // keep the last verified value while the App Store is away
      }
    };

    void refreshEntitlement();
    const appSub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      void refreshEntitlement();
      if (!pricesKnown.current) {
        retry.current.attempt = 0;
        void loadProducts();
      }
    });
    alive.current = true;
    void loadProducts();
    return () => {
      cancelled = true;
      alive.current = false;
      if (retry.current.timer !== null) clearTimeout(retry.current.timer);
      retry.current.timer = null;
      appSub.remove();
      sub?.remove?.();
    };
  }, [setEntitlement, loadProducts]);

  const purchase = useCallback(async (p: PlanId): Promise<PurchaseResult> => {
    const store = iap();
    if (!store) return "unavailable";
    try {
      await store.initConnection();
    } catch {
      return "error";
    }
    try {
      const sku = PLUS_PRODUCTS[p];
      if (SUBSCRIPTION_SKUS.includes(sku)) await store.requestPurchase({ request: { apple: { sku } }, type: "subs" });
      else await store.requestPurchase({ request: { apple: { sku } }, type: "in-app" });
      return "purchased"; // the grant arrives in purchaseUpdatedListener
    } catch (e) {
      return classifyPurchaseError(e);
    }
  }, []);

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    const store = iap();
    if (!store) return "unavailable";
    try {
      await store.initConnection();
      let syncError: unknown = null;
      try {
        // syncIOS, not restorePurchases: a sync that never reached the App Store must not read as "nothing found".
        if (typeof store.syncIOS === "function") await store.syncIOS();
        else await store.restorePurchases();
      } catch (e) {
        syncError = e ?? new Error("App Store sync failed");
      }
      const owned = await store.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
      const outcome = restoreOutcome(owned as never, syncError);
      if (outcome.entitlement === true) grants.current += 1;
      if (outcome.entitlement !== null) {
        setEntitlement(outcome.entitlement);
        setPlan(plusPlanOf(owned as never));
      }
      return outcome.result;
    } catch {
      return "error";
    }
  }, [setEntitlement]);

  const manageSubscriptions = useCallback(async () => {
    const store = iap();
    if (!store) return;
    try {
      await store.deepLinkToSubscriptions({});
    } catch {
      /* the sheet could not open; Settings › Apple Account still works */
    }
  }, []);

  const setPlusForTesting = useMemo(() => (typeof __DEV__ !== "undefined" && __DEV__ ? (on: boolean) => setEntitlement(on) : null), [setEntitlement]);

  const value = useMemo<PlusState>(
    () => ({
      ready,
      isPlus,
      plan: isPlus ? plan : null,
      can: (feature, use) => plusAllows(feature, isPlus, use),
      quotes,
      reloadPrices,
      purchase,
      restore,
      manageSubscriptions,
      setPlusForTesting,
    }),
    [ready, isPlus, plan, quotes, reloadPrices, purchase, restore, manageSubscriptions, setPlusForTesting]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlus(): PlusState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlus needs <PlusProvider> (lib/state/PlusProvider)");
  return v;
}
