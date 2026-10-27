// The names of people this learner blocked, kept on this phone only, so
// Settings › Safety can say who they are (the server lists blocked account
// ids, never names). Read defensively; a missing name shows as "Someone
// you blocked".
import { deviceKV } from "./kv";
import { createStore } from "./store";

export const BLOCK_NAMES_KEY = "okwu.blocknames.v1";

export function parseBlockNames(raw: string | null): Record<string, string> {
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) if (/^a_[\w]{1,40}$/.test(k) && typeof n === "string" && n.length <= 40) out[k] = n;
    return out;
  } catch {
    return {};
  }
}

export const blockNamesStore = createStore<Record<string, string>>({ key: BLOCK_NAMES_KEY, kv: deviceKV, parse: parseBlockNames, debounceMs: 0 });

export async function rememberBlocked(id: string, name: string): Promise<void> {
  const cur = await blockNamesStore.load();
  blockNamesStore.save({ ...cur, [id]: name.slice(0, 40) });
}

export async function forgetBlocked(id: string): Promise<void> {
  const cur = await blockNamesStore.load();
  const { [id]: _gone, ...rest } = cur;
  blockNamesStore.save(rest);
}
