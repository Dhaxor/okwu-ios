// Back that never dead-ends. A screen opened from a link, a notification tap
// or a cold start has nothing beneath it, and router.back() then does nothing;
// it goes to the screen's parent instead.
import { useCallback } from "react";
import { useRouter, type Href } from "expo-router";

export function useBack(parent: Href): () => void {
  const router = useRouter();
  return useCallback(() => (router.canGoBack() ? router.back() : router.replace(parent)), [router, parent]);
}
