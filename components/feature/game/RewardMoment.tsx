// Peak-end moments. One per flow, joyful but quiet: a bloom of uli dots,
// Nnenne glad, a headline, and the few numbers that matter. Screens place
// these inside <Screen center> with the one primary action in the footer.
//   <LessonCompleteMoment xp={…} words={…} minutes={…} peak={effectCopy(peakOf(effects))} izu={view.izu} />
//   <ChainKeptMoment length={…} cells={view.izu.cells} labels={labels} />
// Motion: the bloom opens once, numbers count up, beads fill one by one.
// Reduce Motion fades instead; still mode renders the end state.
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { AkweteBand, Nnenne } from "@/components/art";
import { RewardBloom } from "@/components/art/game/CollectionArt";
import { MarketDayBead } from "@/components/art/game/MarketDayBead";
import { Card, T, useMotion } from "@/components/ui";
import { calm } from "@/components/ui/motion";
import { colors, motion, radius, shadow, space } from "@/constants/theme";
import type { GameLabels } from "@/lib/game";
import type { IzuCell, IzuView } from "@/lib/game/types";
import { IzuChain } from "./IzuChain";

/** Count up to `to` once (or show it at once when motion is off). */
function useCountUp(to: number, duration = 900): number {
  const policy = useMotion();
  const [n, setN] = useState(policy.moves ? 0 : to);
  useEffect(() => {
    if (!policy.moves) {
      setN(to);
      return;
    }
    let raf = 0;
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setN(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, policy.moves]);
  return n;
}

/** Fade (and, with motion, rise) in after a delay. */
function Arrive({ delay, children, style }: { delay: number; children: React.ReactNode; style?: object }) {
  const policy = useMotion();
  const v = useSharedValue(policy.still ? 1 : 0);
  useEffect(() => {
    v.value = policy.still ? 1 : withDelay(delay, withTiming(1, { duration: motion.enter, easing: calm }));
  }, [delay, policy.still, v]);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: policy.moves ? [{ translateY: (1 - v.value) * space.xs }] : [] }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

function Stat({ value, label, testID }: { value: string; label: string; testID: string }) {
  return (
    <Card variant="sunk" padding="md" style={styles.stat} testID={testID}>
      <T variant="title" numeric strong tone="primary" center>
        {value}
      </T>
      <T variant="caption" center>
        {label}
      </T>
    </Card>
  );
}

export interface LessonCompleteMomentProps {
  xp: number;
  /** New words learned in this lesson. */
  words: number;
  minutes: number;
  /** The flow's one peak, already worded (effectCopy(peakOf(effects))). */
  peak?: { title: string; detail: string } | null;
  /** The market-day chain after this lesson. */
  izu?: IzuView;
  labels?: GameLabels;
  testID: string;
}

export function LessonCompleteMoment({ xp, words, minutes, peak, izu, labels, testID }: LessonCompleteMomentProps) {
  const shown = useCountUp(xp);
  return (
    <View testID={testID} style={styles.moment} accessible accessibilityLabel={`Lesson complete. ${peak ? `${peak.title}. ${peak.detail}` : ""} ${xp} XP, ${words} new words, ${minutes} minutes.`}>
      <RewardBloom size={208}>
        <Nnenne size={120} ground="ochre" mood="glad" />
      </RewardBloom>
      <Arrive delay={200} style={styles.copy}>
        <T variant="label" tone="accent" center>
          Lesson complete
        </T>
        <T variant="display" center>
          {peak?.title ?? "Well done"}
        </T>
        {peak?.detail ? (
          <T variant="body" tone="muted" center>
            {peak.detail}
          </T>
        ) : null}
      </Arrive>
      <Arrive delay={380} style={styles.stats}>
        <Stat value={`+${shown}`} label="XP" testID={`${testID}-xp`} />
        <Stat value={String(words)} label={words === 1 ? "new word" : "new words"} testID={`${testID}-words`} />
        <Stat value={String(minutes)} label={minutes === 1 ? "minute" : "minutes"} testID={`${testID}-minutes`} />
      </Arrive>
      {izu ? (
        <Arrive delay={520}>
          <IzuChain view={izu} labels={labels} compact testID={`${testID}-izu`} />
        </Arrive>
      ) : null}
    </View>
  );
}

function FillingBead({ cell, index }: { cell: IzuCell; index: number }) {
  const policy = useMotion();
  const v = useSharedValue(policy.still ? 1 : 0);
  useEffect(() => {
    v.value = policy.still ? 1 : withDelay(260 + index * 220, withTiming(1, { duration: motion.state * 2, easing: calm }));
  }, [index, policy.still, v]);
  const a = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * v.value, transform: policy.moves ? [{ scale: 0.8 + 0.2 * v.value }] : [] }));
  return (
    <Animated.View style={a}>
      <MarketDayBead state={cell.state} size={48} />
    </Animated.View>
  );
}

