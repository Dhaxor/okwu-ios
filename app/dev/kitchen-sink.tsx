// Kitchen sink: every primitive and motif in every state. Development only.
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AkweteBand, Nnenne, OkwuMark, PitchLine, UliDivider, UliField } from "@/components/art";
import { DraftTag } from "@/components/feature/shell/DraftTag";
import { ArrowRight, Bell, Flag, Headphones, Plus, Settings, Sparkles, Volume2 } from "@/components/glyphs/icons";
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  IconButton,
  IgboKeyStrip,
  ProgressBar,
  Row,
  Screen,
  ScreenHeader,
  Section,
  Segmented,
  Sheet,
  Switch,
  T,
  TextField,
  useConfirm,
  useIgboInput,
  useToast,
} from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { HARMONY_EXAMPLE, TONE_SET } from "@/lib/content/draftSamples";

const SWATCHES: { name: string; color: string; on?: boolean }[] = [
  { name: "Paper", color: colors.bg },
  { name: "Surface", color: colors.surface },
  { name: "Sunk", color: colors.surfaceSunk },
  { name: "Ink", color: colors.ink, on: true },
  { name: "Camwood", color: colors.accent, on: true },
  { name: "Ochre", color: colors.reward },
  { name: "Leaf", color: colors.success, on: true },
  { name: "Oxblood", color: colors.danger, on: true },
];

