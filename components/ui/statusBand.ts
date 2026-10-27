// The paper band under the status bar of a scrolling screen (<Screen>). iOS
// draws the clock, signal and battery over whatever scrolls beneath them, so
// without it text runs into the status bar. None where there is no top inset
// (web) or nothing scrolls.
import { space } from "@/constants/theme";

export function statusBandOf(insetTop: number, scrolls: boolean): { height: number; fade: number } | null {
  return scrolls && insetTop > 0 ? { height: insetTop, fade: space.sm } : null;
}
