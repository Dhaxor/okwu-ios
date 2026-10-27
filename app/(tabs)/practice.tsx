// Practice. One primary action, pinned above the tab bar: today's review
// when words are due, else the tone trainer. Above it: the review card (the
// one featured card), the tone trainer and "Say it" (never scored), the
// dictionary's search and its word of the day, and the problems reported.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { DictWordCard, DictionaryLauncher, ReportsSheet, ReviewHero, ToolTile } from "@/components/feature/practice";
import { RealLifeEntry } from "@/components/feature/phrasebook";
import { Ear, Flag, Mic, Repeat } from "@/components/glyphs/icons";
import { Button, Card, Row, Screen, ScreenHeader, Section } from "@/components/ui";
import { space } from "@/constants/theme";
import { deviceCalendar } from "@/lib/game";
import { loadConversations } from "@/lib/phrasebook";
import { usePhrasebook } from "@/lib/phrasebook/hooks";
import { useContent, useLearning } from "@/lib/state";
import { dictionaryWordOfTheDay } from "@/lib/state/dictionary";
import { reviewOverview, speakingSet, toneSets, TRAINER_TRIALS } from "@/lib/state/practice";
import { useDictionary, useDictionaryAudio } from "@/lib/state/useDictionary";
import { useContentReports } from "@/lib/state/useReports";

export default function PracticeScreen() {
  const router = useRouter();
  const { bundle } = useContent();
  const learning = useLearning();
  const dictionary = useDictionary();
  const audio = useDictionaryAudio();
  const { reports, queued } = useContentReports();
  const phrasebook = usePhrasebook();
  const conversations = useMemo(() => loadConversations().conversations.length, []);
  const [reportsOpen, setReportsOpen] = useState(false);
  const now = useMemo(() => new Date(), [learning.progress]); // eslint-disable-line react-hooks/exhaustive-deps

  const overview = useMemo(() => (bundle && learning.ready ? reviewOverview(bundle, learning.progress, learning.scheduler, now) : null), [bundle, learning.ready, learning.progress, learning.scheduler, now]);
  const sets = useMemo(() => (bundle ? toneSets(bundle, learning.progress) : []), [bundle, learning.progress]);
  const speakCount = useMemo(() => (bundle ? speakingSet(bundle, learning.progress, learning.scheduler, now, 1).length : 0), [bundle, learning.progress, learning.scheduler, now]);
  const word = useMemo(() => (dictionary.index ? dictionaryWordOfTheDay(dictionary.index, deviceCalendar.dayKey(new Date())) : null), [dictionary.index]);
  const example = sets[0]?.members.find((m) => m.tones.length > 1);

  const due = overview?.dueWords ?? 0;
  const footer =
    due > 0 ? (
      <Button label="Start today's review" icon={Repeat} onPress={() => router.push("/practice/review")} testID="practice-review" block />
    ) : sets.length > 0 ? (
      <Button label="Train your ear" icon={Ear} onPress={() => router.push("/practice/tones")} testID="practice-train" block />
    ) : undefined;

  return (
    <Screen testID="practice" tabbed footer={footer}>
      <ScreenHeader title="Practice" subtitle="A little every day keeps every word you've learned." testID="practice-header" />

      <ReviewHero overview={overview} now={now} onPress={due > 0 ? () => router.push("/practice/review") : undefined} testID="practice-due" />

      <Section title="Train your ear and voice" testID="practice-tools">
        <View style={styles.tools}>
          <ToolTile
            icon={Ear}
            tint="accent"
            title="Tone trainer"
            meta={sets.length > 0 ? `${TRAINER_TRIALS} short trials · ${sets.length} tone sets` : "Tone sets arrive with the next lessons"}
            detail="Same letters, a different tone, a different word. Learn to hear it."
            tones={example?.tones}
            onPress={() => router.push("/practice/tones")}
            testID="practice-tones"
          />
          <ToolTile
            icon={Mic}
            tint="success"
            title="Say it"
            meta={speakCount > 0 ? `${speakCount} words · never scored` : "Never scored"}
            detail="Speak along with a native voice, privately. You decide how it went."
            onPress={() => router.push("/practice/speak")}
            testID="practice-say"
          />
        </View>
      </Section>

      <Section title="Real-life Igbo" testID="practice-real-life-section">
        <RealLifeEntry
          phrases={phrasebook.index?.size ?? 0}
          situations={phrasebook.index?.situations.length ?? 12}
          conversations={conversations}
          onPhrasebook={() => router.push("/phrasebook")}
          onConversations={() => router.push("/conversations")}
          testID="practice-real-life"
        />
      </Section>

      <Section title="Dictionary" testID="practice-dictionary">
        <DictionaryLauncher size={dictionary.index?.size ?? null} onPress={() => router.push("/practice/dictionary")} testID="practice-search" />
        {word ? <DictWordCard eyebrow="Word of the day" entry={word} audio={audio} onOpen={() => router.push({ pathname: "/practice/dictionary/[id]", params: { id: word.id } })} testID="practice-word" /> : null}
      </Section>

      {reports.length > 0 ? (
        <Card variant="flat" padding="md" testID="practice-reports">
          <Row
            title="Problems you reported"
            detail={queued > 0 ? `${queued} waiting to reach our reviewers` : "All sent to our reviewers"}
            icon={Flag}
            onPress={() => setReportsOpen(true)}
            testID="practice-reports-row"
          />
        </Card>
      ) : null}
      <ReportsSheet visible={reportsOpen} onClose={() => setReportsOpen(false)} testID="practice-reports-sheet" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tools: { gap: space.md },
});
