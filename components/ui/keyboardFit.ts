// Keeping a focused field in view on iPhone (<Screen keyboard>). The page
// shrinks above the keyboard and the footer rides on top of it, but the scroll
// view does not move: a field low on the page ends up behind the footer (the
// e2e run caught Friends' "Their friend code" field hidden this way).

import { space } from "@/constants/theme";

/** Room to keep under a focused field: the footer riding on the keyboard, and an action under the field (a Send button). */
export function keyboardRoom(footerHeight: number | null): number {
  return (footerHeight ?? 0) + space.xxxl;
}

/** Whether a focused field (its bottom edge, in window points) sits behind the keyboard or the footer on it. */
export function hiddenByKeyboard(fieldBottom: number, keyboardTop: number, room: number): boolean {
  return fieldBottom > keyboardTop - room;
}
