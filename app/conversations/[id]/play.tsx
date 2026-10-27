// A practice run through a conversation, in one of three ways:
//   listen   every line plays in turn, hands-free (pause or skip at any time)
//   role     the others' lines play; on yours, hear the native line, shadow it
//            (record and replay on iPhone), then "Not yet" or "Matched"
//   recall   on your lines you see only the English: say the Igbo from memory,
//            reveal and hear it, then "Not yet" or "Matched"
// Self-assessed only: no score, no percentage. The end names the lines you
// marked "not yet" so you can try them again. The flag in the top bar reports
// a line whose Igbo has been shown (it holds a hands-free run while open).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Nnenne } from "@/components/art";
import { Bubble, MODE_COPY, PracticeEnd, YourLinePanel } from "@/components/feature/conversations";
import { ReportSheet, type ReportTarget } from "@/components/feature/practice";
import { Eye, Flag, Pause, Play, RotateCcw, SkipForward, X } from "@/components/glyphs/icons";
import { Button, IconButton, ProgressBar, Screen, T } from "@/components/ui";
import { space } from "@/constants/theme";
import {
  advance,
  conversationById,
  conversationsVersion,
  currentIndex,
  igboVisible,
  isMine,
  isPracticeMode,
  markLine,
  readingMs,
  reveal,
  roleName,
  startPlayer,
  stepOf,
  summaryOf,
  type PlayerState,
  type PracticeMode,
} from "@/lib/phrasebook";
import { playable, usePhraseAudio, usePracticeLog } from "@/lib/phrasebook/hooks";
import { useVoiceRecorder } from "@/lib/state";
import { conversationLineSubjects, reportableLines } from "@/lib/state/reportTargets";

/** How long a listening line may take to start playing before the run moves on without it. */
const START_GRACE_MS = 6000;
/** A breath between one speaker and the next. */
const BETWEEN_LINES_MS = 650;

