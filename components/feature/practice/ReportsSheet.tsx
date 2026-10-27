// The problems this learner reported, kept on the phone until our reviewers'
// queue can take them. "Share" sends the list as text (mail, a message to
// support); where sharing is unavailable (the web preview) the text is shown
// to copy instead.
import React, { useEffect, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { Button, Chip, Sheet, T } from "@/components/ui";
import { colors, radius, space } from "@/constants/theme";
import { CATEGORY_LABELS, reportsText } from "@/lib/state/reports";
import { useContentReports } from "@/lib/state/useReports";

export function ReportsSheet({ visible, onClose, testID }: { visible: boolean; onClose: () => void; testID: string }) {
  const { reports } = useContentReports();
  const [asText, setAsText] = useState(false);

  useEffect(() => {
    if (visible) setAsText(false);
  }, [visible]);

  const share = async () => {
    const text = `Okwu: problems I reported (${reports.length})\n\n${reportsText(reports)}\n`;
    try {
      const r = await Share.share({ message: text, title: "Okwu problem reports" });
      if (r.action === Share.dismissedAction) return;
    } catch {
      setAsText(true);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Problems you reported"
      subtitle="Saved on this phone for our native reviewers. Thank you: every report makes Okwu more right."
      scroll
      testID={testID}
      footer={
        <>
          <Button label="Share as text" onPress={() => void share()} disabled={reports.length === 0} testID={`${testID}-share`} block />
          <Button label="Close" variant="ghost" onPress={onClose} testID={`${testID}-close`} block />
        </>
      }
    >
      <View style={styles.list}>
        {reports.length === 0 ? (
          <T variant="body" tone="muted" testID={`${testID}-empty`}>
            Nothing reported yet. Use the flag on any word that looks wrong.
          </T>
        ) : (
          reports.map((r, i) => (
            <View key={r.id} style={[styles.row, i > 0 && styles.rule]} testID={`${testID}-row-${i}`}>
              <View style={styles.rowHead}>
                <T variant="title" igbo style={styles.flex} numberOfLines={1}>
                  {r.shown}
                </T>
                <T variant="caption">{r.createdAt.slice(0, 10)}</T>
              </View>
              <View style={styles.chips}>
                {r.categories.map((c) => (
                  <Chip key={c} label={CATEGORY_LABELS[c].title} testID={`${testID}-row-${i}-${c}`} />
                ))}
                <Chip label={r.status === "sent" ? "Sent" : "Waiting to send"} tone={r.status === "sent" ? "success" : "reward"} testID={`${testID}-row-${i}-status`} />
              </View>
              {r.note ? <T variant="caption">{`“${r.note}”`}</T> : null}
            </View>
          ))
        )}
        {asText ? (
          <View style={styles.text} testID={`${testID}-text`}>
            <T variant="caption" selectable>
              {reportsText(reports)}
            </T>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: space.xs },
  row: { gap: space.xs, paddingVertical: space.sm },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  rowHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  text: { marginTop: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceSunk },
});
