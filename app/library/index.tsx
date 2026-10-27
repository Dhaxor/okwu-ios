// The library hub. Today's market day is the one featured (ink) card; below
// it, four shelves (names, proverbs, tales, customs), the proverb of the day,
// the learner's own family names, and where everything comes from. Every
// Igbo string is dataset text; our English is marked pending review.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { PlayButton, ShelfTile, SourceNote, TodayCard } from "@/components/feature/library";
import { BookOpen, Info, Star } from "@/components/glyphs/icons";
import { Card, Chip, Press, Row, Screen, ScreenHeader, Section, T } from "@/components/ui";
import { colors, size, space } from "@/constants/theme";
import { calendarFile, customsFile, libraryMeta, namesFile, proverbOfTheDay, proverbsFile, talesFile } from "@/lib/library";
import { useFamilyNames, useLibraryAudio, useTodayInIzu } from "@/lib/library/useLibrary";

export default function LibraryHub() {
  const router = useRouter();
  const audio = useLibraryAudio();
  const izu = useTodayInIzu();
  const family = useFamilyNames();
  const meta = libraryMeta();
  const day = calendarFile().days.find((d) => d.id === izu.day);
  const proverb = proverbOfTheDay(proverbsFile().proverbs, izu.today);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <Screen testID="library">
      <ScreenHeader
        eyebrow="Library"
        title="Culture and heritage"
        subtitle="Names, proverbs, tales and customs, with Igbo voices you can hear."
        onBack={close}
        testID="library-header"
      />

      {day ? <TodayCard day={day} verified={izu.verified} audio={audio} onPress={() => router.push("/library/calendar")} testID="library-today" /> : null}

      <View style={styles.shelves} testID="library-shelves">
        <View style={styles.shelfRow}>
          <ShelfTile igbo="Aha" title="Names" detail={`${namesFile().names.length} with meanings`} motif="circle" seed={3} onPress={() => router.push("/library/names")} testID="library-names" />
          <ShelfTile igbo="Ilu" title="Proverbs" detail={`${proverbsFile().proverbs.length} with recordings`} motif="spiral" seed={5} onPress={() => router.push("/library/proverbs")} testID="library-proverbs" />
        </View>
        <View style={styles.shelfRow}>
          <ShelfTile igbo="Akụkọ" title="Folktales" detail={`${talesFile().tales.length} tales retold`} motif="feathers" seed={2} onPress={() => router.push("/library/tales")} testID="library-tales" />
          <ShelfTile igbo="Omenala" title="Customs" detail={`${customsFile().customs.length} explainers`} motif="yam" seed={4} onPress={() => router.push("/library/customs")} testID="library-customs" />
        </View>
      </View>

      {proverb ? (
        <Section title="Proverb of the day" testID="library-proverb">
          <Card padding="none">
            <View style={styles.proverb}>
              <View style={styles.flex}>
                <T variant="title" igbo>
                  {proverb.igbo}
                </T>
                <T variant="body" tone="muted">
                  {proverb.en}
                </T>
              </View>
              <PlayButton id={proverb.audio} audio={audio} label={`Play the proverb: ${proverb.en}`} playKey={`hub-proverb-${proverb.id}`} testID="library-proverb-play" />
            </View>
            <Press
              testID="library-proverb-open"
              onPress={() => router.push({ pathname: "/library/proverbs/[id]", params: { id: proverb.id } })}
              pressScale={1}
              haptics="select"
              accessibilityLabel="What it means and when it's used"
              style={styles.proverbFoot}
            >
              <BookOpen size={size.iconSm} color={colors.accent} strokeWidth={2} />
              <T variant="caption" strong tone="accent">
                What it means and when it's used
              </T>
            </Press>
          </Card>
        </Section>
      ) : null}

      {family.list.length > 0 ? (
        <Section title="Your family's names" testID="library-family">
          <View style={styles.chips}>
            {family.list.slice(0, 8).map((f, i) => (
              <Chip
                key={f.id}
                label={f.name}
                igbo
                icon={Star}
                onPress={() => (f.bookId ? router.push({ pathname: "/library/names/[id]", params: { id: f.bookId } }) : router.push("/library/names"))}
                testID={`library-family-${i}`}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="About this library" testID="library-about-section">
        <Card variant="flat" padding="md">
          <Row
            title="Where this comes from"
            detail="Sources, credits and what is still being reviewed"
            icon={Info}
            onPress={() => router.push("/library/about")}
            testID="library-about"
          />
        </Card>
      </Section>

      <SourceNote text={meta.credits[0]} testID="library-source" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shelves: { gap: space.md },
  shelfRow: { flexDirection: "row", gap: space.md },
  proverb: { flexDirection: "row", alignItems: "flex-start", gap: space.md, padding: space.lg, paddingBottom: space.md },
  proverbFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: size.tapMin + space.xs,
    paddingHorizontal: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineStrong,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
