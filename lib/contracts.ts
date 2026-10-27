// Shared helpers for contract stubs. Each workstream replaces its stubs; a
// stub that is still called throws with the owner's letter so the gap is
// obvious in a test or a dev build. Owners: docs/CONTRACTS.md §6.
export type Owner = "A" | "B" | "C" | "D";

export const OWNERS: Record<Owner, string> = {
  A: "learning engine + content pipeline",
  B: "game layer",
  C: "social backend",
  D: "screens",
};

export class NotImplementedError extends Error {
  constructor(
    readonly owner: Owner,
    readonly what: string
  ) {
    super(`${what} is not implemented yet (owner ${owner}: ${OWNERS[owner]})`);
    this.name = "NotImplementedError";
  }
}

export function notImplemented(owner: Owner, what: string): never {
  throw new NotImplementedError(owner, what);
}
