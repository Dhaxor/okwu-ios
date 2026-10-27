// The phrasebook's pieces: a colour-coded tile per situation, the phrase card
// (Igbo, English, listen, favourite, copy), the review chip and the source
// line every phrasebook screen carries. Built from components/ui and the
// theme only.
import React from "react";
import { StyleSheet, View } from "react-native";
import {
  Church,
  Clock,
  CookingPot,
  Copy,
  Heart,
  HeartHandshake,
  Info,
  Pause,
  Phone,
  PartyPopper,
  ShoppingBasket,
  Signpost,
  Siren,
  Star,
  Stethoscope,
  Users,
  Volume2,
  type IconComponent,
} from "@/components/glyphs/icons";
import { Card, Chip, IconButton, Press, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import type { Phrase, SituationId, SituationSummary } from "@/lib/phrasebook";
import type { ClipKind } from "@/lib/phrasebook/hooks";

export type Tint = "accent" | "success" | "reward" | "ink";

/** Soft ground and strong mark for each tint: colour-coded, never loud. */
export const TINTS: Record<Tint, { ground: string; mark: string; badge: string }> = {
  accent: { ground: colors.accent06, mark: colors.accent, badge: colors.accent12 },
  success: { ground: colors.success12, mark: colors.success, badge: colors.surface },
  reward: { ground: colors.reward12, mark: colors.rewardText, badge: colors.surface },
  ink: { ground: colors.ink06, mark: colors.ink, badge: colors.surface },
};

/** Each situation's icon and tint; neighbours in the two-column grid never share a tint. */
export const SITUATION_LOOK: Record<SituationId, { icon: IconComponent; tint: Tint }> = {
  greetings: { icon: HeartHandshake, tint: "accent" },
  family: { icon: Users, tint: "success" },
  market: { icon: ShoppingBasket, tint: "reward" },
  food: { icon: CookingPot, tint: "accent" },
  travel: { icon: Signpost, tint: "ink" },
  church: { icon: Church, tint: "reward" },
  feelings: { icon: Heart, tint: "accent" },
  health: { icon: Stethoscope, tint: "success" },
  time: { icon: Clock, tint: "reward" },
  phone: { icon: Phone, tint: "ink" },
  celebrations: { icon: PartyPopper, tint: "success" },
  emergencies: { icon: Siren, tint: "accent" },
};

export const PENDING_REVIEW_LABEL = "Pending native review";

export function ReviewChip({ testID }: { testID: string }) {
  return <Chip label={PENDING_REVIEW_LABEL} tone="reward" testID={testID} />;
}

/** The source and review line under every phrasebook screen. */
export const PHRASEBOOK_SOURCE_DETAIL = "Chosen from the dataset by English meaning and quality, not written by Okwu. Every phrase is pending native review.";

export function PhraseSourceNote({ credit, detail = PHRASEBOOK_SOURCE_DETAIL, testID }: { credit: string; detail?: string; testID: string }) {
  return (
    <View style={styles.source} testID={testID}>
      <Info size={size.iconSm} color={colors.ink68} strokeWidth={2} />
      <View style={styles.flex}>
        <T variant="caption">{`${credit}.`}</T>
        <T variant="caption">{detail}</T>
      </View>
    </View>
  );
}

export function SituationTile({ situation, onPress, testID }: { situation: SituationSummary; onPress: () => void; testID: string }) {
  const look = SITUATION_LOOK[situation.id];
  const tint = TINTS[look.tint];
  const Icon = look.icon;
  return (
    <Press
      testID={testID}
      onPress={onPress}
      pressScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${situation.title}, ${situation.count} phrases`}
      style={[styles.tile, { backgroundColor: tint.ground }]}
    >
      <View style={[styles.tileBadge, { backgroundColor: tint.badge }]}>
        <Icon size={size.icon} color={tint.mark} strokeWidth={2} />
      </View>
      <View style={styles.tileText}>
        <T variant="body" strong tone="primary" numberOfLines={2}>
          {situation.title}
        </T>
        <T variant="caption" numeric>{`${situation.count} phrases`}</T>
      </View>
    </Press>
  );
}

const StarIcon = Star as React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

/** A star that fills with ochre when the phrase is a favourite. */
export function FavouriteButton({ on, onPress, label, testID }: { on: boolean; onPress: () => void; label: string; testID: string }) {
  return (
    <Press
      testID={testID}
      onPress={onPress}
      haptics="select"
      accessibilityRole="button"
      accessibilityLabel={on ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
      accessibilityState={{ selected: on }}
      style={[styles.round, on ? styles.starOn : styles.starOff]}
    >
      <StarIcon size={size.icon} color={on ? colors.rewardText : colors.ink} fill={on ? colors.reward : colors.transparent} strokeWidth={2} />
    </Press>
  );
}

export interface PhraseCardProps {
  phrase: Phrase;
  clip: ClipKind;
  playing: boolean;
  favourite: boolean;
  onPlay: () => void;
  onToggleFavourite: () => void;
  onCopy: () => void;
  /** Open the phrase page (tap the words). */
  onOpen?: () => void;
  /** Show which situation it is from (search results, favourites). */
  situationTitle?: string;
  testID: string;
}

/** One phrase: the Igbo (the value), its English, and listen, favourite and copy within thumb reach. */
export function PhraseCard({ phrase, clip, playing, favourite, onPlay, onToggleFavourite, onCopy, onOpen, situationTitle, testID }: PhraseCardProps) {
  const text = (
    <View style={styles.cardText}>
      {situationTitle ? (
        <T variant="label" tone="accent">
          {situationTitle}
        </T>
      ) : null}
      <T variant="title" igbo testID={`${testID}-igbo`}>
        {phrase.igbo}
      </T>
      <T variant="body" tone="muted">
        {phrase.en}
      </T>
    </View>
  );
  const canPlay = clip === "asset" || clip === "url";
  return (
    <Card padding="md" testID={testID} style={styles.card}>
      {onOpen ? (
        <Press testID={`${testID}-open`} onPress={onOpen} pressScale={1} haptics="select" accessibilityLabel={`${phrase.igbo}: ${phrase.en}. Open`}>
          {text}
        </Press>
      ) : (
        text
      )}
      <View style={styles.actions}>
        {canPlay ? (
          <Press
            testID={`${testID}-play`}
            onPress={onPlay}
            haptics="select"
            accessibilityRole="button"
            accessibilityLabel={playing ? "Playing" : `Listen: ${phrase.en}`}
            style={[styles.listen, playing && styles.listenOn]}
          >
            {playing ? <Pause size={size.iconSm} color={colors.onInk} strokeWidth={2} /> : <Volume2 size={size.iconSm} color={colors.ink} strokeWidth={2} />}
            <T variant="caption" strong tone={playing ? "onInk" : "primary"}>
              {playing ? "Playing" : "Listen"}
            </T>
          </Press>
        ) : clip === "pending" ? (
          <T variant="caption" tone="faint" testID={`${testID}-soon`}>
            Recording coming soon
          </T>
        ) : (
          <View />
        )}
        <View style={styles.trailing}>
          <FavouriteButton on={favourite} onPress={onToggleFavourite} label={phrase.en} testID={`${testID}-fav`} />
          <IconButton icon={Copy} accessibilityLabel={`Copy: ${phrase.en}`} onPress={onCopy} variant="tinted" testID={`${testID}-copy`} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: space.xxs },
  source: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSunk },
  tile: { flex: 1, minHeight: 128, borderRadius: radius.xl, padding: space.md, gap: space.sm, justifyContent: "space-between" },
  tileBadge: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  tileText: { gap: space.xxs },
  card: { gap: space.sm },
  cardText: { gap: space.xxs },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  trailing: { flexDirection: "row", alignItems: "center", gap: space.xs },
  listen: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    height: size.tapMin,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.ink06,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  listenOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  round: { width: size.iconButton, height: size.iconButton, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  starOff: { backgroundColor: colors.ink06, borderColor: colors.hairline },
  starOn: { backgroundColor: colors.reward12, borderColor: colors.reward },
});
