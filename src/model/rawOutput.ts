import { z } from "zod";

// Shapes of the *raw* JSON the model itself is asked to produce, before the
// glossary decoder / rule engine touch it (see this repo's plan.md
// "Module boundary" diagram). Distinct from src/types/scan.ts: e.g. a raw
// ingredient carries the model's own best-guess plain meaning/category so
// the glossary decoder has something to fall back to when it has no local
// match, whereas DecodedIngredient carries the *resolved* meaning + which
// source resolved it.

export const RawIngredientEntrySchema = z.object({
  name: z.string(),
  confidence: z.number().min(0).max(1),
  allergen: z.boolean(),
  modelPlainMeaning: z.string().nullable(),
  modelCategory: z.string().nullable(),
});

export const RawIngredientsOutputSchema = z.object({
  productLabel: z.string().nullable(),
  ingredients: z.array(RawIngredientEntrySchema),
  allergensDetected: z.array(z.string()),
  isVegetarian: z.boolean().nullable(),
  fssaiLicenseNumber: z.string().nullable(),
  language: z.string().nullable(),
  notes: z.string().nullable(),
});

export const RawNutritionPer100gSchema = z.object({
  energyKcal: z.number().nullable(),
  proteinG: z.number().nullable(),
  totalCarbG: z.number().nullable(),
  sugarG: z.number().nullable(),
  addedSugarG: z.number().nullable(),
  fiberG: z.number().nullable(),
  totalFatG: z.number().nullable(),
  saturatedFatG: z.number().nullable(),
  transFatG: z.number().nullable(),
  sodiumMg: z.number().nullable(),
  micronutrients: z.array(z.object({ name: z.string(), amount: z.number(), unit: z.string() })).nullable(),
});

export const RawNutritionOutputSchema = z.object({
  productLabel: z.string().nullable(),
  nutrition: RawNutritionPer100gSchema,
  language: z.string().nullable(),
  notes: z.string().nullable(),
});

export type RawIngredientEntry = z.infer<typeof RawIngredientEntrySchema>;
export type RawIngredientsOutput = z.infer<typeof RawIngredientsOutputSchema>;
export type RawNutritionOutput = z.infer<typeof RawNutritionOutputSchema>;