export default function KitchenSink() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const igbo = useIgboInput("");
  const [name, setName] = useState("");
  const [chips, setChips] = useState<string[]>(["family"]);
  const [seg, setSeg] = useState<"words" | "phrases" | "stories">("words");
  const [on, setOn] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [inner, setInner] = useState(false);
  const [loading, setLoading] = useState(false);
  // The ProgressBar regression: beads that switch to a continuous bar mid-session must still fill.
  const [beadsToBar, setBeadsToBar] = useState(true);

  const toggleChip = (c: string) => setChips((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <Screen testID="kitchen-sink">
      <ScreenHeader eyebrow="Okwu design system" title="Kitchen sink" subtitle="Uli: cream paper, indigo ink, earth accents." onBack={() => router.back()} testID="ks-header" />

      <Section title="Colour" testID="ks-colour">
        <View style={styles.swatches}>
          {SWATCHES.map((s) => (
            <View key={s.name} style={styles.swatchCell}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <T variant="caption">{s.name}</T>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Type" testID="ks-type">
        <Card>
          <T variant="display">Display 32 · Gentium</T>
          <T variant="title">Title 22 · Gentium</T>
          <T variant="body">Body 17 · Andika, for the interface and English glosses.</T>
          <T variant="caption">Caption 13 · Andika, for small print.</T>
          <T variant="label">Label · Andika Bold</T>
          <View style={styles.rule} />
          <T variant="display" igbo>
            {TONE_SET.map((w) => w.text).join(" ")}
          </T>
          <T variant="body" igbo>
            {HARMONY_EXAMPLE}
          </T>
          <T variant="caption" igbo>
            ị́ ọ̀ ụ̄ Ị́ Ọ̀ Ụ̄ ṅ ǹ m̀
          </T>
        </Card>
      </Section>

      <Section title="Buttons" testID="ks-buttons">
        <Button label="Primary action" onPress={() => toast.show("Primary pressed")} testID="ks-btn-primary" block />
        <Button label="Secondary" variant="secondary" icon={Plus} onPress={() => toast.show("Secondary pressed")} testID="ks-btn-secondary" block />
        <View style={styles.row}>
          <Button label="Ghost" variant="ghost" onPress={() => {}} testID="ks-btn-ghost" />
          <Button label="Delete" variant="danger" size="md" onPress={() => {}} testID="ks-btn-danger" />
          <Button label="Small" size="sm" variant="secondary" icon={ArrowRight} iconPosition="trailing" onPress={() => {}} testID="ks-btn-sm" />
        </View>
        <View style={styles.row}>
          <Button
            label="Load"
            size="md"
            loading={loading}
            onPress={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1200);
            }}
            testID="ks-btn-loading"
          />
          <Button label="Disabled" size="md" disabled onPress={() => {}} testID="ks-btn-disabled" />
        </View>
        <View style={styles.row}>
          <IconButton icon={Volume2} accessibilityLabel="Play" onPress={() => {}} testID="ks-icon-plain" />
          <IconButton icon={Headphones} accessibilityLabel="Slow audio" variant="tinted" onPress={() => {}} testID="ks-icon-tinted" />
          <IconButton icon={Sparkles} accessibilityLabel="Reveal tones" variant="ink" onPress={() => {}} testID="ks-icon-ink" />
          <IconButton icon={Settings} accessibilityLabel="Settings" variant="tinted" disabled onPress={() => {}} testID="ks-icon-disabled" />
        </View>
      </Section>

      <Section title="Cards" testID="ks-cards">
        <Card variant="ink" padding="none">
          <AkweteBand height={24} />
          <View style={styles.pad}>
            <T variant="label" tone="onInkMuted">
              Ink card
            </T>
            <T variant="title" tone="onInk">
              The one featured thing on a screen
            </T>
          </View>
        </Card>
        <Card onPress={() => toast.show("Card pressed")} testID="ks-card-raised" accessibilityLabel="Raised card">
          <T variant="title">Raised</T>
          <T variant="body" tone="muted">
            Paper lifted off paper. Tap me.
          </T>
        </Card>
        <View style={styles.row}>
          <Card variant="flat" style={styles.flex}>
            <T variant="body" tone="primary">
              Flat
            </T>
            <T variant="caption">Hairline, no shadow</T>
          </Card>
          <Card variant="sunk" style={styles.flex}>
            <T variant="body" tone="primary">
              Sunk
            </T>
            <T variant="caption">A quiet well</T>
          </Card>
        </View>
      </Section>

      <Section title="Chips" testID="ks-chips">
        <View style={styles.wrap}>
          {["family", "market", "greetings", "food"].map((c) => (
            <Chip key={c} label={c[0]!.toUpperCase() + c.slice(1)} selected={chips.includes(c)} onPress={() => toggleChip(c)} testID={`ks-chip-${c}`} />
          ))}
        </View>
        <View style={styles.wrap}>
          <Chip label="Neutral" testID="ks-tag-neutral" />
          <Chip label="New" tone="accent" icon={Sparkles} testID="ks-tag-accent" />
          <Chip label="Learned" tone="success" testID="ks-tag-success" />
          <DraftTag testID="ks-tag-draft" />
        </View>
      </Section>

      <Section title="Inputs" testID="ks-inputs">
        <TextField label="Your name" value={name} onChangeText={setName} placeholder="What should Nnenne call you?" hint="Only you and your family see this." testID="ks-field-name" />
        <TextField igbo label="Type it in Igbo" {...igbo.field} placeholder="Tap the keys below" testID="ks-field-igbo" />
        <IgboKeyStrip {...igbo.strip} testID="ks-keys" />
        <TextField label="With an error" value="ab" onChangeText={() => {}} error="Use at least 3 letters." testID="ks-field-error" />
      </Section>

      <Section title="Controls" testID="ks-controls">
        <Segmented
          options={[
            { value: "words", label: "Words" },
            { value: "phrases", label: "Phrases" },
            { value: "stories", label: "Stories" },
          ]}
          value={seg}
          onChange={setSeg}
          testID="ks-segmented"
          accessibilityLabel="Content type"
        />
        <Card variant="flat" padding="md">
          <Row title="Reminders" detail="At most one a day, never guilt." icon={Bell} testID="ks-row-switch" trailing={<Switch value={on} onValueChange={setOn} accessibilityLabel="Reminders" testID="ks-switch" />} divider />
          <Row title="A row that navigates" detail="With a chevron" icon={Flag} testID="ks-row-nav" onPress={() => toast.show("Row pressed")} />
        </Card>
        <ProgressBar value={0.62} accessibilityLabel="Unit progress" testID="ks-progress" />
        <ProgressBar value={0.4} tone="success" accessibilityLabel="Garden" />
        <ProgressBar value={3 / 8} steps={8} tone="ink" accessibilityLabel="Lesson 3 of 8" />
        <View style={styles.row}>
          <View style={styles.flex}>
            <ProgressBar
              value={beadsToBar ? 4 / 10 : 5 / 12}
              steps={beadsToBar ? 10 : undefined}
              accessibilityLabel={beadsToBar ? "Exercise 4 of 10, as beads" : "Exercise 5 of 12, as a bar"}
              testID="ks-progress-switch"
            />
          </View>
          <Button label={beadsToBar ? "To bar" : "To beads"} size="sm" variant="secondary" onPress={() => setBeadsToBar((b) => !b)} testID="ks-progress-switch-toggle" />
        </View>
      </Section>

      <Section title="Overlays" testID="ks-overlays">
        <View style={styles.row}>
          <Button label="Open sheet" size="md" variant="secondary" onPress={() => setSheet(true)} testID="ks-open-sheet" />
          <Button
            label="Confirm"
            size="md"
            variant="secondary"
            onPress={async () => {
              const ok = await confirm({ title: "Leave this lesson?", message: "Your progress in this lesson is kept.", confirmLabel: "Leave", cancelLabel: "Keep going" });
              toast.show(ok ? "Left the lesson" : "Kept going", { tone: ok ? "neutral" : "success" });
            }}
            testID="ks-open-confirm"
          />
        </View>
        <View style={styles.row}>
          <Button label="Toast" size="sm" variant="secondary" onPress={() => toast.show("Saved to your words")} testID="ks-toast-neutral" />
          <Button label="Success" size="sm" variant="secondary" onPress={() => toast.show("Lesson complete", { tone: "success" })} testID="ks-toast-success" />
          <Button label="Warning" size="sm" variant="secondary" onPress={() => toast.show("You are offline; we will sync later", { tone: "warning" })} testID="ks-toast-warning" />
          <Button label="Error" size="sm" variant="secondary" onPress={() => toast.show("Could not load audio", { tone: "error" })} testID="ks-toast-error" />
        </View>
      </Section>

      <Section title="Motifs" testID="ks-motifs">
        <Card padding="md">
          <UliDivider seed={1} height={40} />
          <UliDivider seed={7} height={28} opacity={0.6} />
        </Card>
        <AkweteBand height={32} />
        <AkweteBand height={24} variant="teeth" ground="paper" />
        <Card variant="sunk" style={styles.field}>
          <UliField seed={4} />
          <T variant="caption" center>
            Uli field
          </T>
        </Card>
        <Card>
          <T variant="label">Pitch lines</T>
          <View style={styles.pitchGrid}>
            {TONE_SET.map((w) => (
              <View key={w.text} style={styles.pitchCell}>
                <PitchLine tones={w.tones} syllables={w.syllables} height={44} />
                <T variant="caption" center>
                  {w.gloss}
                </T>
              </View>
            ))}
          </View>
          <PitchLine
            tones={["L", "H", "D", "H", "L"]}
            height={56}
            overlay={[
              { x: 0.05, y: 0.82 },
              { x: 0.3, y: 0.2 },
              { x: 0.5, y: 0.45 },
              { x: 0.7, y: 0.5 },
              { x: 0.95, y: 0.85 },
            ]}
            accessibilityLabel="Low, high, downstep, high, low, with a learner overlay"
          />
          <T variant="caption">Downstep lowers every high after it. Dashed: a learner's pitch (words and short phrases only).</T>
        </Card>
        <View style={styles.nnenneRow}>
          <Nnenne size={88} ground="ochre" />
          <Nnenne size={88} ground="paper" mood="glad" />
          <View style={[styles.inkWell]}>
            <Nnenne size={80} ground="ink" />
          </View>
        </View>
        <View style={styles.markRow}>
          <OkwuMark size={56} />
          <View style={styles.markInk}>
            <OkwuMark size={48} onInk />
          </View>
          <T variant="display">Okwu</T>
        </View>
      </Section>

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        testID="ks-sheet"
        title="A sheet"
        subtitle="Rises from the bottom, keeps actions in the thumb zone."
        footer={
          <>
            <Button label="Confirm inside" onPress={() => setInner(true)} testID="ks-sheet-inner" block />
            <Button label="Toast from the sheet" variant="secondary" onPress={() => toast.show("Toasts draw above the sheet", { tone: "success" })} testID="ks-sheet-toast" block />
            <Button label="Close" variant="ghost" onPress={() => setSheet(false)} testID="ks-sheet-close" block />
          </>
        }
      >
        <Card variant="sunk" padding="md">
          <T variant="body">Sheets host their own toasts, and a confirm opened inside a sheet is nested in it.</T>
        </Card>
        <ConfirmSheet
          visible={inner}
          title="Report this message?"
          message="A moderator reviews every report within 24 hours."
          confirmLabel="Report"
          destructive
          onConfirm={() => {
            setInner(false);
            toast.show("Reported. Thank you.", { tone: "success" });
          }}
          onCancel={() => setInner(false)}
          testID="ks-inner-confirm"
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  swatchCell: { width: 72, gap: space.xxs },
  swatch: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairline },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong, marginVertical: space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  flex: { flex: 1 },
  pad: { padding: space.lg, gap: space.xxs },
  field: { height: 120, justifyContent: "flex-end" },
  pitchGrid: { flexDirection: "row", flexWrap: "wrap", marginVertical: space.sm },
  pitchCell: { width: "50%", paddingHorizontal: space.xs, paddingBottom: space.md },
  nnenneRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inkWell: { backgroundColor: colors.ink, borderRadius: radius.pill, padding: space.xxs },
  markRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  markInk: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: space.xxs },
});