export default function ConversationPlay() {
  const params = useLocalSearchParams<{ id: string; mode?: string; role?: string }>();
  const router = useRouter();
  const conversation = useMemo(() => (params.id ? conversationById(params.id) : null), [params.id]);
  const mode: PracticeMode = isPracticeMode(params.mode) ? params.mode : "role";
  const audio = usePhraseAudio();
  const recorder = useVoiceRecorder();
  const practice = usePracticeLog();
  const [s, setS] = useState<PlayerState | null>(() => (conversation ? startPlayer(conversation, mode, params.role) : null));
  const [paused, setPaused] = useState(false);
  // The lines offered when the report sheet opened (fixed while it is open).
  const [reporting, setReporting] = useState<ReportTarget[] | null>(null);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const started = useRef<string | null>(null);
  const logged = useRef(false);

  const close = () => {
    audio.stop();
    if (router.canGoBack()) router.back();
    else router.replace("/conversations");
  };

  const keyOf = (i: number) => `conv-${conversation?.id ?? ""}-${i}`;
  const step = conversation && s ? stepOf(conversation, s) : "end";
  const i = s ? currentIndex(s) : 0;
  const line = conversation?.lines[i];

  // A new line (or a reveal): play what should play, and arm the hands-free timers.
  useEffect(() => {
    if (!conversation || !s || s.done || !line) return;
    if (step === "recall-prompt") {
      recorder.reset();
      return;
    }
    if (step === "self") {
      if (!s.revealed) recorder.reset();
      audio.play(line.audio, keyOf(i));
      return;
    }
    // "listen": someone else's line, or listening mode.
    if (paused) return;
    started.current = null;
    const kind = audio.play(line.audio, keyOf(i));
    const move = () => setS((cur) => (cur && !cur.done && currentIndex(cur) === i ? advance(conversation, cur) : cur));
    const t = setTimeout(
      () => {
        if (!playable(kind) || started.current !== keyOf(i)) move();
      },
      playable(kind) ? START_GRACE_MS : readingMs(line)
    );
    return () => clearTimeout(t);
  }, [s?.shown, s?.revealed, s?.done, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  // A listening line's clip finished: a breath, then the next line.
  useEffect(() => {
    if (!conversation || !s || s.done || step !== "listen" || paused) return;
    const key = keyOf(i);
    if (audio.current !== key) return;
    if (audio.playing) started.current = key;
    // Advance when the clip has played to its end; `playing` alone flickers while a clip loads.
    if (audio.finished !== key) return;
    const t = setTimeout(() => setS((cur) => (cur && !cur.done && currentIndex(cur) === i ? advance(conversation, cur) : cur)), BETWEEN_LINES_MS);
    return () => clearTimeout(t);
  }, [audio.playing, audio.current, audio.finished, s, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  // The end: remember that you practised this one (for the list), once.
  useEffect(() => {
    if (!conversation || !s?.done || logged.current) return;
    logged.current = true;
    audio.stop();
    scroll.current?.scrollTo({ y: 0, animated: false });
    practice.record(conversation.id, mode);
  }, [s?.done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!conversation || !s) {
    return (
      <Screen testID="play-missing" center footer={<Button label="All conversations" onPress={close} testID="play-missing-back" block />}>
        <View style={styles.center}>
          <Nnenne size={112} ground="paper" />
          <T variant="title" center>
            We couldn't find this conversation
          </T>
        </View>
      </Screen>
    );
  }

  const total = conversation.lines.length;
  const me = roleName(conversation, s.role);
  const label = mode === "listen" ? MODE_COPY.listen.title : `${MODE_COPY[mode].title} · ${me}`;

  const stopRecording = async () => {
    if (recorder.state === "recording") await recorder.stop();
  };
  const decide = async (matched: boolean) => {
    await stopRecording();
    audio.stop();
    setS((cur) => (cur ? markLine(conversation, cur, matched ? "matched" : "not-yet") : cur));
  };
  const next = () => {
    audio.stop();
    setS((cur) => (cur ? advance(conversation, cur) : cur));
  };
  const replay = (n: number) => {
    const l = conversation.lines[n];
    if (!l) return;
    // Hearing a line again holds the hands-free run, so it never talks over you.
    if (step === "listen") setPaused(true);
    if (audio.playing && audio.current === keyOf(n)) audio.stop();
    else audio.play(l.audio, keyOf(n));
  };
  const reportable = reportableLines(s.shown, total, (n) => igboVisible(conversation, s, n), s.done);
  const report = () => {
    if (step === "listen" && !paused) {
      setPaused(true);
      audio.stop();
    }
    setReporting(conversationLineSubjects(conversation, reportable, conversationsVersion()));
  };
  const again = () => {
    logged.current = false;
    started.current = null;
    setPaused(false);
    setS(startPlayer(conversation, mode, s.role));
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  let footer: React.ReactNode;
  if (step === "end") {
    footer = (
      <>
        <Button label="Practise again" icon={RotateCcw} onPress={again} testID="play-again" block />
        <Button label={mode === "listen" ? "Now take a part" : "Back to the conversation"} variant="ghost" onPress={() => (mode === "listen" ? router.replace({ pathname: "/conversations/[id]/play", params: { id: conversation.id, mode: "role", role: s.role } }) : close())} testID="play-done" block />
      </>
    );
  } else if (step === "recall-prompt") {
    footer = <Button label="Reveal and hear it" icon={Eye} onPress={() => setS((cur) => (cur ? reveal(cur) : cur))} testID="play-reveal" block />;
  } else if (step === "self") {
    footer = (
      <View style={styles.pair}>
        <Button label="Not yet" variant="secondary" onPress={() => void decide(false)} testID="play-not-yet" style={styles.flex} />
        <Button label="Matched" onPress={() => void decide(true)} testID="play-matched" style={styles.flex} />
      </View>
    );
  } else {
    footer = (
      <View style={styles.pair}>
        <Button
          label={paused ? "Continue" : "Pause"}
          icon={paused ? Play : Pause}
          variant="secondary"
          onPress={() => {
            if (paused) setPaused(false);
            else {
              setPaused(true);
              audio.stop();
            }
          }}
          testID="play-pause"
          style={styles.flex}
        />
        <Button label="Next line" icon={SkipForward} iconPosition="trailing" onPress={next} testID="play-next" style={styles.flex} />
      </View>
    );
  }

  return (
    <Screen testID="play" scroll={false} footer={footer}>
      <View style={styles.top}>
        <View style={styles.bar}>
          <IconButton icon={X} accessibilityLabel="Leave the conversation" onPress={close} variant="tinted" testID="play-close" />
          <View style={styles.flex}>
            <ProgressBar value={s.done ? 1 : s.shown / total} accessibilityLabel={`Line ${Math.min(s.shown, total)} of ${total}`} testID="play-progress" />
          </View>
          <T variant="caption" numeric testID="play-count">{`${Math.min(s.shown, total)}/${total}`}</T>
          {reportable.length > 0 ? <IconButton icon={Flag} accessibilityLabel="Report a problem" onPress={report} variant="tinted" testID="play-report" /> : null}
        </View>
        <T variant="label" tone="accent" testID="play-mode">
          {label}
        </T>
        <T variant="title" accessibilityRole="header">
          {conversation.title}
        </T>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.thread}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (!s.done) scroll.current?.scrollToEnd({ animated: true });
        }}
        testID="play-scroll"
      >
        {s.done ? (
          <PracticeEnd summary={summaryOf(conversation, s)} conversation={conversation} roleName={me} testID="play-end" />
        ) : (
          <>
            {conversation.lines.slice(0, s.shown).map((l, n) => (
              <Bubble
                key={n}
                line={l}
                who={roleName(conversation, l.role)}
                mine={isMine(conversation, s, n)}
                right={l.role === (mode === "listen" ? conversation.learnerRole : s.role)}
                current={n === i}
                showIgbo={igboVisible(conversation, s, n)}
                clip={audio.availability(l.audio)}
                playing={audio.playing && audio.current === keyOf(n)}
                onPlay={() => replay(n)}
                testID={`play-line-${n}`}
              />
            ))}
            {step === "self" || step === "recall-prompt" ? (
              <YourLinePanel
                recall={mode === "recall"}
                revealed={s.revealed}
                clip={audio.availability(line?.audio)}
                nativePlaying={audio.playing && audio.current === keyOf(i)}
                onHear={() => line && audio.play(line.audio, keyOf(i))}
                recorder={recorder}
                onRecord={() => {
                  audio.stop();
                  void (recorder.state === "recording" ? recorder.stop() : recorder.start());
                }}
                onPlayMine={() => recorder.uri && audio.playMine(recorder.uri, `${keyOf(i)}-mine`)}
                testID="play-yours"
              />
            ) : null}
          </>
        )}
      </ScrollView>

      <ReportSheet visible={reporting !== null} onClose={() => setReporting(null)} targets={reporting ?? []} testID="play-report-sheet" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", gap: space.md },
  top: { gap: space.xs },
  bar: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xs },
  thread: { gap: space.sm, paddingBottom: space.xl },
  pair: { flexDirection: "row", gap: space.sm },
});
