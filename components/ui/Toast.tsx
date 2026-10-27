// Toasts: short, kind confirmations ("Saved", "Copied"). Never Alert.alert
// (a no-op on web and a hard interruption on iOS). One toast at a time; a
// new one replaces the current. A toast draws in the top-most layer: the
// root, or the open Sheet (iOS Modals cover everything outside them).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, layer, maxContentWidth, motion, radius, shadow, size, space } from "@/constants/theme";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type IconComponent } from "@/components/glyphs/icons";
import { calm, useMotion } from "./motion";
import { haptic } from "./haptics";
import { T } from "./T";

export type ToastTone = "neutral" | "success" | "warning" | "error";

export interface ToastOptions {
  tone?: ToastTone;
  /** Dwell time in ms (default motion.toastMs). */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
}

interface ToastApi {
  show: (message: string, options?: ToastOptions) => void;
  hide: () => void;
}

interface ToastState {
  current: ToastItem | null;
  /** Open sheets, innermost last. The last one hosts the toast. */
  layers: string[];
  enterLayer: (id: string) => void;
  leaveLayer: (id: string) => void;
  api: ToastApi;
}

const ToastCtx = createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children?: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const [layers, setLayers] = useState<string[]>([]);
  const seq = useRef(0);

  const api = useMemo<ToastApi>(
    () => ({
      show: (message, options) => {
        const tone = options?.tone ?? "neutral";
        if (tone === "success") haptic("success");
        if (tone === "warning" || tone === "error") haptic("warning");
        AccessibilityInfo.announceForAccessibility(message);
        setCurrent({ id: ++seq.current, message, tone, duration: options?.duration ?? motion.toastMs });
      },
      hide: () => setCurrent(null),
    }),
    []
  );
  const enterLayer = useCallback((id: string) => setLayers((l) => (l.includes(id) ? l : [...l, id])), []);
  const leaveLayer = useCallback((id: string) => setLayers((l) => l.filter((x) => x !== id)), []);

  const value = useMemo(() => ({ current, layers, enterLayer, leaveLayer, api }), [current, layers, enterLayer, leaveLayer, api]);
  return <ToastCtx.Provider value={value}>{children}</ToastCtx.Provider>;
}

function useToastState(): ToastState {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast needs <UIProvider> (components/ui) above it");
  return ctx;
}

/** Show a toast: `const toast = useToast(); toast.show("Saved", { tone: "success" })`. */
export function useToast(): ToastApi {
  return useToastState().api;
}

/** For Sheet: register an overlay layer while it is open. */
export function useToastLayer(id: string, open: boolean) {
  const { enterLayer, leaveLayer } = useToastState();
  useEffect(() => {
    if (!open) return;
    enterLayer(id);
    return () => leaveLayer(id);
  }, [id, open, enterLayer, leaveLayer]);
}

const TONE: Record<ToastTone, { icon: IconComponent; color: string; well: string }> = {
  neutral: { icon: Info, color: colors.ink, well: colors.ink06 },
  success: { icon: CircleCheck, color: colors.success, well: colors.success12 },
  warning: { icon: TriangleAlert, color: colors.rewardText, well: colors.reward12 },
  error: { icon: CircleAlert, color: colors.danger, well: colors.danger12 },
};

/** Where toasts draw. The root renders one with layer "root"; each Sheet renders its own. */
export function ToastViewport({ layer: layerId = "root" }: { layer?: string }) {
  const { current, layers, api } = useToastState();
  const insets = useSafeAreaInsets();
  const policy = useMotion();
  const topLayer = layers[layers.length - 1] ?? "root";
  const mine = topLayer === layerId;
  const [shown, setShown] = useState<ToastItem | null>(null);
  const p = useSharedValue(0);

  useEffect(() => {
    if (!mine || !current) {
      p.value = policy.still ? 0 : withTiming(0, { duration: motion.state, easing: calm });
      const t = setTimeout(() => setShown(null), policy.still ? 0 : motion.state);
      return () => clearTimeout(t);
    }
    setShown(current);
    p.value = policy.still ? 1 : withTiming(1, { duration: motion.enter, easing: calm });
    const t = setTimeout(api.hide, current.duration);
    return () => clearTimeout(t);
  }, [mine, current, api, p, policy.still]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: policy.moves ? [{ translateY: (1 - p.value) * -space.xs }] : [],
  }));

  if (!shown) return null;
  const tone = TONE[shown.tone];
  const Icon = tone.icon;
  return (
    // A toast has no actions: taps pass through it, so it never covers a screen's back button or flag.
    <View pointerEvents="none" style={[styles.viewport, { top: insets.top + space.xs }]}>
      <Animated.View
        testID="toast"
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.toast, style]}
      >
        <View style={[styles.well, { backgroundColor: tone.well }]}>
          <Icon size={size.iconSm} color={tone.color} strokeWidth={2.25} />
        </View>
        <T variant="body" tone="primary" style={styles.text}>
          {shown.message}
        </T>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: "absolute",
    left: space.md,
    right: space.md,
    alignItems: "center",
    zIndex: layer.toast,
  },
  toast: {
    width: "100%",
    maxWidth: maxContentWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    boxShadow: shadow.lift,
  },
  well: { width: 32, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  text: { flex: 1 },
});
