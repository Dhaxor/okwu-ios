// Aha, the names book: Igbo names with their meanings, set like a book, in
// four themes. Search by name (tone marks and dots optional), by a regional
// form or by meaning in English. The learner keeps their family's names
// here, on this device only. The one primary action adds a family name.
import React, { useDeferredValue, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ChipRow, FamilyNameRow, NameRow, ReviewTag, SourceNote, ThemeHeading } from "@/components/feature/library";
import { Plus } from "@/components/glyphs/icons";
import { Button, Card, Chip, IgboKeyStrip, Screen, ScreenHeader, Section, Sheet, T, TextField, useIgboInput, useToast } from "@/components/ui";
import { space } from "@/constants/theme";
import { MAX_NOTE_GRAPHEMES, bookMatch, nameSections, namesFile, searchNames, type NameTheme } from "@/lib/library";
import { useFamilyNames, useLibraryAudio } from "@/lib/library/useLibrary";

const FILTERS: { id: NameTheme | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "chi", label: "Chi and Chukwu" },
  { id: "market", label: "Market days" },
  { id: "virtue", label: "Virtue" },
  { id: "birth", label: "Family and birth" },
];

export default function NamesBook() {
  const router = useRouter();
  const audio = useLibraryAudio();
  const family = useFamilyNames();
  const toast = useToast();
  const { themes, names } = namesFile();
  const search = useIgboInput("");
  const query = useDeferredValue(search.value.trim());
  const [filter, setFilter] = useState<NameTheme | "all">("all");
  const [adding, setAdding] = useState(false);

  const hits = useMemo(() => (query ? searchNames(names, query) : []), [names, query]);
  const sections = useMemo(() => nameSections(themes, names, filter === "all" ? null : filter), [themes, names, filter]);
  const open = (id: string) => router.push({ pathname: "/library/names/[id]", params: { id } });
  const close = () => (router.canGoBack() ? router.back() : router.replace("/library"));

  return (
    <Screen
      testID="names"
      keyboard
      footer={<Button label="Add a family name" icon={Plus} onPress={() => setAdding(true)} testID="names-add" block />}
    >
      <ScreenHeader eyebrow="Aha · Names" title="Igbo names" subtitle={`${names.length} names and what they mean, with recordings from the Nkọwa okwu dataset.`} onBack={close} testID="names-header" />

      <View style={styles.field}>
        <TextField igbo {...search.field} label="Find a name" placeholder="Chiọma, Okeke, journey…" returnKeyType="search" hint="Tone marks and dots are optional. English finds meanings." testID="names-search" />
        <IgboKeyStrip {...search.strip} tones={false} testID="names-keys" />
      </View>

      {query ? (
        hits.length === 0 ? (
          <Card variant="sunk" testID="names-none">
            <View style={styles.state}>
              <T variant="title">
                {"No name matches "}
                <T variant="title" igbo>
                  {`“${query}”`}
                </T>
              </T>
              <T variant="body" tone="muted">
                Try fewer letters, or search in English for a meaning like "God", "life" or "journey". You can also add it as one of your family's names.
              </T>
            </View>
          </Card>
        ) : (
          <Section title={`${hits.length} ${hits.length === 1 ? "name" : "names"}`} testID="names-results">
            <Card variant="flat" padding="md">
              {hits.map((h, i) => (
                <NameRow
                  key={h.name.id}
                  name={h.name}
                  audio={audio}
                  onOpen={() => open(h.name.id)}
                  saved={family.isSaved(h.name.id)}
                  note={h.via === "variant" && h.variant ? `Also said as ${h.variant}` : undefined}
                  divider={i < hits.length - 1}
                  testID={`names-hit-${i}`}
                />
              ))}
            </Card>
          </Section>
        )
      ) : (
        <>
          {family.list.length > 0 ? (
            <Section title="Your family's names" testID="names-family">
              <Card variant="flat" padding="md">
                {family.list.map((f, i) => {
                  const book = f.bookId ? (names.find((n) => n.id === f.bookId) ?? null) : bookMatch(names, f.name);
                  return (
                    <FamilyNameRow
                      key={f.id}
                      entry={f}
                      book={book}
                      onOpen={book ? () => open(book.id) : null}
                      onRemove={() => {
                        family.remove(f.id);
                        toast.show(`${f.name} removed from your family names`);
                      }}
                      divider={i < family.list.length - 1}
                      testID={`names-family-${i}`}
                    />
                  );
                })}
              </Card>
              <T variant="caption">Kept on this phone only. Never shared.</T>
            </Section>
          ) : null}

          <ChipRow testID="names-filters">
            {FILTERS.map((f) => (
              <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} testID={`names-filter-${f.id}`} />
            ))}
          </ChipRow>

          {sections.map((s) => (
            <View key={s.theme.id} style={styles.section} testID={`names-section-${s.theme.id}`}>
              <ThemeHeading theme={s.theme} count={s.names.length} testID={`names-theme-${s.theme.id}`} />
              <Card variant="flat" padding="md">
                {s.names.map((n, i) => (
                  <NameRow
                    key={n.id}
                    name={n}
                    audio={audio}
                    onOpen={() => open(n.id)}
                    saved={family.isSaved(n.id)}
                    divider={i < s.names.length - 1}
                    testID={`names-${s.theme.id}-${i}`}
                  />
                ))}
              </Card>
            </View>
          ))}
        </>
      )}

      <View style={styles.tags}>
        <ReviewTag kind="dataset" testID="names-unreviewed" />
        <Chip label="Groupings pending cultural review" tone="neutral" testID="names-groupings" />
      </View>
      <SourceNote testID="names-source" />

      <AddNameSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onSave={(name, note) => {
          const r = family.addOwn(name, note);
          if (!r.ok) return r.error;
          setAdding(false);
          toast.show(`${r.entry.name} kept in your family names`, { tone: "success" });
          return null;
        }}
      />
    </Screen>
  );
}

function AddNameSheet({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (name: string, note: string) => string | null }) {
  const name = useIgboInput("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const save = () => {
    const e = onSave(name.value, note);
    if (e) return setError(e);
    name.setValue("");
    setNote("");
    setError(undefined);
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Add a family name"
      subtitle="Write it the way your family does. It stays on this phone."
      testID="names-add-sheet"
      footer={
        <>
          <Button label="Keep this name" onPress={save} testID="names-add-save" block />
          <Button label="Not now" variant="ghost" onPress={onClose} testID="names-add-cancel" block />
        </>
      }
    >
      <View style={styles.sheet}>
        <TextField
          igbo
          {...name.field}
          onChangeText={(t) => {
            name.field.onChangeText(t);
            setError(undefined);
          }}
          label="Name"
          placeholder="As your family writes it"
          error={error}
          testID="names-add-name"
        />
        <IgboKeyStrip {...name.strip} tones={false} testID="names-add-keys" />
        <TextField label="Who carries it (optional)" value={note} onChangeText={setNote} placeholder="My grandmother" maxLength={MAX_NOTE_GRAPHEMES} testID="names-add-note" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  section: { gap: space.sm },
  state: { gap: space.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  sheet: { gap: space.md },
});
