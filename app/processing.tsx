import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { runScan } from "../src/scan/runScan";
import { createMockModelClientForFixture } from "../src/model/mockEngine";
import { setLastScanResult } from "../src/scan/lastScanResult";
import type { CaptureSlots } from "../src/types/capture";
import { colors, fonts, radii, strokes } from "../src/ui/theme";

const INK = colors.ink;
const PAPER = colors.paper;
const ACCENT = colors.accent;

type StepId = "encode" | "ingredients" | "nutrition" | "verdict";
interface Step {
  id: StepId;
  label: string;
}

function buildSteps(hasIngredients: boolean, hasNutrition: boolean): Step[] {
  const steps: Step[] = [{ id: "encode", label: "Encoding image…" }];
  if (hasIngredients) steps.push({ id: "ingredients", label: "Identifying ingredients…" });
  if (hasNutrition) steps.push({ id: "nutrition", label: "Reading nutrition label…" });
  steps.push({ id: "verdict", label: "Computing verdict…" });
  return steps;
}

export default function ProcessingScreen() {
  const params = useLocalSearchParams<{ ingredientsUri?: string; nutritionUri?: string }>();
  const router = useRouter();
  // Checked after runScan resolves so a cancelled scan's result is actually
  // discarded, not just hidden behind a screen that already navigated away.
  const cancelledRef = useRef(false);

  const hasIngredients = !!params.ingredientsUri;
  const hasNutrition = !!params.nutritionUri;
  const steps = useMemo(() => buildSteps(hasIngredients, hasNutrition), [hasIngredients, hasNutrition]);

  const [completedCount, setCompletedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cancelledRef.current = false;

    const slots: CaptureSlots = {
      ingredients: params.ingredientsUri ? { uri: params.ingredientsUri, capturedAt: new Date().toISOString() } : null,
      nutrition: params.nutritionUri ? { uri: params.nutritionUri, capturedAt: new Date().toISOString() } : null,
    };

    // Reveal steps sequentially so the wait (15-28s on real hardware per
    // ingredient-lens-spec.md §12.2) reads as progress, not a stalled spinner.
    // runScan itself has no granular progress callback to drive this off of.
    const revealTimers = steps.slice(0, -1).map((_, index) =>
      setTimeout(() => {
        if (!cancelledRef.current) setCompletedCount((count) => Math.max(count, index + 1));
      }, (index + 1) * 700)
    );

    async function run() {
      try {
        // TODO(real device): swap for the real react-native-litert-lm-backed
        // ModelClient once it's built (T4.1 scoped that out — no device/model
        // exists in this sandbox). Mocked so the full camera->processing->result
        // flow is demoable end-to-end without one.
        const client = createMockModelClientForFixture("shortbreadBiscuit");
        const outcome = await runScan({ client, slots });
        if (cancelledRef.current) return;

        if (!outcome.success) {
          setError(outcome.friendlyError);
          return;
        }
        setCompletedCount(steps.length);
        setLastScanResult(outcome.scanResult);
        router.replace("/result");
      } catch (e) {
        if (cancelledRef.current) return;
        setError(e instanceof Error ? e.message : "Something went wrong. Please retake the photo and try again.");
      }
    }

    run();

    return () => {
      revealTimers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.ingredientsUri, params.nutritionUri]);

  const handleCancel = () => {
    cancelledRef.current = true;
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>ANALYZING</Text>

      <View style={styles.sketchCard}>
        {steps.map((step, index) => {
          const done = index < completedCount;
          return (
            <View key={step.id} style={styles.stepRow}>
              <View style={[styles.stepMark, done && styles.stepMarkDone]}>
                {done ? <Text style={styles.stepMarkText}>✓</Text> : null}
              </View>
              <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
            </View>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.sketchButton} onPress={() => router.replace("/camera")}>
            <Text style={styles.sketchButtonText}>Retake Photo</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.cancelButton} onPress={handleCancel} accessibilityLabel="Cancel analysis">
          <Text style={styles.cancelButtonText}>Cancel</Text>
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
    padding: 24,
    gap: 24,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: INK,
  },
  sketchCard: {
    width: "100%",
    borderWidth: strokes.normal,
    borderColor: INK,
    ...radii.sketch,
    padding: 18,
    gap: 14,
    backgroundColor: PAPER,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  stepMarkDone: {
    backgroundColor: INK,
  },
  stepMarkText: {
    color: PAPER,
    fontSize: 14,
    fontWeight: "700",
  },
  stepLabel: {
    fontSize: 15,
    color: INK,
    opacity: 0.6,
  },
  stepLabelDone: {
    opacity: 1,
    fontWeight: "600",
  },
  cancelButton: {
    borderWidth: strokes.normal,
    borderColor: INK,
    ...radii.sketchTight,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: INK,
    fontWeight: "600",
    fontSize: 15,
  },
  errorCard: {
    alignItems: "center",
    gap: 12,
  },
  errorText: {
    color: ACCENT,
    fontSize: 15,
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
  sketchButtonText: {
    color: INK,
    fontSize: 16,
    fontWeight: "600",
  },
});
