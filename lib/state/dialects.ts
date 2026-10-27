// Home-dialect labels (id → name as Nkọwa okwu writes it), from the
// dictionary's registry, loaded once on first use. Names are Igbo: render
// them with <T igbo>. We never rank dialects: the list is alphabetical.
import { useEffect, useState } from "react";
import { loadDictionary } from "@/lib/content";

let cache: Record<string, string> | null = null;
let loading: Promise<Record<string, string>> | null = null;

export function loadDialectLabels(): Promise<Record<string, string>> {
  if (cache) return Promise.resolve(cache);
  loading ??= loadDictionary()
    .then((d) => (cache = { ...d.dialects }))
    .catch(() => (cache = {}));
  return loading;
}

/** Dialect labels, or {} while loading. */
export function useDialectLabels(): Record<string, string> {
  const [labels, setLabels] = useState<Record<string, string>>(cache ?? {});
  useEffect(() => {
    let live = true;
    void loadDialectLabels().then((l) => live && setLabels(l));
    return () => {
      live = false;
    };
  }, []);
  return labels;
}

/** Sorted for display (alphabetical by name, ignoring dots and case). */
export function dialectOptions(labels: Record<string, string>): { id: string; label: string }[] {
  const key = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return Object.entries(labels)
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => key(a.label).localeCompare(key(b.label)));
}
