import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { getLastScanResult } from "../src/scan/lastScanResult";
import { BentoGrid, BentoCell } from "../src/ui/BentoGrid";
import { SketchCard } from "../src/ui/SketchCard";
import { colors, fonts, radii, spacing, strokes } from "../src/ui/theme";
import type { BalanceVerdict, DecodedIngredient } from "../src/types/scan";

const INK = colors.ink;
const PAPER = colors.paper;
const ACCENT = colors.accent;

function IngredientCell({ ingredient }: { ingredient: DecodedIngredient }) {
  return (
    <SketchCard variant={ingredient.allergen ? "emphasized" : "default"}>
      <Text style={styles.ingredientName}>{ingredient.rawName}</Text>

      {ingredient.isHiddenName ? <Text style={styles.hiddenNameBadge}>hidden name</Text> : null}

      {ingredient.plainMeaning ? <Text style={styles.plainMeaning}>{ingredient.plainMeaning}</Text> : null}

      <View style={styles.metaRow}>
        <Text style={styles.confidenceTag}>{Math.round(ingredient.confidence * 100)}%</Text>
        {ingredient.category ? <Text style={styles.categoryTag}>{ingredient.category}</Text> : null}
        {ingredient.source ? <Text style={styles.sourceTag}>{ingredient.source}</Text> : null}
      </View>

      {ingredient.allergen ? <Text style={styles.allergenNote}>⚠ allergen</Text> : null}
    </SketchCard>
  );
}

function BalanceCell({ balance }: { balance: BalanceVerdict }) {
  return (
    <SketchCard>
      <Text style={styles.cellTitle}>BALANCE</Text>
      <Text style={styles.verdictText}>{balance.overall.replace(/_/g, " ")}</Text>
      <Text style={styles.summaryText}>{balance.summary}</Text>
      {balance.rulesTriggered.length > 0 ? (
        <View style={styles.rulesList}>
          {balance.rulesTriggered.map((rule) => (
            <Text key={rule} style={styles.ruleText}>
              • {rule}
            </Text>
          ))}
        </View>
      ) : null}
    </SketchCard>
  );
}

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

  const { productLabel, ingredients, allergensDetected, balance, notes } = scanResult;
  const hasAllergens = allergensDetected.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{productLabel ?? "RESULT"}</Text>

      <BentoGrid>
        {hasAllergens ? (
          <BentoCell span={balance ? 6 : 12}>
            <SketchCard variant="emphasized">
              <Text style={styles.cellTitle}>ALLERGENS</Text>
              {allergensDetected.map((allergen) => (
                <Text key={allergen} style={styles.allergenText}>
                  ⚠ {allergen}
                </Text>
              ))}
            </SketchCard>
          </BentoCell>
        ) : null}

        {balance ? (
          <BentoCell span={hasAllergens ? 6 : 12}>
            <BalanceCell balance={balance} />
          </BentoCell>
        ) : null}

        {ingredients
          ? ingredients.map((ingredient) => (
              <BentoCell span={4} key={ingredient.rawName}>
                <IngredientCell ingredient={ingredient} />
              </BentoCell>
            ))
          : null}

        {notes ? (
          <BentoCell span={12}>
            <SketchCard>
              <Text style={styles.cellTitle}>NOTES</Text>
              <Text style={styles.bodyText}>{notes}</Text>
            </SketchCard>
          </BentoCell>
        ) : null}
      </BentoGrid>
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
  cellTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: INK,
    marginBottom: spacing.xs,
  },
  ingredientName: {
    fontSize: 15,
    fontWeight: "700",
    color: INK,
  },
  hiddenNameBadge: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: PAPER,
    backgroundColor: INK,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  plainMeaning: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: INK,
    opacity: 0.85,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.sm,
  },
  // Confidence as a small hand-drawn-style percentage tag, not a progress
  // bar/gradient fill — CLAUDE.md's explicit instruction for this value.
  confidenceTag: {
    fontSize: 11,
    color: INK,
    borderWidth: 1,
    borderColor: INK,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  categoryTag: {
    fontSize: 11,
    color: INK,
    opacity: 0.7,
    borderWidth: 1,
    borderColor: INK,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  sourceTag: {
    fontSize: 11,
    color: PAPER,
    backgroundColor: INK,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
  allergenNote: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT,
  },
  allergenText: {
    fontSize: 14,
    color: INK,
    marginTop: 4,
  },
  verdictText: {
    fontSize: 16,
    fontWeight: "700",
    color: INK,
    textTransform: "capitalize",
  },
  summaryText: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: INK,
    opacity: 0.85,
  },
  rulesList: {
    marginTop: spacing.sm,
    gap: 4,
  },
  ruleText: {
    fontSize: 12,
    color: INK,
    opacity: 0.85,
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
