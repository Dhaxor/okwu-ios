// Omenala, festivals and customs: short, respectful explainers, each with
// dataset words and sentences to hear. All pending cultural-advisor review.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { CustomCard, ReviewTag, SourceNote } from "@/components/feature/library";
import { Card, Screen, ScreenHeader, T } from "@/components/ui";
import { space } from "@/constants/theme";
import { customsFile } from "@/lib/library";

export default function Customs() {
  const router = useRouter();
  const { customs } = customsFile();
  const close = () => (router.canGoBack() ? router.back() : router.replace("/library"));

  return (
    <Screen testID="customs">
      <ScreenHeader eyebrow="Omenala · Customs" title="Festivals and customs" subtitle="What happens, why it matters, and the words you'll hear." onBack={close} testID="customs-header" />

      <Card variant="sunk" testID="customs-intro">
        <View style={styles.note}>
          <T variant="body" tone="muted">
            Igbo customs differ from town to town and family to family. These notes describe common practice with respect and never claim a single right way. When in doubt, ask your elders.
          </T>
          <View style={styles.tags}>
            <ReviewTag kind="draft" testID="customs-review" />
          </View>
        </View>
      </Card>

      <View style={styles.list}>
        {customs.map((c, i) => (
          <CustomCard key={c.id} custom={c} seed={i + 21} onPress={() => router.push({ pathname: "/library/customs/[id]", params: { id: c.id } })} testID={`customs-${i}`} />
        ))}
      </View>

      <SourceNote testID="customs-source" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  note: { gap: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
