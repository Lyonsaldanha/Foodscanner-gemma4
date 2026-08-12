import {
  FIBER_PER_100G,
  PROTEIN_ENERGY_SHARE,
  PROTEIN_PER_100G_FALLBACK,
  SATURATED_FAT_PER_100G,
  SODIUM_PER_100G,
  SUGAR_PER_100G,
} from "./thresholds";
import type { BalanceVerdict, NutrientAdequacyFlag, NutrientFlag, NutritionPer100g } from "../types/scan";

interface ReduceNutrientMeta {
  label: string;
  unit: string;
  lowMax: number;
  highMin: number;
}

const REDUCE_NUTRIENTS: Record<"sugar" | "saturatedFat" | "sodium", ReduceNutrientMeta> = {
  sugar: { label: "sugar", unit: "g", lowMax: SUGAR_PER_100G.lowMaxG, highMin: SUGAR_PER_100G.highMinG },
  saturatedFat: {
    label: "saturated fat",
    unit: "g",
    lowMax: SATURATED_FAT_PER_100G.lowMaxG,
    highMin: SATURATED_FAT_PER_100G.highMinG,
  },
  sodium: { label: "sodium", unit: "mg", lowMax: SODIUM_PER_100G.lowMaxMg, highMin: SODIUM_PER_100G.highMinMg },
};

// Absent data is not treated as risky — a missing value defaults to "low"
// rather than manufacturing a warning the OCR/model didn't actually support.
function flagReduceNutrient(value: number | null, meta: ReduceNutrientMeta): NutrientFlag {
  if (value === null) return "low";
  if (value <= meta.lowMax) return "low";
  if (value > meta.highMin) return "high";
  return "medium";
}

function flagFiber(fiberG: number | null): NutrientAdequacyFlag {
  if (fiberG === null) return "low";
  return fiberG >= FIBER_PER_100G.goodMinG ? "good" : "low";
}

interface ProteinAssessment {
  flag: NutrientAdequacyFlag;
  detail: string | null; // human-readable basis for the flag, for rulesTriggered
}

function assessProtein(proteinG: number | null, energyKcal: number | null): ProteinAssessment {
  if (proteinG === null) return { flag: "low", detail: null };

  if (energyKcal !== null && energyKcal > 0) {
    const energyShare = (proteinG * 4) / energyKcal;
    const flag: NutrientAdequacyFlag = energyShare >= PROTEIN_ENERGY_SHARE.goodMinFraction ? "good" : "low";
    const detail =
      flag === "good"
        ? `Good source of protein (${(energyShare * 100).toFixed(1)}% of energy from protein, >=${
            PROTEIN_ENERGY_SHARE.goodMinFraction * 100
          }% threshold)`
        : null;
    return { flag, detail };
  }

  const flag: NutrientAdequacyFlag = proteinG >= PROTEIN_PER_100G_FALLBACK.goodMinG ? "good" : "low";
  const detail =
    flag === "good"
      ? `Good source of protein (${proteinG}g/100g, >=${PROTEIN_PER_100G_FALLBACK.goodMinG}g/100g threshold)`
      : null;
  return { flag, detail };
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function computeBalanceVerdict(nutrition: NutritionPer100g): BalanceVerdict {
  const sugar = flagReduceNutrient(nutrition.sugarG, REDUCE_NUTRIENTS.sugar);
  const saturatedFat = flagReduceNutrient(nutrition.saturatedFatG, REDUCE_NUTRIENTS.saturatedFat);
  const sodium = flagReduceNutrient(nutrition.sodiumMg, REDUCE_NUTRIENTS.sodium);
  const fiber = flagFiber(nutrition.fiberG);
  const protein = assessProtein(nutrition.proteinG, nutrition.energyKcal);

  const rulesTriggered: string[] = [];
  const reduceValues: Record<"sugar" | "saturatedFat" | "sodium", number | null> = {
    sugar: nutrition.sugarG,
    saturatedFat: nutrition.saturatedFatG,
    sodium: nutrition.sodiumMg,
  };
  const reduceFlags: Record<"sugar" | "saturatedFat" | "sodium", NutrientFlag> = { sugar, saturatedFat, sodium };

  const highNames: string[] = [];
  const mediumNames: string[] = [];

  (Object.keys(REDUCE_NUTRIENTS) as (keyof typeof REDUCE_NUTRIENTS)[]).forEach((key) => {
    const meta = REDUCE_NUTRIENTS[key];
    const value = reduceValues[key];
    const flag = reduceFlags[key];
    if (value === null) return;

    if (flag === "high") {
      highNames.push(meta.label);
      rulesTriggered.push(`High in ${meta.label} (${value}${meta.unit}/100g, threshold >${meta.highMin}${meta.unit}/100g)`);
    } else if (flag === "medium") {
      mediumNames.push(meta.label);
      rulesTriggered.push(
        `Moderate ${meta.label} (${value}${meta.unit}/100g, threshold ${meta.lowMax}-${meta.highMin}${meta.unit}/100g)`
      );
    }
  });

  const goodExtras: string[] = [];
  if (fiber === "good") {
    goodExtras.push("fiber");
    rulesTriggered.push(`Good source of fiber (${nutrition.fiberG}g/100g, >=${FIBER_PER_100G.goodMinG}g/100g threshold)`);
  }
  if (protein.flag === "good") {
    goodExtras.push("protein");
    if (protein.detail) rulesTriggered.push(protein.detail);
  }

  let overall: BalanceVerdict["overall"];
  let summary: string;
  if (highNames.length > 0) {
    overall = "occasional_treat";
    summary = `High in ${joinWithAnd(highNames)} — best as an occasional treat.`;
  } else if (mediumNames.length > 0) {
    overall = "moderate";
    summary = `Moderate ${joinWithAnd(mediumNames)} — fine in moderation.`;
  } else {
    overall = "everyday";
    summary = "Balanced macros for everyday eating.";
  }
  if (goodExtras.length > 0) {
    summary += ` Good source of ${joinWithAnd(goodExtras)}.`;
  }

  return {
    flags: { sugar, saturatedFat, sodium, protein: protein.flag, fiber },
    rulesTriggered,
    overall,
    summary,
  };
}