export interface ChainKeptMomentProps {
  /** The chain's length now (izu kept in a row). */
  length: number;
  cells: readonly IzuCell[];
  labels?: GameLabels;
  testID: string;
}

export function ChainKeptMoment({ length, cells, labels, testID }: ChainKeptMomentProps) {
  const shown = useCountUp(length, 700);
  const policy = useMotion();
  const band = useSharedValue(policy.still ? 1 : 0);
  useEffect(() => {
    band.value = policy.still ? 1 : withDelay(1300, withTiming(1, { duration: motion.celebrate, easing: calm }));
  }, [policy.still, band]);
  const bandStyle = useAnimatedStyle(() => ({ opacity: band.value, transform: policy.moves ? [{ scaleX: 0.2 + 0.8 * band.value }] : [] }));
  const rest = cells.find((c) => c.state === "rest");
  const restName = rest ? labels?.marketDays?.[rest.day] : undefined;
  return (
    <View testID={testID} style={styles.moment} accessible accessibilityLabel={`Your chain holds: ${length} market weeks in a row.`}>
      <RewardBloom size={184}>
        <View style={styles.seal}>
          <T variant="display" numeric tone="onInk" center>
            {shown}
          </T>
        </View>
      </RewardBloom>
      <Arrive delay={240} style={styles.copy}>
        <T variant="label" tone="accent" center>
          {length === 1 ? "First market week kept" : `${length} market weeks in a row`}
        </T>
        <T variant="display" center>
          Your chain holds
        </T>
        <T variant="body" tone="muted" center>
          {rest ? (
            <>
              Three market days, kept.{" "}
              {restName ? (
                <>
                  <T variant="body" igbo tone="primary">
                    {restName}
                  </T>{" "}
                  is yours to rest.
                </>
              ) : (
                "The last day is yours to rest."
              )}
            </>
          ) : (
            "You practised on every market day."
          )}
        </T>
      </Arrive>
      <View style={styles.bigBeads}>
        {cells.map((c, i) => (
          <View key={c.day} style={styles.bigDay}>
            <FillingBead cell={c} index={i} />
            <T variant="body" igbo={!!labels?.marketDays?.[c.day]} tone={c.state === "practised" ? "primary" : "muted"}>
              {labels?.marketDays?.[c.day] ?? `Day ${i + 1}`}
            </T>
          </View>
        ))}
      </View>
      <Animated.View style={[styles.band, bandStyle]}>
        <AkweteBand height={24} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  moment: { alignItems: "center", gap: space.lg, width: "100%" },
  copy: { alignItems: "center", gap: space.xs, maxWidth: 360 },
  stats: { flexDirection: "row", gap: space.sm, alignSelf: "stretch" },
  stat: { flex: 1, alignItems: "center", gap: space.xxs },
  bigBeads: { flexDirection: "row", gap: space.lg },
  seal: { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", boxShadow: shadow.inkButton },
  bigDay: { alignItems: "center", gap: space.xs },
  band: { alignSelf: "stretch", borderRadius: radius.sm, overflow: "hidden" },
});
