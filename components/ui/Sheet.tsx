// Bottom sheet, the same on iOS and web: a Modal with an ink scrim, a paper
// panel that rises from the bottom edge (a fade under Reduce Motion), a
// grabber, an optional title and actions pinned at the bottom (thumb zone).
// The open sheet hosts toasts. Present one root sheet at a time: iOS will
// not show a Modal while another is up. A sheet opened from inside a sheet
// must be rendered inside it (nested), which iOS allows.
import React, { useEffect, useId, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, gutterFor, maxContentWidth, motion, radius, shadow, space } from "@/constants/theme";
import { calm, useMotion } from "./motion";
import { T } from "./T";
import { ToastViewport, useToastLayer } from "./Toast";

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  testID: string;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Actions pinned under the content. */
  footer?: React.ReactNode;
  /** Scrim tap and back gesture close the sheet (default true). */
  dismissible?: boolean;
  /** Scroll the content when taller than the panel. */
  scroll?: boolean;
}

export function Sheet({ visible, onClose, testID, title, subtitle, children, footer, dismissible = true, scroll = false }: SheetProps) {
  const policy = useMotion();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const gutter = gutterFor(win.width);
  const layerId = `sheet-${useId()}`;
  const [mounted, setMounted] = useState(visible);
  const [panelH, setPanelH] = useState(win.height * 0.5);
  const p = useSharedValue(0);
  const exit = useRef<ReturnType<typeof setTimeout> | null>(null);

  useToastLayer(layerId, mounted && visible);

  useEffect(() => {
    if (exit.current) clearTimeout(exit.current);
    if (visible) {
      setMounted(true);
      p.value = policy.still ? 1 : withTiming(1, { duration: motion.enter, easing: calm });
    } else {
      p.value = policy.still ? 0 : withTiming(0, { duration: motion.state, easing: calm });
      exit.current = setTimeout(() => setMounted(false), policy.still ? 0 : motion.state);
    }
    return () => {
      if (exit.current) clearTimeout(exit.current);
    };
  }, [visible, policy.still, p]);

  const slides = policy.moves;
  const scrim = useAnimatedStyle(() => ({ opacity: p.value }));
  const panel = useAnimatedStyle(() => (slides ? { transform: [{ translateY: (1 - p.value) * panelH }] } : { opacity: p.value }));

  const body = scroll ? (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" testID={`${testID}-scroll`}>
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <Modal transparent visible={mounted} animationType="none" statusBarTranslucent onRequestClose={dismissible ? onClose : () => {}}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissible ? onClose : undefined}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID={`${testID}-scrim`}
          />
        </Animated.View>
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
          style={[
            styles.panel,
            { maxHeight: win.height * 0.9, paddingHorizontal: gutter, paddingBottom: insets.bottom + space.lg },
            panel,
          ]}
        >
          <View style={styles.grabber} />
          {title ? (
            <T variant="title" accessibilityRole="header" style={styles.title}>
              {title}
            </T>
          ) : null}
          {subtitle ? (
            <T variant="body" tone="muted" style={styles.subtitle}>
              {subtitle}
            </T>
          ) : null}
          {body}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
        <ToastViewport layer={layerId} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { backgroundColor: colors.scrim },
  panel: {
    width: "100%",
    maxWidth: maxContentWidth + 2 * space.xl,
    alignSelf: "center",
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.sm,
    boxShadow: shadow.sheet,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.ink24,
    marginBottom: space.lg,
  },
  title: { marginBottom: space.xs },
  subtitle: { marginBottom: space.md },
  scroll: { flexGrow: 0 },
  footer: { gap: space.sm, marginTop: space.lg },
});
