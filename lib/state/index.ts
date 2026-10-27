// The app's state layer (owner D). Screens import from here. Pure logic
// lives in the tested modules (store, profile, play, session, path,
// feedback, audioSource, social); the providers and hooks hold and persist.
// docs/CONTRACTS.md §8 documents the API.
//
//   <ProfileProvider>          okwu.profile.v2 (migrates v1)
//     <AppStateProvider>       content bundle, okwu.progress.v1, okwu.reviewlog.v1, okwu.game.v1
//       <SocialProvider>       SecureStore creds, okwu.socialconfig.v1
export { ProfileProvider, useProfile, profileStore, type ProfileState } from "./ProfileProvider";
export {
  AppStateProvider,
  useContent,
  useGame,
  useLearning,
  usePlay,
  type AnswerInput,
  type ContentState,
  type ContentStatus,
  type FinishInput,
  type GameCtxState,
  type LearningState,
  type PlayActions,
} from "./AppState";
export { SocialProvider, useAgeTier, useSocial, secureCredsStore, type SocialState, type SocialStatus } from "./SocialProvider";
export { MAX_TAKE_MS, configurePlayback, useItemAudio, useVoiceRecorder, type ItemAudio, type PlayResult, type RecorderState, type VoiceRecorder } from "./audio";
export { dialectOptions, loadDialectLabels, useDialectLabels } from "./dialects";
export * from "./profile";
export * from "./session";
export * from "./path";
export * from "./feedback";
export { AUDIO_BASE, SLOW_RATE, resolveClip, voiceForTrial, type ClipEnv, type ClipRequest, type ClipSource } from "./audioSource";
export * from "./social";
export { catalogFrom, engineFor, gameLabelsFrom, playAnswer, playLessonComplete, playPlacement, utcOffsetMinutes, type AnswerPlay, type LearningData, type LessonPlay, type PlayResult as PlayOutcome } from "./play";
export { createStore, memoryKV, type KV, type PersistedStore, type StoreOptions } from "./store";
export { SHOWCASE_ID, showcaseExercises } from "./showcase";
// Community, Me, Settings and Plus (D3).
//   <PlusProvider>           okwu.plus.v1 (inside SocialProvider); usePlus()
export { SOCIAL_MOCK } from "./SocialProvider";
export { PlusProvider, usePlus, PURCHASES_ENABLED, demoPricesRequested, demoQuotes, type PlusState } from "./PlusProvider";
export * from "./plus";
export { offerStore, useSoftPaywall } from "./plusOffer";
export * from "./notifications";
export { cancelReminders, deviceNotifications, useReminderPermission, useReminderSync, type ReminderPermission } from "./reminders";
export * from "./community";
export { NOTE_MAX_MS, NOTE_MIN_MS, useNotePlayer, useNoteRecorder, type NotePlayer, type NoteRecorder, type NoteRecorderState } from "./voiceNotes";
export { createMockSocialClient, isMockClient, type MockControls } from "./mockSocial";
export { blockNamesStore, forgetBlocked, parseBlockNames, rememberBlocked } from "./blockNames";
