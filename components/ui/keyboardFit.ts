// Keeping a focused field in view on iPhone (<Screen keyboard>). The page
// shrinks above the keyboard and the footer rides on top of it, but the scroll
// view does not move: a field low on the page ends up behind the footer. The
// e2e runs caught Friends' "Their friend code" field hidden this way, and on an
// iPhone SE the Igbo letter keys (ị ọ ụ ṅ) under a lesson's "Type it" field
// sat behind the Check button.

import { space } from "@/constants/theme";

/** What sits under a field and must stay in view: its hint and the Igbo letter keys, or a Send button. */
export const UNDER_FIELD = space.huge + space.sm;
/** How far the footer's fade reaches above it. */
export const FOOTER_FADE = space.xl;

/** Room to keep under a focused field: the footer riding on the keyboard (and its fade), and what sits under the field. */
export function keyboardRoom(footerHeight: number | null): number {
  return footerHeight ? footerHeight + FOOTER_FADE + UNDER_FIELD : UNDER_FIELD;
}

/** Whether a focused field (its bottom edge, in window points) sits behind the keyboard or the footer on it. */
export function hiddenByKeyboard(fieldBottom: number, keyboardTop: number, room: number): boolean {
  return fieldBottom > keyboardTop - room;
}
