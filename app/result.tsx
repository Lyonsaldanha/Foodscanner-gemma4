import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { getLastScanResult } from "../src/scan/lastScanResult";
import { ScanResultView } from "../src/ui/ScanResultView";
import { colors, fonts, radii, spacing, strokes } from "../src/ui/theme";

const INK = colors.ink;
const PAPER = colors.paper;

export default function ResultScreen() {
  const router = useRouter();
  const scanResult = useMemo(() => getLastScanResult(), []);

  if (!scanResult) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.heading}>NO SCAN YET</Text>
        <Text style={styles.bodyText}>Go back and capture a photo to see results here.</Text>
        <Pressable style={styles.sketchButton} onPress={() => router.replace("/camera")}>
          <Text style={styles.sketchButtonText}>Back to Camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Link href="/history" style={styles.historyLink}>
        <Text style={styles.historyLinkText}>View History →</Text>
      </Link>
      <ScanResultView scanResult={scanResult} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 56,
    gap: spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: PAPER,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: INK,
  },
  bodyText: {
    fontSize: 15,
    color: INK,
  },
  historyLink: {
    alignSelf: "flex-end",
    marginBottom: -spacing.sm,
  },
  historyLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: INK,
    textDecorationLine: "underline",
  },
  sketchButton: {
    borderWidth: strokes.normal,
    borderColor: INK,
    ...radii.sketch,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: PAPER,
  },
  sketchButtonText: {
    color: INK,
    fontSize: 16,
    fontWeight: "600",
  },
});
