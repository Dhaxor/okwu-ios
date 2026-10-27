// The web build streams recordings directly (browsers play servers that
// ignore byte-range requests). Native: ./clipCache.ts.

export function wantsLocalCopy(_uri: string | null | undefined): boolean {
  return false;
}

export async function localCopy(url: string): Promise<string> {
  return url;
}
