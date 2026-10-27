// Community UI (screens D3, E5): built only from components/ui,
// constants/theme, the game's QuestCard and RewardBloom. Data comes through
// useSocial().client.
export { Avatar, AvatarStack, type AvatarProps } from "./Avatar";
export { CircleCard, type CircleCardProps } from "./CircleCard";
export { CLUB_BADGES, ChatBubble, ClubCard, Composer, badgeIcon, type ChatBubbleProps, type ClubCardProps, type ComposerProps } from "./Club";
export { CohortSection, type CohortSectionProps } from "./CohortSection";
export { DevPanel } from "./DevPanel";
export { FamilyChallengeCard, FamilyChallengeStrip, type FamilyChallengeCardProps } from "./FamilyChallenge";
export { CHALLENGE_COPY, helpersLine, stripLine } from "./challenge";
export { COHORT_GOAL_COPY, cohortQuestCard } from "./cohortQuest";
export { AgeGate, TermsGate } from "./Gates";
export { PersonRow, type PersonRowProps } from "./PersonRow";
export { CrisisLines, SafetySheet, useSafetySheet, type SafetyExtra, type SafetySubject } from "./SafetySheet";
export { StateCard, type StateCardProps } from "./StateCard";
export { useCommunity, type CommunityData } from "./useCommunity";
export { ConsentRequestCard, SendNoteSheet, VoiceGateCard, type SendNoteSheetProps } from "./VoicePanel";
export { VoiceNoteCard, type VoiceNoteCardProps } from "./VoiceNoteCard";
