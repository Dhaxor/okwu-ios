// Learn | Practice | Community | Me. Paper bar, ink icons, and a camwood
// bead over the active tab (the 10% accent marks where you are).
import React from "react";
import { StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AudioLines, BookOpen, CircleUser, Users, type IconComponent } from "@/components/glyphs/icons";
import { T } from "@/components/ui";
import { colors, radius, size, space } from "@/constants/theme";
import { useReminderSync } from "@/lib/state";

const icon =
  (Icon: IconComponent) =>
  ({ focused }: { focused: boolean }) => (
    <View style={styles.iconWrap}>
      <View style={[styles.bead, focused && styles.beadOn]} />
      <Icon size={size.tabIcon} color={focused ? colors.ink : colors.ink48} strokeWidth={focused ? 2.25 : 1.75} />
    </View>
  );

const label = ({ focused, children }: { focused: boolean; children: string }) => (
  <T variant="caption" strong={focused} tone={focused ? "primary" : "muted"} numberOfLines={1} maxFontSizeMultiplier={1.2} style={styles.label}>
    {children}
  </T>
);

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Daily reminders follow the game's plan: re-planned on open, on return and after practice.
  useReminderSync();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        // The navigator pads each item 5pt: 4 + 5 + 28 icon box + 16 label + 5 + 4 = 62, inside 64 plus the home inset.
        tabBarStyle: [styles.bar, { height: 64 + insets.bottom, paddingBottom: insets.bottom + space.xxs }],
        tabBarLabel: label,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.ink48,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Learn", tabBarIcon: icon(BookOpen), tabBarButtonTestID: "tab-learn", tabBarAccessibilityLabel: "Learn" }} />
      <Tabs.Screen name="practice" options={{ title: "Practice", tabBarIcon: icon(AudioLines), tabBarButtonTestID: "tab-practice", tabBarAccessibilityLabel: "Practice" }} />
      <Tabs.Screen name="community" options={{ title: "Community", tabBarIcon: icon(Users), tabBarButtonTestID: "tab-community", tabBarAccessibilityLabel: "Community" }} />
      <Tabs.Screen name="me" options={{ title: "Me", tabBarIcon: icon(CircleUser), tabBarButtonTestID: "tab-me", tabBarAccessibilityLabel: "Me" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.bg,
    borderTopColor: colors.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.xxs,
    elevation: 0,
  },
  // Tab labels are English UI chrome at the caption size on a tighter 16pt line.
  label: { lineHeight: 16 },
  iconWrap: { width: size.tabIcon + space.xs, height: size.tabIcon, alignItems: "center", justifyContent: "center" },
  bead: { position: "absolute", top: -space.xs, width: 4, height: 4, borderRadius: radius.pill, backgroundColor: colors.transparent },
  beadOn: { backgroundColor: colors.accent },
});
