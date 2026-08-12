export type IngredientSource = "glossary" | "model";

export interface DecodedIngredient {
  rawName: string; // as OCR'd off the package
  plainMeaning: string | null;
  category: string | null; // "added_sugar" | "refined_flour" | "trans_fat_source" | "preservative" | "emulsifier" | "artificial_colour" | "natural" | ...
  source: IngredientSource | null; // null if neither glossary nor model could resolve it
  isHiddenName: boolean; // true if plainMeaning materially differs from rawName
  allergen: boolean;
  confidence: number;
}

export interface Micronutrient {
  name: string;
  amount: number;
  unit: string;
}

export interface NutritionPer100g {
  energyKcal: number | null;
  proteinG: number | null;
  totalCarbG: number | null;
  sugarG: number | null;
  addedSugarG: number | null;
  fiberG: number | null;
  totalFatG: number | null;
  saturatedFatG: number | null;
  transFatG: number | null;
  sodiumMg: number | null;
  micronutrients: Micronutrient[] | null; // often absent
}

export type NutrientFlag = "low" | "medium" | "high";
export type NutrientAdequacyFlag = "low" | "good";

export interface BalanceVerdict {
  flags: {
    sugar: NutrientFlag;
    saturatedFat: NutrientFlag;
    sodium: NutrientFlag;
    protein: NutrientAdequacyFlag;
    fiber: NutrientAdequacyFlag;
  };
  rulesTriggered: string[]; // human-readable, e.g. "High in sugar (18g/100g, >22.5g/100g threshold)"
  overall: "everyday" | "moderate" | "occasional_treat";
  summary: string; // one templated sentence built from the flags
}

export interface DietaryFlags {
  jain: boolean;
  iyengar: boolean;
  sattvic: boolean;
}

export interface ScanResult {
  scannedAt: string;
  productLabel: string | null;
  ingredients: DecodedIngredient[] | null;
  allergensDetected: string[];
  isVegetarian: boolean | null;
  fssaiLicenseNumber: string | null;
  dietaryFlags: DietaryFlags | null;
  language: string | null;
  nutrition: NutritionPer100g | null;
  balance: BalanceVerdict | null;
  notes: string | null;
}
