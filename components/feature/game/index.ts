// Game UI (owner B, docs/CONTRACTS.md §6). Built only from components/ui,
// constants/theme and the game art in components/art/game. Every Igbo
// string arrives as a prop from approved content (labels, igbo=…).
export { IzuChain, type IzuChainProps } from "./IzuChain";
export { UbiGarden, type UbiGardenProps } from "./UbiGarden";
export { ObodoMap, type ObodoMapProps } from "./ObodoMap";
export { CollectionCard, type CollectionCardProps } from "./CollectionCard";
export { LessonCompleteMoment, ChainKeptMoment, type LessonCompleteMomentProps, type ChainKeptMomentProps } from "./RewardMoment";
export { QuestCard, type QuestCardProps } from "./QuestCard";
export { AchievementList, type AchievementListProps } from "./AchievementList";
