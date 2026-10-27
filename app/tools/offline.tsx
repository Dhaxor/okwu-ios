// Offline packs: keep a unit's, the phrasebook's or the library's recordings
// on this phone. Sizes up front, storage used, Wi-Fi only, progress with
// cancel, and plain words when something stops. A downloaded clip plays
// from the phone on every screen (the resolver prefers it); removing a pack
// never touches progress. Downloads are an Okwu Plus feature
// ("offline-packs"); seeing sizes and removing packs is always open.
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { PackRow } from "@/components/feature/tools";
import { Download, HardDrive, Lock, Sparkles, Wifi, WifiOff } from "@/components/glyphs/icons";
import { Button, Card, Chip, ProgressBar, Row, Screen, ScreenHeader, Section, Switch, T, useConfirm, useToast } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { usePlus } from "@/lib/state";
import { FAILURE_COPY, formatBytes, packStatus, storageUsed, useOffline, type PackDef, type PackKind } from "@/lib/tools";

const PENDING_COPY: Record<PackKind, { title: string; detail: string }> = {
  unit: { title: "Course units", detail: "Arrive with the lessons" },
  phrasebook: { title: "Phrasebook", detail: "On its way with the phrasebook" },
  library: { title: "Culture library", detail: "On its way with the library" },
};

