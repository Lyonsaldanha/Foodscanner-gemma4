import type { ModelClient, PreprocessedImage } from "./types";
import { NUTRITION_SYSTEM_PROMPT, buildNutritionUserPrompt } from "./prompts/nutrition";
import { parseModelOutput } from "./parser";
import { RawNutritionOutputSchema } from "./rawOutput";
import { computeBalanceVerdict } from "../nutrition/ruleEngine";
import type { BalanceVerdict, NutritionPer100g } from "../types/scan";

export interface NutritionDetectionResult {
  productLabel: string | null;
  nutrition: NutritionPer100g;
  balance: BalanceVerdict;
  language: string | null;
  notes: string | null;
}

export type DetectNutritionResult =
  | { success: true; result: NutritionDetectionResult }
  | { success: false; friendlyError: string };

export async function detectNutrition(
  client: ModelClient,
  image: PreprocessedImage
): Promise<DetectNutritionResult> {
  await client.ensureReady();
  const raw = await client.generate({
    systemPrompt: NUTRITION_SYSTEM_PROMPT,
    userPrompt: buildNutritionUserPrompt(),
    image,
  });

  const parsed = parseModelOutput(raw, RawNutritionOutputSchema);
  if (!parsed.success) {
    return { success: false, friendlyError: parsed.friendlyError };
  }

  // The model's only job is OCR + cleaning (see prompts/nutrition.ts); the
  // balance verdict itself is always computed deterministically here, never
  // asked of the model, so it stays explainable and unit-testable.
  const data = parsed.data;
  return {
    success: true,
    result: {
      productLabel: data.productLabel,
      nutrition: data.nutrition,
      balance: computeBalanceVerdict(data.nutrition),
      language: data.language,
      notes: data.notes,
    },
  };
}
