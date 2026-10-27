// Start a Family Circle, or join one with the invite code a relative shared.
// Codes travel only out of band (a message, a call): nobody can find a
// circle by searching. A circle holds up to 12 people.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { HeartHandshake, UserPlus } from "@/components/glyphs/icons";
import { Button, Card, Chip, Screen, ScreenHeader, Section, Segmented, T, TextField, useToast } from "@/components/ui";
import { space } from "@/constants/theme";
import { attempt, errorMessage, FILTER_MESSAGES, type Relation } from "@/lib/social";
import { RELATIONS, RELATION_LABELS, cleanCode, nameFeedback, useSocial } from "@/lib/state";
import { useBack } from "@/components/feature/shell/useBack";

type Mode = "create" | "join";

export default function NewCircleScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const back = useBack("/community");
  const toast = useToast();
  const social = useSocial();
  const [mode, setMode] = useState<Mode>(params.mode === "join" ? "join" : "create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [relation, setRelation] = useState<Relation | null>(null);
  const [busy, setBusy] = useState(false);
  const nameCheck = useMemo(() => nameFeedback(name, 30), [name]);
  const cleaned = cleanCode(code);
  const codeOk = /^[A-Z2-9]{10}$/.test(cleaned);

  const submit = async () => {
    setBusy(true);
    const r = mode === "create" ? await attempt(social.client.createCircle(name.trim())) : await attempt(social.client.joinCircle(cleaned, relation ?? undefined));
    setBusy(false);
    if (!r.ok) {
      const e = r.error;
      const msg =
        e.code === "filtered" && e.reason ? FILTER_MESSAGES[e.reason] : e.code === "not-found" ? "That code didn't work. Check it with the person who sent it." : e.code === "closed" ? "That code has expired. Ask for a new one." : e.code === "full" ? "That circle is full (12 people)." : e.code === "limit" ? "You can be in up to 5 circles." : errorMessage(e);
      return toast.show(msg, { tone: "warning" });
    }
    social.bump();
    toast.show(mode === "create" ? "Your circle is ready. Invite your family." : `Welcome to ${r.value.name}.`, { tone: "success" });
    router.replace({ pathname: "/community/circle/[id]", params: { id: r.value.id } });
  };

  const ready = mode === "create" ? !!name.trim() && nameCheck.ok : codeOk;

  return (
    <Screen
      testID="circle-new"
      keyboard
      footer={<Button label={mode === "create" ? "Start the circle" : "Join the circle"} icon={mode === "create" ? HeartHandshake : UserPlus} onPress={() => void submit()} disabled={!ready} loading={busy} testID="circle-new-submit" block />}
    >
      <ScreenHeader eyebrow="Family Circle" title={mode === "create" ? "Start a circle" : "Join a circle"} subtitle="Invite only. Relatives record greetings, words and stories for you." onBack={back} testID="circle-new-header" />
      <Segmented<Mode>
        options={[
          { value: "create", label: "Start one" },
          { value: "join", label: "I have a code" },
        ]}
        value={mode}
        onChange={setMode}
        testID="circle-new-mode"
        accessibilityLabel="Start or join a circle"
      />
      {mode === "create" ? (
        <Card variant="flat" testID="circle-new-create">
          <TextField
            label="Name your circle"
            value={name}
            onChangeText={setName}
            placeholder="The Okafor family"
            maxLength={40}
            error={nameCheck.ok ? undefined : nameCheck.message}
            hint="Everyone you invite sees this name."
            testID="circle-new-name"
          />
          <T variant="caption" style={styles.after}>
            You'll be the keeper: you get the invite code, and you can remove people. Up to 12 people.
          </T>
        </Card>
      ) : (
        <View style={styles.gap}>
          <Card variant="flat" testID="circle-new-join">
            <TextField
              label="Invite code"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={14}
              placeholder="10 letters and numbers"
              hint={code && !codeOk ? "Invite codes have 10 letters and numbers." : "The person who invited you has it."}
              testID="circle-new-code"
            />
          </Card>
          <Section title="How are you related? (optional)" testID="circle-new-relation">
            <View style={styles.chips}>
              {RELATIONS.map((r) => (
                <Chip key={r} label={RELATION_LABELS[r]} selected={relation === r} onPress={() => setRelation(relation === r ? null : r)} testID={`circle-new-relation-${r}`} />
              ))}
            </View>
          </Section>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.xl },
  after: { marginTop: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
