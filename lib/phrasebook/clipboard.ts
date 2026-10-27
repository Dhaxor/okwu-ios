// "Copy" for a phrase, through expo-clipboard (iPhone, Android and web).
// The result says what happened, so the screen can confirm honestly.
//
// expo-clipboard is a native module: a development build made before it was
// added has the JavaScript but not the module, and importing it there throws.
// Only in that case does Copy fall back to the system share sheet, whose
// first action is Copy. A clipboard that is present but refuses (a browser
// without permission) is reported as "failed", never sent to the share sheet.
type ReactNative = typeof import("react-native");
// Loaded when Copy runs on a device, so the logic below tests under bun.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rn = (): ReactNative => require("react-native") as ReactNative;

export type CopyResult = "copied" | "shared" | "dismissed" | "failed";

/** The part of expo-clipboard Copy uses. */
export interface ClipboardLike {
  setStringAsync(text: string): Promise<boolean>;
}

export interface CopyDeps {
  /** expo-clipboard, or null when this build lacks its native module. */
  clipboard: () => ClipboardLike | null;
  /** The system share sheet (the fallback). */
  share: (text: string) => Promise<"shared" | "dismissed">;
  /** Web has no share-sheet fallback. */
  web: boolean;
}

let module_: ClipboardLike | null | undefined;
/** expo-clipboard, loaded on first use; null when its native module is missing from this build. */
export function expoClipboard(): ClipboardLike | null {
  if (module_ === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const m = require("expo-clipboard") as typeof import("expo-clipboard");
      module_ = typeof m?.setStringAsync === "function" ? { setStringAsync: (t) => m.setStringAsync(t) } : null;
    } catch {
      module_ = null;
    }
  }
  return module_;
}

async function shareSheet(text: string): Promise<"shared" | "dismissed"> {
  const { Share } = rn();
  const r = await Share.share({ message: text });
  return r.action === Share.dismissedAction ? "dismissed" : "shared";
}

const device = (): CopyDeps => ({ clipboard: expoClipboard, share: shareSheet, web: rn().Platform.OS === "web" });

/** Copy text: the clipboard when the build has it; else (native only) the share sheet. Never throws. */
export async function copyText(text: string, deps: CopyDeps = device()): Promise<CopyResult> {
  const clipboard = deps.clipboard();
  if (clipboard) {
    try {
      return (await clipboard.setStringAsync(text)) === false ? "failed" : "copied";
    } catch {
      return "failed";
    }
  }
  if (deps.web) return "failed";
  try {
    return await deps.share(text);
  } catch {
    return "failed";
  }
}
