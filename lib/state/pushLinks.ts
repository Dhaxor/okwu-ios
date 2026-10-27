// Where tapping a notification takes the learner. Pure (pushLinks.test.ts);
// the hook that listens is ./usePushRouting.ts.
//
// Community pushes carry a link in their data (`data.url`, server/src/push.ts
// `pushText`): okwu://community, okwu://community/friends or
// okwu://community/circle/<circle id>. A link is only ever matched against
// the allow-list below; anything else (another scheme, a web address, an
// unknown screen, a malformed id, "..", escapes) is ignored and the app just
// opens where it is. Nothing from a link reaches the router except a path
// rebuilt from the allow-list, and a circle id that matched its pattern.

/** How the router should open it: switch to a tab, or push a screen over the current one. */
export type PushRoute = { href: string; mode: "tab" | "push" };

/** Family Circle ids: "f_" and letters or digits (server `randomId("f_", 8)`; the development stand-in uses words). */
const CIRCLE_ID = /^f_[A-Za-z0-9]{2,40}$/;

/** The in-app routes a notification may open. */
const ALLOWED: readonly { pattern: RegExp; route: (m: RegExpExecArray) => PushRoute | null }[] = [
  { pattern: /^\/?$/, route: () => ({ href: "/", mode: "tab" }) },
  { pattern: /^\/(practice|community|me)$/, route: (m) => ({ href: `/${m[1]}`, mode: "tab" }) },
  { pattern: /^\/community\/friends$/, route: () => ({ href: "/community/friends", mode: "push" }) },
  { pattern: /^\/community\/circle\/([^/]+)$/, route: (m) => (CIRCLE_ID.test(m[1] ?? "") ? { href: `/community/circle/${m[1]}`, mode: "push" } : null) },
];

const MAX_LINK = 256;

/**
 * The in-app route for a notification link, or null to ignore it.
 * Accepts "okwu://<path>", "okwu:///<path>" and "/<path>"; a query or
 * fragment is dropped (nothing reads it).
 */
export function routeForLink(link: unknown): PushRoute | null {
  if (typeof link !== "string" || link.length === 0 || link.length > MAX_LINK) return null;
  // Printable ASCII only: no spaces, controls, backslashes or look-alike letters.
  if (!/^[\x21-\x7e]+$/.test(link) || link.includes("\\")) return null;
  let rest: string;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(link);
  if (scheme) {
    if (scheme[1]!.toLowerCase() !== "okwu") return null;
    rest = link.slice(scheme[0].length);
    if (!rest.startsWith("//")) return null;
    rest = rest.slice(2); // "okwu://community/…" puts "community" where a host would be
    rest = rest.startsWith("/") ? rest : `/${rest}`;
  } else {
    if (!link.startsWith("/") || link.startsWith("//")) return null;
    rest = link;
  }
  const path = rest.replace(/[?#].*$/, "");
  if (path.includes("%") || path.includes("//") || /(^|\/)\.\.?(\/|$)/.test(path) || path.includes("@") || path.includes(":")) return null;
  const clean = path.length > 1 ? path.replace(/\/$/, "") : path;
  for (const { pattern, route } of ALLOWED) {
    const m = pattern.exec(clean);
    if (m) return route(m);
  }
  return null;
}

/** The parts of an expo-notifications response this reads. */
export interface ResponseLike {
  actionIdentifier?: string;
  notification?: { date?: number; request?: { identifier?: string; content?: { data?: unknown } } };
}

/** The link a notification carries (`data.url`), or null. */
export function linkOf(response: ResponseLike | null | undefined): unknown {
  const data = response?.notification?.request?.content?.data;
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>).url : null;
}

/** A response's identity, so the cold-start read and the listener never route twice. */
export function responseKey(response: ResponseLike): string {
  return `${response.notification?.request?.identifier ?? "?"}@${response.notification?.date ?? 0}`;
}

/**
 * What to open for a notification response: only a plain tap (the default
 * action, not a dismissal or a custom button), only once per response, and
 * only an allowed route.
 */
export function routeForResponse(response: ResponseLike | null | undefined, seen: Set<string>, defaultAction: string): PushRoute | null {
  if (!response) return null;
  if (response.actionIdentifier !== undefined && response.actionIdentifier !== defaultAction) return null;
  const key = responseKey(response);
  if (seen.has(key)) return null;
  seen.add(key);
  return routeForLink(linkOf(response));
}
