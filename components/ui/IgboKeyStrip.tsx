// The Igbo key strip: the four dotted letters an English keyboard lacks
// (ị ọ ụ ṅ) and the three tone marks (high ◌́, low ◌̀, downstep ◌̄).
//
// Letters follow sentence case (a capital at the start of a sentence);
// long-press a letter for the other case. A tone key marks the letter just
// before the caret; tapping the same tone again removes it, another tone
// replaces it. After a consonant nothing changes and the strip says where
// tones go. Every edit is NFC (lib/igbo/text).
//
// Wire it to a TextField with useIgboInput():
//   const igbo = useIgboInput();
//   <TextField igbo {...igbo.field} label="Your answer" testID="answer" />
//   <IgboKeyStrip {...igbo.strip} testID="answer-keys" />
import React, { useCallback, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { colors, radius, shadow, size, space } from "@/constants/theme";
import {
  DOTTED_LETTERS,
  TONE_MARK,
  applyToneAtCaret,
  insertAtSelection,
  nfc,
  type Selection,
  type ToneName,
} from "@/lib/igbo/text";
import { Press } from "./Press";
import { T } from "./T";
import type { TextFieldRef } from "./TextField";

const TONE_KEYS: { tone: ToneName; label: string }[] = [
  { tone: "high", label: "High tone" },
  { tone: "low", label: "Low tone" },
  { tone: "downstep", label: "Downstep" },
];

const DOTTED_CIRCLE = "◌";
const HINT = "Tone marks go right after a vowel, m or n.";

/** Capitalise at the start of the text or of a sentence. */
export function wantsCapital(text: string, caret: number): boolean {
  const before = text.slice(0, caret).replace(/\s+$/u, "");
  return before.length === 0 || /[.!?]$/u.test(before);
}

export interface IgboKeyStripProps {
  value: string;
  selection: Selection;
  onChange: (text: string, selection: Selection) => void;
  testID: string;
  /** Show the tone keys (default true; off for spelling-only answers). */
  tones?: boolean;
}

export function IgboKeyStrip({ value, selection, onChange, testID, tones = true }: IgboKeyStripProps) {
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const insertLetter = (letter: string, flip: boolean) => {
    const caret = Math.min(selection.start, selection.end);
    const upper = wantsCapital(value, caret) !== flip;
    const r = insertAtSelection(value, selection, upper ? letter.toUpperCase() : letter);
    onChange(r.text, r.selection);
  };

  const tone = (t: ToneName) => {
    const r = applyToneAtCaret(value, selection, t);
    if (r.applied) {
      onChange(r.text, r.selection);
      return;
    }
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint(true);
    AccessibilityInfo.announceForAccessibility(HINT);
    hintTimer.current = setTimeout(() => setHint(false), 2400);
  };

  return (
    <View testID={testID} style={styles.wrap}>
      {hint ? (
        <T variant="caption" tone="accent" center testID={`${testID}-hint`} accessibilityLiveRegion="polite">
          {HINT}
        </T>
      ) : null}
      <View style={styles.row} accessibilityRole="toolbar" accessibilityLabel="Igbo letters and tone marks">
        {DOTTED_LETTERS.map((l) => (
          <Press
            key={l}
            testID={`${testID}-${l}`}
            onPress={() => insertLetter(l, false)}
            onLongPress={() => insertLetter(l, true)}
            haptics="select"
            accessibilityLabel={`Type ${l}`}
            accessibilityHint="Long-press for the other case"
            style={[styles.key, styles.letterKey]}
          >
            <T variant="title" igbo tone="primary">
              {l}
            </T>
          </Press>
        ))}
        {tones
          ? TONE_KEYS.map((k) => (
              <Press
                key={k.tone}
                testID={`${testID}-tone-${k.tone}`}
                onPress={() => tone(k.tone)}
                haptics="select"
                accessibilityLabel={k.label}
                accessibilityHint="Marks the letter before the cursor"
                style={[styles.key, styles.toneKey]}
              >
                <T variant="display" igbo tone="accent" style={styles.toneGlyph}>
                  {nfc(DOTTED_CIRCLE + TONE_MARK[k.tone])}
                </T>
              </Press>
            ))
          : null}
      </View>
    </View>
  );
}

/**
 * State for a TextField + IgboKeyStrip pair. The selection is only forced
 * onto the input right after a strip edit, then handed back, so ordinary
 * typing and cursor moves stay native.
 */
export function useIgboInput(initial = "") {
  const [value, setValue] = useState(nfc(initial));
  const sel = useRef<Selection>({ start: value.length, end: value.length });
  const [forced, setForced] = useState<Selection | undefined>(undefined);
  const inputRef = useRef<TextFieldRef>(null);

  const onChangeText = useCallback((t: string) => setValue(nfc(t)), []);
  const onSelectionChange = useCallback((s: Selection) => {
    sel.current = s;
    setForced(undefined);
  }, []);
  const onStripChange = useCallback((t: string, s: Selection) => {
    setValue(t);
    sel.current = s;
    setForced(s);
    inputRef.current?.focus();
  }, []);

  return {
    value,
    setValue: (t: string) => setValue(nfc(t)),
    field: { ref: inputRef, value, onChangeText, selection: forced, onSelectionChange },
    strip: { value, selection: forced ?? sel.current, onChange: onStripChange },
  };
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.xxs },
  key: {
    flex: 1,
    minWidth: size.tapMin,
    height: size.key,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  letterKey: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairlineStrong, boxShadow: shadow.key },
  // The mark is the point of the key: set it large, on a dotted-circle base, nudged down to centre the mark.
  toneGlyph: { marginTop: space.xs },
  toneKey: { backgroundColor: colors.accent06, borderWidth: 1, borderColor: colors.accent12 },
});
