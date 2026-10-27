// Ilu, proverbs: only proverbs that are in the Nkọwa okwu dataset, each with
// its recording and the dataset's translation. Meanings and "when it's used"
// are our drafts, pending cultural review. The list grows only as reviewed
// proverbs from elders or licensed collections are added; we never write one.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AkweteBand } from "@/components/art";
import { ChipRow, PlayButton, ProverbCard, ReviewTag, SourceNote } from "@/components/feature/library";
import { ArrowRight } from "@/components/glyphs/icons";
import { Card, Chip, Press, Screen, ScreenHeader, Section, T } from "@/components/ui";
import { colors, size, space } from "@/constants/theme";
import { deviceCalendar } from "@/lib/game";
import { proverbOfTheDay, proverbsFile, proverbsInTheme, type ProverbTheme } from "@/lib/library";
import { useLibraryAudio } from "@/lib/library/useLibrary";

export default function Proverbs() {
  const router = useRouter();
  const audio = useLibraryAudio();
  const { proverbs, themes, heldBack } = proverbsFile();
  const [theme, setTheme] = useState<ProverbTheme | null>(null);
  const today = proverbOfTheDay(proverbs, deviceCalendar.dayKey(new Date()));
  const list = useMemo(() => proverbsInTheme(proverbs, theme), [proverbs, theme]);
  const titleOf = (t: ProverbTheme) => themes.find((x) => x.id === t)?.title ?? "";
  const open = (id: string) => router.push({ pathname: "/library/proverbs/[id]", params: { id } });
  const close = () => (router.canGoBack() ? router.back() : router.replace("/library"));

  return (
    <Screen testID="proverbs">
      <ScreenHeader eyebrow="Ilu · Proverbs" title="Igbo proverbs" subtitle={`${proverbs.length} proverbs from the Nkọwa okwu dataset, each with its recording.`} onBack={close} testID="proverbs-header" />

      {today ? (
        <Card variant="ink" padding="none" testID="proverbs-today">
          <AkweteBand height={24} />
          <View style={styles.todayBody}>
            <T variant="label" tone="onInkMuted">
              Proverb of the day
            </T>
            <View style={styles.todayHead}>
              <T variant="title" igbo tone="onInk" style={styles.flex}>
                {today.igbo}
              </T>
              <PlayButton id={today.audio} audio={audio} label={`Play the proverb: ${today.en}`} playKey={`today-${today.id}`} testID="proverbs-today-play" onInk />
            </View>
            <T variant="body" tone="onInkMuted">
              {today.en}
            </T>
            <Press testID="proverbs-today-open" onPress={() => open(today.id)} pressScale={1} haptics="select" accessibilityLabel="What it means and when it's used" style={styles.todayLink}>
              <T variant="caption" strong tone="onInk">
                What it means and when it's used
              </T>
              <ArrowRight size={size.iconSm} color={colors.onInk} strokeWidth={2} />
            </Press>
          </View>
        </Card>
      ) : null}

      <ChipRow testID="proverbs-themes">
        <Chip label="All" selected={theme === null} onPress={() => setTheme(null)} testID="proverbs-theme-all" />
        {themes.map((t) => (
          <Chip key={t.id} label={t.title} selected={theme === t.id} onPress={() => setTheme(t.id)} testID={`proverbs-theme-${t.id}`} />
        ))}
      </ChipRow>

      <Section title={theme ? `${titleOf(theme)} · ${list.length}` : `All ${list.length}`} testID="proverbs-list">
        <View style={styles.list}>
          {list.map((p, i) => (
            <ProverbCard key={p.id} proverb={p} audio={audio} onOpen={() => open(p.id)} themeTitle={titleOf(p.theme)} testID={`proverbs-${i}`} />
          ))}
        </View>
      </Section>

      <Card variant="sunk" testID="proverbs-growing">
        <View style={styles.note}>
          <T variant="title">The list grows with care</T>
          <T variant="body" tone="muted">
            Okwu never writes a proverb. New ones join only from elders and licensed collections, once two native reviewers have checked them.
            {heldBack > 0 ? ` ${heldBack} more found in the dataset are waiting for our cultural advisor.` : ""}
          </T>
          <View style={styles.tags}>
            <ReviewTag kind="draft" testID="proverbs-review" />
          </View>
          <T variant="caption">Translations are the dataset's. Meanings and "when it's used" are Okwu drafts.</T>
        </View>
      </Card>

      <SourceNote testID="proverbs-source" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  todayBody: { padding: space.lg, gap: space.sm },
  todayHead: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  todayLink: { flexDirection: "row", alignItems: "center", gap: space.xs, alignSelf: "flex-start", minHeight: size.tapMin, marginTop: space.xxs },
  list: { gap: space.md },
  note: { gap: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
