import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { pickModelClient } from "../src/model/pickModelClient";
import { describeLoadState } from "../src/model/loadStateLabel";
import type { ModelClient, ModelLoadState } from "../src/model/types";
import { colors, fonts, radii, spacing, strokes } from "../src/ui/theme";

const INK = colors.ink;
const PAPER = colors.paper;
const ACCENT = colors.accent;

export default function Index() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<ModelLoadState>({ status: "not_downloaded" });
  const clientRef = useRef<ModelClient | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // getLoadState() is a poll-based snapshot, not a subscription (T4.1) —
    // this interval is what actually surfaces live download progress while
    // ensureReady()'s promise is in flight on a real device (a multi-second
    // to multi-minute download). On the mock path ensureReady() resolves
    // before the first tick, so this timer fires at most once, if at all.
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    async function run() {
      const client = await pickModelClient();
      if (cancelled) return;
      clientRef.current = client;
      setLoadState(client.getLoadState());

      pollTimer = setInterval(() => {
        if (!cancelled) setLoadState(client.getLoadState());
      }, 250);

      try {
        await client.ensureReady();
      } catch {
        // Swallowed — the failure is already visible via getLoadState()'s
        // "error" status, which ensureReady() itself sets before rejecting.
      } finally {
        if (!cancelled) setLoadState(client.getLoadState());
      }
    }

    run();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const isReady = loadState.status === "ready";
  const hasError = loadState.status === "error";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>INGREDIENT LENS</Text>
      <Text style={hasError ? styles.errorText : styles.bodyText}>{describeLoadState(loadState)}</Text>

      {hasError ? (
        <Pressable style={styles.sketchButton} onPress={retry}>
          <Text style={styles.sketchButtonText}>Retry</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.sketchButton, !isReady && styles.sketchButtonDisabled]}
          disabled={!isReady}
          onPress={() => router.push("/camera")}
          accessibilityLabel="Open camera"
        >
          <Text style={styles.sketchButtonText}>Open Camera</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: INK,
  },
  bodyText: {
    fontSize: 15,
    color: INK,
  },
  errorText: {
    fontSize: 15,
    color: ACCENT,
    textAlign: "center",
    fontWeight: "600",
  },
  sketchButton: {
    borderWidth: strokes.normal,
    borderColor: INK,
    ...radii.sketch,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: PAPER,
  },
  sketchButtonDisabled: {
    opacity: 0.4,
  },
  sketchButtonText: {
    color: INK,
    fontSize: 16,
    fontWeight: "600",
  },
});
