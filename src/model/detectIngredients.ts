import type { ModelClient, PreprocessedImage } from "./types";
import { INGREDIENTS_SYSTEM_PROMPT, buildIngredientsUserPrompt } from "./prompts/ingredients";
import { parseModelOutput } from "./parser";
import { RawIngredientsOutputSchema, type RawIngredientEntry } from "./rawOutput";
import { decodeIngredient } from "../glossary/decoder";
import type { DecodedIngredient } from "../types/scan";

export interface IngredientsDetectionResult {
  productLabel: string | null;
  ingredients: DecodedIngredient[];
  allergensDetected: string[];
  isVegetarian: boolean | null;
  fssaiLicenseNumber: string | null;
  language: string | null;
  notes: string | null;
}

export type DetectIngredientsResult =
  | { success: true; result: IngredientsDetectionResult }
  | { success: false; friendlyError: string };

// Glossary lookup wins when it has an entry (deterministic, curated); the
// model's own guess is the fallback for terms the glossary doesn't cover —
// per this repo's confirmed decision, supplied in the *same* inference call
// rather than a second round-trip.
function decodeRawIngredient(raw: RawIngredientEntry): DecodedIngredient {
  const glossaryMatch = decodeIngredient(raw.name);
  if (glossaryMatch) {
    return {
      rawName: raw.name,
      plainMeaning: glossaryMatch.entry.plainMeaning,
      category: glossaryMatch.entry.category,
      source: "glossary",
      isHiddenName: true, // glossary entries are curated hidden/euphemistic names by definition
      allergen: raw.allergen,
      confidence: raw.confidence,
    };
  }

  if (raw.modelPlainMeaning !== null) {
    return {
      rawName: raw.name,
      plainMeaning: raw.modelPlainMeaning,
      category: raw.modelCategory,
      source: "model",
      // The ingredients prompt instructs the model to supply a plain meaning
      // only when the printed name isn't already plain/obvious (see
      // prompts/ingredients.ts), so a non-null value here is itself the
      // hidden-name signal.
      isHiddenName: true,
      allergen: raw.allergen,
      confidence: raw.confidence,
    };
  }

  return {
    rawName: raw.name,
    plainMeaning: null,
    category: null,
    source: null,
    isHiddenName: false,
    allergen: raw.allergen,
    confidence: raw.confidence,
  };
}

export async function detectIngredients(
  client: ModelClient,
  image: PreprocessedImage,
  signal?: AbortSignal
): Promise<DetectIngredientsResult> {
  await client.ensureReady();
  const raw = await client.generate({
    systemPrompt: INGREDIENTS_SYSTEM_PROMPT,
    userPrompt: buildIngredientsUserPrompt(),
    image,
    signal,
  });

  const parsed = parseModelOutput(raw, RawIngredientsOutputSchema);
  if (!parsed.success) {
    return { success: false, friendlyError: parsed.friendlyError };
  }

  const data = parsed.data;
  return {
    success: true,
    result: {
      productLabel: data.productLabel,
      ingredients: data.ingredients.map(decodeRawIngredient),
      allergensDetected: data.allergensDetected,
      isVegetarian: data.isVegetarian,
      fssaiLicenseNumber: data.fssaiLicenseNumber,
      language: data.language,
      notes: data.notes,
    },
  };
}
