import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { getScanById } from "../../src/db/history";
import { ScanResultView } from "../../src/ui/ScanResultView";
import { colors, fonts, radii, spacing, strokes } from "../../src/ui/theme";
import type { ScanResult } from "../../src/types/scan";

const INK = colors.ink;
const PAPER = colors.paper;

type LoadState = { status: "loading" } | { status: "found"; scan: ScanResult } | { status: "not_found" };

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const numericId = Number(id);
  // Derived at render time, not stored in state — an unparseable id is
  // "not found" on every render, no fetch (or setState) required to know that.
  const idIsValid = Number.isFinite(numericId);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!idIsValid) return;
    let cancelled = false;
    getScanById(numericId).then((scan) => {
      if (cancelled) return;
      setState(scan ? { status: "found", scan } : { status: "not_found" });
    });
    return () => {
      cancelled = true;
    };
  }, [numericId, idIsValid]);

  if (!idIsValid || state.status === "not_found") {
    return (
      <View style={styles.centered}>
        <Text style={styles.heading}>SCAN NOT FOUND</Text>
        <Pressable style={styles.sketchButton} onPress={() => router.replace("/history")}>
          <Text style={styles.sketchButtonText}>Back to History</Text>
        </Pressable>
      </View>
    );
  }

  if (state.status === "loading") {
    return (
      <View style={styles.centered}>
        <Text style={styles.bodyText}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Link href="/history" style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back to History</Text>
      </Link>
      <ScanResultView scanResult={state.scan} />
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
  centered: {
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
  backLink: {
    alignSelf: "flex-start",
  },
  backLinkText: {
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