export default function OfflinePacks() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const plus = usePlus();
  const off = useOffline();
  const [all, setAll] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/me"));
  const allowed = plus.can("offline-packs");
  const units = off.manifest.packs.filter((p) => p.kind === "unit");
  const others = off.manifest.packs.filter((p) => p.kind !== "unit");
  const statuses = useMemo(() => Object.fromEntries(off.manifest.packs.map((p) => [p.id, packStatus(p, off.state)])), [off.manifest.packs, off.state]);
  const used = storageUsed(off.state);
  const readyCount = off.manifest.packs.filter((p) => statuses[p.id]?.phase === "ready").length;
  const toGo = off.manifest.packs.filter((p) => statuses[p.id]?.phase !== "ready");
  const toGoBytes = toGo.reduce((n, p) => n + (statuses[p.id]?.bytesToGo ?? p.bytes), 0);
  const allBytes = off.manifest.packs.reduce((n, p) => n + p.bytes, 0);
  const busy = Object.keys(off.jobs).length > 0;
  const canFetch = off.supported && !!off.base;

  const paywall = () => router.push({ pathname: "/paywall", params: { from: "offline-packs" } });

  const download = async (pack: PackDef) => {
    if (!allowed) return paywall();
    const r = await off.download(pack.id);
    if (r === null && statuses[pack.id]) toast.show(`${pack.title} is on this phone.`, { tone: "success" });
    else if (r === "wifi" || r === "offline") toast.show(FAILURE_COPY[r], { tone: "warning" });
  };

  const downloadAll = async () => {
    if (!allowed) return paywall();
    setAll(true);
    for (const p of toGo) {
      const r = await off.download(p.id);
      if (r !== null) break;
    }
    setAll(false);
  };

  const remove = async (pack: PackDef) => {
    const ok = await confirm({
      title: `Remove ${pack.title}?`,
      message: "Its recordings leave this phone and play from the internet again. Your progress stays exactly as it is.",
      confirmLabel: "Remove",
      cancelLabel: "Keep it",
      destructive: true,
    });
    if (!ok) return;
    await off.remove(pack.id);
    toast.show(`${pack.title} removed.`, { tone: "neutral" });
  };

  const removeAll = async () => {
    const ok = await confirm({
      title: "Remove every pack?",
      message: `This frees ${formatBytes(used)}. Recordings play from the internet again; your progress stays.`,
      confirmLabel: "Remove all",
      cancelLabel: "Keep them",
      destructive: true,
    });
    if (!ok) return;
    await off.removeAll();
    toast.show("Every pack removed.", { tone: "neutral" });
  };

  const rows = (packs: readonly PackDef[], prefix: string) =>
    packs.map((p, i) => (
      <PackRow
        key={p.id}
        pack={p}
        status={statuses[p.id]!}
        job={off.jobs[p.id]}
        failure={off.failures[p.id]}
        onDownload={() => void download(p)}
        onCancel={() => off.cancel(p.id)}
        onRemove={() => void remove(p)}
        divider={i < packs.length - 1}
        testID={`${prefix}-${i}`}
      />
    ));

  const footer = !off.ready ? undefined : !allowed ? (
    <Button label="Get offline packs with Plus" icon={Sparkles} onPress={paywall} testID="offline-plus-footer" block />
  ) : canFetch && toGo.length > 0 ? (
    <Button
      label={busy ? "Downloading…" : `Download everything · ${formatBytes(toGoBytes)}`}
      icon={Download}
      loading={all}
      disabled={busy}
      onPress={() => void downloadAll()}
      testID="offline-all"
      block
    />
  ) : undefined;

  return (
    <Screen testID="offline" footer={footer}>
      <ScreenHeader
        eyebrow="Your tools"
        title="Offline packs"
        subtitle="Keep recordings on this phone for flights, the village and anywhere the signal drops."
        onBack={close}
        testID="offline-header"
      />

      {!allowed && off.ready ? (
        <Card variant="ink" testID="offline-plus" onPress={paywall} accessibilityLabel="Offline packs come with Okwu Plus. See plans.">
          <View style={styles.plusRow}>
            <View style={styles.flex}>
              <T variant="label" tone="onInkMuted">
                Okwu Plus
              </T>
              <T variant="title" tone="onInk">
                Learn with no signal
              </T>
              <T variant="body" tone="onInkMuted">
                Plus keeps lessons' recordings on your phone. Everything here streams free whenever you're online.
              </T>
            </View>
            <View style={styles.plusMark}>
              <Lock size={20} color={colors.rewardLight} strokeWidth={2} />
            </View>
          </View>
        </Card>
      ) : null}

      {allowed || used > 0 ? (
        <Card testID="offline-storage">
          <View style={styles.storageHead}>
            <View style={styles.well}>
              <HardDrive size={size.icon} color={colors.ink} strokeWidth={2} />
            </View>
            <View style={styles.flex}>
              <T variant="label">On this phone</T>
              <T variant="display" numeric testID="offline-used">
                {formatBytes(used)}
              </T>
            </View>
          </View>
          <View style={styles.storageBar}>
            <ProgressBar value={allBytes ? Math.min(1, used / allBytes) : 0} tone="success" accessibilityLabel={`${formatBytes(used)} of ${formatBytes(allBytes)} kept`} testID="offline-storage-bar" />
            <T variant="caption">
              {[`${readyCount} of ${off.manifest.packs.length} packs`, `about ${formatBytes(allBytes)} for everything`, off.freeBytes !== null ? `${formatBytes(off.freeBytes)} free` : null]
                .filter(Boolean)
                .join(" · ")}
            </T>
          </View>
          {used > 0 ? (
            <View style={styles.storageAction}>
              <Button label="Remove all" variant="ghost" size="sm" onPress={() => void removeAll()} disabled={busy} testID="offline-remove-all" />
            </View>
          ) : null}
        </Card>
      ) : null}

      {!off.supported ? (
        <Card variant="sunk" testID="offline-unsupported">
          <T variant="body" tone="primary">
            {FAILURE_COPY.unsupported}
          </T>
        </Card>
      ) : !off.base ? (
        <Card variant="sunk" testID="offline-not-configured">
          <View style={styles.notice}>
            <WifiOff size={size.iconSm} color={colors.ink68} strokeWidth={2} />
            <T variant="body" tone="secondary" style={styles.flex}>
              {FAILURE_COPY["not-configured"]} Until then every recording plays as you go.
            </T>
          </View>
        </Card>
      ) : null}

      <Card variant="flat" padding="md" testID="offline-settings">
        <Row
          title="Wi-Fi only"
          detail={off.state.wifiOnly ? "Downloads wait for Wi-Fi, so your mobile data stays yours" : "Downloads use mobile data too"}
          icon={Wifi}
          testID="offline-wifi"
          trailing={<Switch value={off.state.wifiOnly} onValueChange={off.setWifiOnly} accessibilityLabel="Download on Wi-Fi only" testID="offline-wifi-switch" />}
        />
      </Card>

      <Section title="Course units" testID="offline-units">
        {units.length > 0 ? (
          <Card variant="flat" padding="md">
            {rows(units, "offline-unit")}
          </Card>
        ) : (
          <Card variant="sunk">
            <T variant="body" tone="muted">
              {PENDING_COPY.unit.detail}.
            </T>
          </Card>
        )}
      </Section>

      <Section title="Phrasebook and library" testID="offline-more">
        <Card variant="flat" padding="md">
          {rows(others, "offline-more")}
          {off.manifest.pending.map((k, i) => (
            <View key={k} style={[styles.pending, (others.length > 0 || i > 0) && styles.pendingDivider]} testID={`offline-pending-${k}`}>
              <View style={styles.flex}>
                <T variant="body" strong tone="primary">
                  {PENDING_COPY[k].title}
                </T>
                <T variant="caption">{PENDING_COPY[k].detail}</T>
              </View>
              <Chip label="Soon" tone="neutral" testID={`offline-pending-${k}-chip`} />
            </View>
          ))}
        </Card>
      </Section>

      <T variant="caption" center>
        Recordings stream whenever you're online. Packs keep them for when you're not; removing one never touches your progress.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  storageHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  well: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.success12, alignItems: "center", justifyContent: "center" },
  storageBar: { gap: space.xs, marginTop: space.md },
  storageAction: { flexDirection: "row", justifyContent: "flex-end", marginTop: space.xs, marginBottom: -space.sm },
  notice: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  plusRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  plusMark: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.onInk12, alignItems: "center", justifyContent: "center" },
  pending: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, minHeight: 56 },
  pendingDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
});
