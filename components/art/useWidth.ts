import { useCallback, useState } from "react";
import type { LayoutChangeEvent } from "react-native";

/** Measure a container's width for art that fills it (0 until laid out). */
export function useWidth(initial = 0): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(initial);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    setW((prev) => (prev === next ? prev : next));
  }, []);
  return [w, onLayout];
}
