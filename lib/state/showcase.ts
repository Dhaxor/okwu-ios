// A development showcase: one exercise of every type, built from what the
// bundle already holds (it selects and arranges approved strings, never
// writes Igbo). Development builds only (the lesson route checks __DEV__).
// The story chapter reuses a dialogue's lines, because no stories ship yet.
import { hasPlayableAudio, allowsUnreviewedAudio, minimalSets, usableItems } from "@/lib/content";
import type { ContentBundle, ExerciseSpec, ItemId, StoryId } from "@/lib/content/types";
import { permutation, rng, subSeed, type Exercise } from "@/lib/learning";

export const SHOWCASE_ID = "showcase";

export function showcaseExercises(bundle: ContentBundle, seed = 1): Exercise[] {
  const usable = usableItems(bundle);
  const allow = allowsUnreviewedAudio(bundle);
  const heard = usable.filter((i) => hasPlayableAudio(i, allow));
  const specs: ExerciseSpec[] = [];
  const words = usable.filter((i) => i.kind === "word" || i.kind === "phrase");
  const lc = heard.find((i) => i.kind === "word") ?? words[0];
  if (lc) {
    const others = words.filter((w) => w.id !== lc.id && w.gloss.en.toLowerCase() !== lc.gloss.en.toLowerCase());
    const seen = new Set<string>([lc.gloss.en.toLowerCase()]);
    const ds = others.filter((o) => !seen.has(o.gloss.en.toLowerCase()) && seen.add(o.gloss.en.toLowerCase())).slice(0, 3);
    specs.push({ type: "listen-choose", items: [lc.id], prompt: lc.id, answer: "gloss", options: [lc.id, ...ds.map((d) => d.id)] });
  }
  const set = minimalSets(bundle)[0];
  if (set && set.length >= 2) {
    const target = set[2 % set.length] as ItemId;
    specs.push({ type: "tone-pair", items: [target], set, target, voices: [] });
  }
  const multi = usable.find((i) => i.kind === "phrase" && i.spelling.trim().split(/\s+/).length >= 3) ?? usable.find((i) => i.spelling.includes(" "));
  if (multi) {
    const tiles = multi.spelling.split(/\s+/);
    const own = new Set(tiles.map((t) => t.toLowerCase()));
    const extra = [...new Set(usable.filter((i) => i.id !== multi.id && !i.spelling.includes(" ")).map((i) => i.spelling))].filter((t) => !own.has(t.toLowerCase())).slice(0, 2);
    specs.push({ type: "build-sentence", items: [multi.id], target: multi.id, tiles, distractorTiles: extra });
  }
  const dotted = usable.find((i) => i.kind === "word" && /[ịọụṅ]/i.test(i.spelling) && !i.spelling.includes(" ")) ?? words[0];
  if (dotted) specs.push({ type: "type-it", items: [dotted.id], target: dotted.id, prompt: "gloss" });
  const say = heard.find((i) => i.kind === "word" && i.tone.syllables.length > 0) ?? lc;
  if (say) specs.push({ type: "say-it", items: [say.id], target: say.id, overlay: true });
  const dialogue = Object.values(bundle.lessons)
    .flatMap((l) => l.exercises)
    .find((e): e is Extract<ExerciseSpec, { type: "dialogue" }> => e.type === "dialogue" && e.lines.every((l) => !!bundle.items[l.item]));
  if (dialogue) {
    specs.push(dialogue);
    const lines = [...new Set(dialogue.lines.map((l) => l.item))];
    specs.push({ type: "story", items: lines, story: "showcase" as StoryId, chapter: 1, tones: "shown" });
  }
  return specs.map((spec, i) => {
    const s = subSeed(seed, `showcase:${i}`);
    const n = spec.type === "listen-choose" ? spec.options.length : spec.type === "tone-pair" ? spec.set.length : spec.type === "build-sentence" ? spec.tiles.length + spec.distractorTiles.length : 0;
    return { id: `showcase-${i}-${spec.type}`, spec, order: n > 0 ? permutation(n, rng(s)) : [], seed: s };
  });
}
