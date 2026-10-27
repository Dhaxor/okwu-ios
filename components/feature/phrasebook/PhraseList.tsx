// A list of phrase cards wired to the shared audio player, favourites and
// copy. Used by a situation's page, the favourites page and search results.
import React from "react";
import { StyleSheet, View } from "react-native";
import { space } from "@/constants/theme";
import type { Phrase, SituationId } from "@/lib/phrasebook";
import { useCopyPhrase, useFavourites, type PhraseAudio } from "@/lib/phrasebook/hooks";
import { PhraseCard } from "./parts";

export function PhraseList({
  phrases,
  audio,
  onOpen,
  onPlayed,
  situationTitle,
  testID,
}: {
  phrases: readonly Phrase[];
  audio: PhraseAudio;
  onOpen: (phrase: Phrase) => void;
  /** The learner tapped listen on a card (a "play all" run stops). */
  onPlayed?: () => void;
  /** Label each card with its situation (search results, favourites). */
  situationTitle?: (id: SituationId) => string;
  testID: string;
}) {
  const favs = useFavourites();
  const copy = useCopyPhrase();
  return (
    <View style={styles.list} testID={testID}>
      {phrases.map((p, i) => {
        const key = `phrase-${p.id}`;
        const playing = audio.playing && audio.current === key;
        return (
          <PhraseCard
            key={p.id}
            phrase={p}
            clip={audio.availability(p.audio)}
            playing={playing}
            favourite={favs.isFavourite(p.id)}
            onPlay={() => {
              onPlayed?.();
              if (playing) audio.stop();
              else audio.play(p.audio, key);
            }}
            onToggleFavourite={() => favs.toggle(p.id)}
            onCopy={() => copy(p)}
            onOpen={() => onOpen(p)}
            situationTitle={situationTitle?.(p.situation)}
            testID={`${testID}-${i}`}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
});
