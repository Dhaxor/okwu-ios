// An offline pack row: what it holds and its size, then one action for its
// state: download, cancel (with progress), resume, or remove. Failures say
// plainly what happened and what stays saved; nothing is ever red.
import React from "react";
import { StyleSheet, View } from "react-native";
import { BookOpen, CircleCheck, Download, Hourglass, Layers, MessageCircle, Trash, X, type IconComponent } from "@/components/glyphs/icons";
import { IconButton, ProgressBar, T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { FAILURE_COPY, formatBytes, type DownloadFailure, type Job, type PackDef, type PackKind, type PackStatus } from "@/lib/tools";

const KIND_ICON: Record<PackKind, IconComponent> = { unit: BookOpen, phrasebook: MessageCircle, library: Layers };

export function packDetail(pack: PackDef, status: PackStatus): string {
  const n = `${pack.files.length} ${pack.files.length === 1 ? "recording" : "recordings"}`;
  const bytes = status.phase === "ready" ? formatBytes(status.bytesHere) : `${pack.estimated ? "about " : ""}${formatBytes(pack.bytes)}`;
  return [pack.detail, n, bytes].filter(Boolean).join(" · ");
}

export function PackRow({
  pack,
  status,
  job,
  failure,
  onDownload,
  onCancel,
  onRemove,
  divider,
  testID,
}: {
  pack: PackDef;
  status: PackStatus;
  job: Job | undefined;
  failure: DownloadFailure | undefined;
  onDownload: () => void;
  onCancel: () => void;
  onRemove: () => void;
  divider: boolean;
  testID: string;
}) {
  const ready = status.phase === "ready" && !job;
  const partial = status.phase === "partial" && !job;
  const pct = job ? Math.round(job.progress.fraction * 100) : 0;
  const Kind = KIND_ICON[pack.kind];
  return (
    <View style={[styles.row, divider && styles.divider]} testID={testID}>
      <View style={styles.head}>
        <View style={[styles.well, ready && styles.wellReady]}>
          {ready ? (
            <CircleCheck size={size.iconSm} color={colors.success} strokeWidth={2.25} />
          ) : job ? (
            <Hourglass size={size.iconSm} color={colors.accent} strokeWidth={2} />
          ) : (
            <Kind size={size.iconSm} color={colors.ink} strokeWidth={2} />
          )}
        </View>
        <View style={styles.flex}>
          <T variant="body" strong tone="primary" numberOfLines={1}>
            {pack.title}
          </T>
          <T variant="caption" numberOfLines={2} testID={`${testID}-detail`}>
            {packDetail(pack, status)}
          </T>
        </View>
        {job ? (
          <IconButton icon={X} variant="tinted" accessibilityLabel={`Stop downloading ${pack.title}`} onPress={onCancel} testID={`${testID}-cancel`} />
        ) : ready ? (
          <IconButton icon={Trash} accessibilityLabel={`Remove ${pack.title} from this phone`} onPress={onRemove} testID={`${testID}-remove`} />
        ) : (
          <IconButton
            icon={Download}
            variant="tinted"
            accessibilityLabel={partial ? `Finish downloading ${pack.title}` : `Download ${pack.title}`}
            onPress={onDownload}
            testID={`${testID}-download`}
          />
        )}
      </View>
      {job ? (
        <View style={styles.under} testID={`${testID}-progress`}>
          <ProgressBar value={job.progress.fraction} accessibilityLabel={`${pack.title}: ${pct}% downloaded`} testID={`${testID}-bar`} />
          <T variant="caption" numeric>{`${job.progress.done} of ${job.progress.total} · ${pct}%`}</T>
        </View>
      ) : failure ? (
        <View style={[styles.under, styles.note]} testID={`${testID}-failure`}>
          <T variant="caption" tone="reward">
            {FAILURE_COPY[failure]}
          </T>
        </View>
      ) : partial ? (
        <View style={styles.under} testID={`${testID}-partial`}>
          <ProgressBar
            value={status.total ? status.have / status.total : 0}
            tone="reward"
            accessibilityLabel={`${pack.title}: ${status.have} of ${status.total} on this phone`}
            testID={`${testID}-partial-bar`}
          />
          <T variant="caption" numeric>{`${status.have} of ${status.total} on this phone · tap download to finish`}</T>
        </View>
      ) : ready && status.missing > 0 ? (
        <View style={styles.under}>
          <T variant="caption">{`${status.missing} ${status.missing === 1 ? "recording isn't" : "recordings aren't"} online yet; the next download brings ${status.missing === 1 ? "it" : "them"}.`}</T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { paddingVertical: space.sm, gap: space.xs },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  head: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 },
  well: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.ink06, alignItems: "center", justifyContent: "center" },
  wellReady: { backgroundColor: colors.success12 },
  under: { paddingLeft: 40 + space.md, gap: space.xxs },
  note: { paddingRight: space.xs },
});
