// <Screen>: the page every route renders. Paper ground, safe areas, the side
// gutter, a reading-width cap, and an optional pinned footer that holds the
// screen's one primary action in the thumb zone (above the tab bar on a tab
// screen), fading the content out beneath it.
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors, gutterFor, maxContentWidth, space } from "@/constants/theme";
import { ArrowLeft } from "@/components/glyphs/icons";
import { IconButton } from "./Button";
import { T } from "./T";

export interface ScreenProps {
  testID: string;
  children?: React.ReactNode;
  /** Scroll the content (default true). */
  scroll?: boolean;
  /** Pinned bottom area for the primary action. */
  footer?: React.ReactNode;
  /** The screen sits inside the tab navigator (the tab bar owns the bottom inset). */
  tabbed?: boolean;
  /** Decorative art drawn behind the content (absolute, not interactive). */
  backdrop?: React.ReactNode;
  /** Lift the content and footer with the keyboard. */
  keyboard?: boolean;
  /** Centre short content vertically (a moment screen); it still scrolls when tall. */
  center?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({ testID, children, scroll = true, footer, tabbed = false, backdrop, keyboard = false, center = false, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gutter = gutterFor(width);
  const bottomInset = tabbed ? 0 : insets.bottom;
  // The footer floats over the content; pad the content by its measured height so nothing hides under it.
  const [footerH, setFooterH] = useState(140);

  const inner = [
    styles.content,
    { paddingHorizontal: gutter, paddingTop: insets.top + space.md },
    !footer && { paddingBottom: bottomInset + space.xl },
    footer ? { paddingBottom: footerH + space.lg } : null,
    center ? styles.centered : null,
    contentStyle,
  ];

  const body = scroll ? (
    <ScrollView
      testID={`${testID}-scroll`}
      style={styles.fill}
      contentContainerStyle={inner}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, ...inner]}>{children}</View>
  );

  const page = (
    <View testID={testID} style={styles.root}>
      {backdrop ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {backdrop}
        </View>
      ) : null}
      {body}
      {footer ? (
        <View
          onLayout={(e) => setFooterH(Math.round(e.nativeEvent.layout.height))}
          style={[styles.footer, { paddingHorizontal: gutter, paddingBottom: bottomInset + space.md }]}
        >
          <FooterFade />
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </View>
  );

  if (!keyboard) return page;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {page}
    </KeyboardAvoidingView>
  );
}

/** Content dissolves into the paper above the footer instead of hitting a hard edge. */
function FooterFade() {
  return (
    <View pointerEvents="none" style={styles.fade}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="okwu-footer-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#okwu-footer-fade)" />
      </Svg>
    </View>
  );
}

export interface ScreenHeaderProps {
  title: string;
  /** Small label above the title. */
  eyebrow?: string;
  /** A quiet line under the title. */
  subtitle?: string;
  onBack?: () => void;
  /** Right-aligned actions (IconButtons). */
  trailing?: React.ReactNode;
  igbo?: boolean;
  testID?: string;
}

export function ScreenHeader({ title, eyebrow, subtitle, onBack, trailing, igbo, testID = "screen-header" }: ScreenHeaderProps) {
  return (
    <View testID={testID} style={styles.header}>
      {onBack || trailing ? (
        <View style={styles.headerBar}>
          {onBack ? <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={onBack} testID={`${testID}-back`} variant="tinted" /> : <View />}
          <View style={styles.trailing}>{trailing}</View>
        </View>
      ) : null}
      {eyebrow ? <T variant="label" tone="accent">{eyebrow}</T> : null}
      <T variant="display" igbo={igbo} accessibilityRole="header">
        {title}
      </T>
      {subtitle ? <T variant="body" tone="muted">{subtitle}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  centered: { flexGrow: 1, justifyContent: "center" },
  content: { width: "100%", maxWidth: maxContentWidth + 2 * space.lg, alignSelf: "center", gap: space.xl },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: space.md, backgroundColor: colors.bg },
  footerInner: { width: "100%", maxWidth: maxContentWidth, alignSelf: "center", gap: space.sm },
  fade: { position: "absolute", left: 0, right: 0, top: -space.xl, height: space.xl },
  header: { gap: space.xs },
  headerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.xs },
  trailing: { flexDirection: "row", gap: space.xs },
});
