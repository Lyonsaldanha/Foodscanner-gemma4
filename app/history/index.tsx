import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { getScanSummaries, type ScanSummary } from "../../src/db/history";
import { colors, fonts, radii, spacing, strokes } from "../../src/ui/theme";

const INK = colors.ink;
const PAPER = colors.paper;

export default function HistoryScreen() {
  const router = useRouter();
  const [summaries, setSummaries] = useState<ScanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Refetches on every focus (not just on mount) so a scan just completed on
  // the Processing screen shows up immediately on returning here.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      getScanSummaries()
        .then((rows) => {
          if (!cancelled) setSummaries(rows);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>HISTORY</Text>

      {loading ? (
        <Text style={styles.bodyText}>Loading…</Text>
      ) : summaries.length === 0 ? (
        <Text style={styles.bodyText}>No scans yet. Analyzed products will show up here.</Text>
      ) : (
        <FlatList
          data={summaries}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/history/${item.id}`)}
              accessibilityLabel={`View scan: ${item.productLabel ?? "Untitled scan"}`}
            >
              <Text style={styles.rowTitle}>{item.productLabel ?? "Untitled scan"}</Text>
              <View style={styles.rowMetaRow}>
                <Text style={styles.rowMeta}>{new Date(item.scannedAt).toLocaleString()}</Text>
                {item.overall ? <Text style={styles.rowOverall}>{item.overall.replace(/_/g, " ")}</Text> : null}
              </View>
            </Pressable>
          )}
        />
      )}

      <Link href="/camera" style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back to Camera</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
    padding: spacing.lg,
    paddingTop: 56,
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
  list: {
    gap: spacing.sm,
  },
  row: {
    borderWidth: strokes.normal,
    borderColor: INK,
    ...radii.sketch,
    padding: spacing.md,
    backgroundColor: PAPER,
    marginBottom: spacing.sm,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: INK,
  },
  rowMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  rowMeta: {
    fontSize: 12,
    color: INK,
    opacity: 0.7,
  },
  rowOverall: {
    fontSize: 12,
    fontWeight: "600",
    color: INK,
    textTransform: "capitalize",
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
});
