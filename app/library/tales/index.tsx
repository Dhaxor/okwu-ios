// Akụkọ, folktales: Okwu's own English retellings of well-known tales, with
// Igbo lines from the dataset you can hear. Mbe the tortoise appears here
// only, as the trickster of the tales.
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ReviewTag, SourceNote, TaleCard } from "@/components/feature/library";
import { Card, Screen, ScreenHeader, T } from "@/components/ui";
import { space } from "@/constants/theme";
import { talesFile } from "@/lib/library";

export default function Tales() {
  const router = useRouter();
  const { tales } = talesFile();
  const close = () => (router.canGoBack() ? router.back() : router.replace("/library"));

  return (
    <Screen testID="tales">
      <ScreenHeader eyebrow="Akụkọ · Folktales" title="Tales by the fire" subtitle="Well-known Igbo tales, retold in English with Igbo lines you can hear." onBack={close} testID="tales-header" />

      <View style={styles.list}>
        {tales.map((t, i) => (
          <TaleCard key={t.id} tale={t} seed={i + 11} onPress={() => router.push({ pathname: "/library/tales/[id]", params: { id: t.id } })} testID={`tales-${i}`} />
        ))}
      </View>

      <Card variant="sunk" testID="tales-about">
        <View style={styles.note}>
          <T variant="title">About these tellings</T>
          <T variant="body" tone="muted">
            Every tale here is told many ways across Igboland. These are Okwu's own retellings of the traditional stories, not copies of any published version. The Igbo lines come from the Nkọwa okwu dataset, each with its recording. A full telling in Igbo will come from a native storyteller.
          </T>
          <View style={styles.tags}>
            <ReviewTag kind="draft" testID="tales-review" />
          </View>
        </View>
      </Card>

      <SourceNote testID="tales-source" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  note: { gap: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
