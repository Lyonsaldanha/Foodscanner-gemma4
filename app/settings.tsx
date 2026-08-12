import { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Link } from "expo-router";
import type { CaptureSettings } from "../src/types/capture";

const INK = "#2b2a25";
const PAPER = "#f6f1e6";
const ACCENT = "#b3452b";

export default function SettingsScreen() {
  // Local-only for now — no settings persistence layer exists yet (only
  // scan history persistence is in scope this pass, T8.1). What matters for
  // this task is that a fresh mount always starts false, with no stored
  // override required to get there.
  const [autoSinglePhotoMode, setAutoSinglePhotoMode] = useState<CaptureSettings["autoSinglePhotoMode"]>(false);

  return (
    <View style={styles.container}>
      <Link href="/camera" style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Link>

      <Text style={styles.heading}>SETTINGS</Text>

      <View style={styles.sketchCard}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Single-photo auto mode</Text>
            <Text style={styles.rowDescription}>
              Best-effort: try to read both the ingredients panel and the nutrition label from one photo, instead of
              capturing them separately.
            </Text>
          </View>
          <Switch
            value={autoSinglePhotoMode}
            onValueChange={setAutoSinglePhotoMode}
            trackColor={{ false: "#c9c2b0", true: ACCENT }}
            thumbColor={PAPER}
            accessibilityLabel="Single-photo auto mode"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
    padding: 24,
    paddingTop: 56,
    gap: 20,
  },
  backLink: {
    alignSelf: "flex-start",
  },
  backLinkText: {
    color: INK,
    fontSize: 15,
    fontWeight: "600",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
    color: INK,
  },
  sketchCard: {
    borderWidth: 2,
    borderColor: INK,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 8,
    padding: 16,
    backgroundColor: PAPER,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: INK,
  },
  rowDescription: {
    fontSize: 13,
    color: INK,
    opacity: 0.75,
  },
});
