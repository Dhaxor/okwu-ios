// Text input. A label above, the field on lighter paper with a camwood focus
// ring, hint or error text below. With `igbo` the field types in the Igbo
// face, never autocorrects or capitalises (the iOS Igbo keyboard has no
// autocorrect and English autocorrect mangles Igbo), and every change is
// NFC-normalised. Pair it with <IgboKeyStrip> through useIgboInput().
import React, { forwardRef, useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps, type TextInputSelectionChangeEvent } from "react-native";
import { colors, fonts, igboLineHeight, radius, size, space, typeScale } from "@/constants/theme";
import { nfc, type Selection } from "@/lib/igbo/text";
import { T } from "./T";

export interface TextFieldProps
  extends Omit<TextInputProps, "style" | "onChangeText" | "value" | "testID" | "selection" | "onSelectionChange"> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  testID: string;
  hint?: string;
  error?: string;
  igbo?: boolean;
  /** Controlled selection (the key strip needs it). */
  selection?: Selection;
  onSelectionChange?: (selection: Selection) => void;
}

/** The instance a TextField ref points at (focus, blur, clear). */
export type TextFieldRef = React.ComponentRef<typeof TextInput>;

export const TextField = forwardRef<TextFieldRef, TextFieldProps>(function TextField(
  { label, value, onChangeText, testID, hint, error, igbo = false, selection, onSelectionChange, multiline, onFocus, onBlur, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);
  const handleSelection = (e: TextInputSelectionChangeEvent) =>
    onSelectionChange?.(e.nativeEvent.selection);

  return (
    <View style={styles.wrap}>
      <T variant="caption" strong tone="secondary" nativeID={`${testID}-label`}>
        {label}
      </T>
      <View style={[styles.field, multiline && styles.multiline, focused && styles.focused, !!error && styles.errored]}>
        <TextInput
          ref={ref}
          testID={testID}
          value={value}
          onChangeText={(t) => onChangeText(igbo ? nfc(t) : t)}
          selection={selection}
          onSelectionChange={handleSelection}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          multiline={multiline}
          accessibilityLabel={label}
          accessibilityLabelledBy={`${testID}-label`}
          accessibilityLanguage={igbo ? "ig" : undefined}
          placeholderTextColor={colors.ink48}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          {...rest}
          autoCorrect={igbo ? false : rest.autoCorrect}
          spellCheck={igbo ? false : rest.spellCheck}
          autoCapitalize={igbo ? "none" : rest.autoCapitalize}
          style={[styles.input, igbo ? styles.igbo : styles.ui]}
        />
      </View>
      {error ? (
        <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : hint ? (
        <T variant="caption">{hint}</T>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  field: {
    minHeight: size.field,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: space.md,
    justifyContent: "center",
  },
  multiline: { minHeight: 112, paddingVertical: space.sm, justifyContent: "flex-start" },
  focused: { borderColor: colors.focus, borderWidth: 2, paddingHorizontal: space.md - 1 },
  errored: { borderColor: colors.danger },
  // A zero-width solid outline: no browser focus ring on web (the field draws its own camwood ring); no effect on iOS.
  input: { color: colors.ink, paddingVertical: space.xs, outlineWidth: 0, outlineStyle: "solid" },
  ui: { fontFamily: fonts.ui, fontSize: typeScale.body.fontSize },
  igbo: { fontFamily: fonts.igbo, fontSize: typeScale.body.fontSize, lineHeight: igboLineHeight.body },
});
