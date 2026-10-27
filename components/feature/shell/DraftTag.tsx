// Marks placeholder Igbo on screen so nobody mistakes it for reviewed content.
import React from "react";
import { Chip } from "@/components/ui";
import { DRAFT_NOTICE } from "@/lib/content/draftSamples";

export function DraftTag({ testID = "draft-tag" }: { testID?: string }) {
  return <Chip label={DRAFT_NOTICE} tone="reward" testID={testID} />;
}
