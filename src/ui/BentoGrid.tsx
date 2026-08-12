import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { spacing } from "./theme";

// 12-column grid, deliberately coarse (bento cells are chunky and unequal,
// not fine-grained) — a wide "notes" cell might be 12, a tall "allergens"
// cell 6, small square ingredient cells 4 or 3.
export type BentoSpan = 3 | 4 | 6 | 8 | 9 | 12;

export interface BentoGridProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Percentage-width cells inside a wrapping flex row would overflow their
// row if a `gap` were also applied on the parent (percentages don't shrink
// to make room for it) — so the gutter is instead created as padding
// *inside* each BentoCell, and this negative margin cancels that padding
// back out at the grid's outer edge. Every row's cells still sum to exactly
// 100% width, so there is no overlap regardless of how spans are mixed.
export function BentoGrid({ children, style }: BentoGridProps) {
  return <View style={[styles.grid, style]}>{children}</View>;
}

export interface BentoCellProps {
  span: BentoSpan;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function BentoCell({ span, children, style }: BentoCellProps) {
  return (
    <View style={[styles.cellOuter, { width: `${(span / 12) * 100}%` }]}>
      <View style={style}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.sm,
    marginVertical: -spacing.sm,
  },
  cellOuter: {
    padding: spacing.sm,
  },
});
