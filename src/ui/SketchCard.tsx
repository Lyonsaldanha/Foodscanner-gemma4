import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, strokes } from "./theme";

export interface SketchCardProps {
  children: ReactNode;
  // "emphasized" is for allergen/warning cells only — CLAUDE.md reserves the
  // accent color exclusively for those, so this is the one place it appears.
  variant?: "default" | "emphasized";
  style?: StyleProp<ViewStyle>;
}

export function SketchCard({ children, variant = "default", style }: SketchCardProps) {
  if (variant === "emphasized") {
    // The "occasional double-stroke (as if redrawn)" look CLAUDE.md calls
    // for on emphasized cells: two overlapping bordered boxes, not a single
    // heavier stroke — a border-width value alone can't produce this.
    return (
      <View style={[styles.emphasizedOuter, style]}>
        <View style={styles.emphasizedInner}>{children}</View>
      </View>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: strokes.normal,
    borderColor: colors.ink,
    ...radii.sketch,
    backgroundColor: colors.paper,
    padding: 16,
  },
  emphasizedOuter: {
    borderWidth: strokes.emphasized,
    borderColor: colors.accent,
    ...radii.sketch,
    backgroundColor: colors.paper,
    padding: 4,
  },
  emphasizedInner: {
    borderWidth: strokes.normal,
    borderColor: colors.accent,
    ...radii.sketch,
    padding: 12,
  },
});
