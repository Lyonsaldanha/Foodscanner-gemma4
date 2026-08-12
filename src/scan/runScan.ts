import type { ModelClient } from "../model/types";
import { detectIngredients, type IngredientsDetectionResult } from "../model/detectIngredients";
import { detectNutrition, type NutritionDetectionResult } from "../model/detectNutrition";
import { preprocessImage } from "../camera/preprocess";
import type { CaptureSlots } from "../types/capture";
import type { ScanResult } from "../types/scan";

export interface RunScanInput {
  client: ModelClient;
  slots: CaptureSlots;
}

export type RunScanOutcome = { success: true; scanResult: ScanResult } | { success: false; friendlyError: string };

// The single place that branches on which photo(s) were captured. Each
// branch is independent — an absent or failed nutrition photo must not
// corrupt or block ingredients data, and vice versa, so the two detect*
// calls are not wrapped in a single try/catch that conflates their errors.
export async function runScan({ client, slots }: RunScanInput): Promise<RunScanOutcome> {
  let ingredients: IngredientsDetectionResult | null = null;
  let nutrition: NutritionDetectionResult | null = null;

  if (slots.ingredients) {
    const image = await preprocessImage(slots.ingredients.uri);
    const outcome = await detectIngredients(client, image);
    if (!outcome.success) return { success: false, friendlyError: outcome.friendlyError };
    ingredients = outcome.result;
  }

  if (slots.nutrition) {
    const image = await preprocessImage(slots.nutrition.uri);
    const outcome = await detectNutrition(client, image);
    if (!outcome.success) return { success: false, friendlyError: outcome.friendlyError };
    nutrition = outcome.result;
  }

  const notes = [ingredients?.notes, nutrition?.notes].filter((note): note is string => !!note).join(" ");

  const scanResult: ScanResult = {
    scannedAt: new Date().toISOString(),
    productLabel: ingredients?.productLabel ?? nutrition?.productLabel ?? null,
    ingredients: ingredients?.ingredients ?? null,
    allergensDetected: ingredients?.allergensDetected ?? [],
    isVegetarian: ingredients?.isVegetarian ?? null,
    fssaiLicenseNumber: ingredients?.fssaiLicenseNumber ?? null,
    language: ingredients?.language ?? nutrition?.language ?? null,
    nutrition: nutrition?.nutrition ?? null,
    balance: nutrition?.balance ?? null,
    notes: notes || null,
  };

  return { success: true, scanResult };
}
