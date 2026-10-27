// Game layer (owner B). The public surface for screens (docs/CONTRACTS.md §3):
// createGameEngine, the state helpers, the rules and the copy helpers.
// Screens import from "@/lib/game" only.
export type * from "./types";
export * from "./rules";
export { createGameEngine, revivalAvailable, WELCOME_BACK_AFTER_DAYS } from "./engine";
export { GAME_KEY, emptyGameState, parseGameState } from "./state";
export { deviceCalendar, zoneCalendar, dayIndex, addDays, daysBetween, weekKey, festivalOn, marketDayOf } from "./calendar";
export { courseMapFrom } from "./obodo";
export { PLACEHOLDER_CATALOG, chapterId } from "./collections";
export { ACHIEVEMENT_CATALOG, achievementDef } from "./achievements";
export { NOTIFICATION_COPY, allNotificationCopy } from "./notifications";
export { peakOf, xpOf, effectCopy, izuStatusCopy, gardenStatusCopy, cropOfPlant, CROP_NAMES_EN, PLACE_NAMES_EN, type GameLabels } from "./effects";
