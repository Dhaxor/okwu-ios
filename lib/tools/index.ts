// Learner tools (E4): flashcard decks, offline packs, the weekly progress
// report and the trainers' daily allowance. Pure, tested logic in
// ./decks, ./offline, ./report, ./trainers and ./packBuild; the hooks keep
// one shared, persisted value each (okwu.decks.v1, okwu.offline.v1,
// okwu.trainersessions.v1) through ./persisted. docs/CONTRACTS.md §8.
export * from "./decks";
export * from "./offline";
export * from "./report";
export * from "./trainers";
export { decksStore, useDecks } from "./useDecks";
export { MANIFEST, PACKS_BASE, cancelPack, downloadPack, ensureOfflineAudio, offlineStore, removeAllPacks, removePack, setWifiOnly, useOffline, type Job, type OfflineView } from "./useOffline";
export { trainerSessionsStore, useTrainerAllowance, type TrainerAllowance } from "./useTrainerSessions";
