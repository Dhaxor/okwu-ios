// Your favourite phrases, newest first, kept on this phone.
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { PhraseList, PhraseSourceNote } from "@/components/feature/phrasebook";
import { Star } from "@/components/glyphs/icons";
import { Button, Card, Screen, ScreenHeader, T } from "@/components/ui";
import { colors, size, space } from "@/constants/theme";
import { phraseById, situationOf, type Phrase } from "@/lib/phrasebook";
import { useFavourites, usePhraseAudio, usePhrasebook } from "@/lib/phrasebook/hooks";

export default function FavouritePhrases() {
  const router = useRouter();
  const book = usePhrasebook();
  const audio = usePhraseAudio();
  const favs = useFavourites();
  const index = book.index;
  const phrases = useMemo(() => (index ? favs.ids.map((id) => phraseById(index, id)).filter((p): p is Phrase => !!p) : []), [index, favs.ids]);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/phrasebook"));

  return (
    <Screen testID="favourites" footer={phrases.length === 0 && book.status === "ready" ? <Button label="Browse the phrasebook" onPress={close} testID="favourites-browse" block /> : undefined}>
      <ScreenHeader eyebrow="Phrasebook" title="Favourites" subtitle="The phrases you starred, kept on this phone." onBack={close} testID="favourites-header" />
      {phrases.length > 0 ? (
        <PhraseList
          phrases={phrases}
          audio={audio}
          onOpen={(p) => router.push({ pathname: "/phrasebook/phrase/[id]", params: { id: p.id } })}
          situationTitle={(id) => (index ? situationOf(index, id)?.title ?? "" : "")}
          testID="favourites-phrase"
        />
      ) : book.status === "ready" ? (
        <Card variant="sunk" testID="favourites-empty">
          <View style={styles.empty}>
            <Star size={size.icon + 6} color={colors.rewardText} strokeWidth={2} />
            <T variant="title">No favourites yet</T>
            <T variant="body" tone="muted">
              Tap the star on any phrase to keep it here, ready for the moment you need it.
            </T>
          </View>
        </Card>
      ) : null}
      <PhraseSourceNote credit={index?.credit ?? ""} testID="favourites-source" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { gap: space.sm },
});
