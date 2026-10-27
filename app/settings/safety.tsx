// How Okwu keeps people safe, said plainly; the published safety contact
// (Apple 1.2); crisis lines; and the people you blocked, with unblock.
import React, { useCallback, useEffect, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { CrisisLines, PersonRow, StateCard } from "@/components/feature/community";
import { Mail, Scale, ShieldCheck } from "@/components/glyphs/icons";
import { Button, Card, Row, Screen, ScreenHeader, Section, T, useToast } from "@/components/ui";
import { colors, size, space } from "@/constants/theme";
import { attempt, errorMessage, type AccountId } from "@/lib/social";
import { LEGAL_URLS, blockNamesStore, forgetBlocked, useSocial } from "@/lib/state";
import { useBack } from "@/components/feature/shell/useBack";

const PROMISES: readonly string[] = [
  "Nobody can search for you, and there are no private messages between strangers.",
  "No photos or videos: voice notes are audio only, inside a Family Circle you were invited to.",
  "Under 18s and adults never share a cohort or a club. An adult can only connect with a teen inside a shared Family Circle.",
  "A parent or guardian says yes before a teen sends voice notes.",
  "Phone numbers, links and other apps are hidden. Talk about money, and requests for secrets, photos or meet-ups, are blocked.",
  "Report, block and mute are on every name, note, reaction and message. A moderator acts on every report within 24 hours.",
  "We have zero tolerance for abuse, scams and anyone targeting young people: accounts are removed and serious cases reported to the authorities.",
];

export default function SafetyScreen() {
  const router = useRouter();
  const back = useBack("/settings");
  const toast = useToast();
  const social = useSocial();
  const [blocked, setBlocked] = useState<AccountId[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setNames(await blockNamesStore.load());
    if (!social.can("friends-by-code")) return setBlocked([]);
    const r = await attempt(social.client.friends());
    setBlocked(r.ok ? r.value.blocked : null);
  }, [social]);

  useEffect(() => {
    void load();
  }, [load, social.rev]);

  const unblock = async (id: AccountId) => {
    const r = await attempt(social.client.unblock(id));
    if (!r.ok) return toast.show(errorMessage(r.error), { tone: "warning" });
    void forgetBlocked(id);
    social.bump();
    toast.show("Unblocked.", { tone: "success" });
  };

  return (
    <Screen testID="safety-screen">
      <ScreenHeader eyebrow="Safety and help" title="How we keep Okwu safe" onBack={back} testID="safety-header" />

      <Card variant="flat" testID="safety-promises">
        <View style={styles.list}>
          {PROMISES.map((p, i) => (
            <View key={i} style={styles.item}>
              <View style={styles.bullet}>
                <ShieldCheck size={size.iconSm} color={colors.success} strokeWidth={2} />
              </View>
              <T variant="body" tone="secondary" style={styles.flex}>
                {p}
              </T>
            </View>
          ))}
        </View>
      </Card>

      <Section title="Contact us" testID="safety-contact">
        <Card variant="flat" padding="md">
          <Row title="Email our safety team" detail={social.config.contact} icon={Mail} onPress={() => void Linking.openURL(`mailto:${social.config.contact}`).catch(() => toast.show(social.config.contact))} testID="safety-email" divider />
          <Row title="Community Rules" icon={ShieldCheck} onPress={() => void Linking.openURL(LEGAL_URLS["community-rules"]).catch(() => {})} testID="safety-rules" divider />
          <Row title="Appeals" detail="If a moderator paused your account" icon={Scale} onPress={() => router.push("/settings/appeals")} testID="safety-appeals" />
        </Card>
        <T variant="caption">To report something, use “…” or hold it, wherever you see it in Okwu. Reports are private.</T>
      </Section>

      <CrisisLines />

      <Section title="People you blocked" testID="safety-blocked">
        {blocked === null ? (
          <StateCard kind="offline" title="This needs a connection" action={{ label: "Try again", onPress: () => void load(), testID: "safety-blocked-retry" }} testID="safety-blocked-offline" />
        ) : blocked.length === 0 ? (
          <T variant="caption">Nobody. When you block someone, they appear here.</T>
        ) : (
          <Card variant="flat" padding="md">
            {blocked.map((id, i) => (
              <PersonRow key={id} id={id} name={names[id] ?? "Someone you blocked"} trailing={<Button label="Unblock" size="sm" variant="secondary" onPress={() => void unblock(id)} testID={`safety-unblock-${i}`} />} divider={i < blocked.length - 1} testID={`safety-blocked-${i}`} />
            ))}
          </Card>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  item: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  bullet: { paddingTop: 3 },
  flex: { flex: 1 },
});
