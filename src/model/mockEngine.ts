import type { ModelClient, ModelGenerateOptions, ModelLoadState } from "./types";
import type { RawIngredientsOutput, RawNutritionOutput } from "./rawOutput";

// Canned fixture responses so tests and the web preview (no real device/model
// in this sandbox) have deterministic model output. `annapoorni` and
// `ultraMilkChocolate` mirror the documented model output in
// ingredient-lens-spec.md §9.1/§9.2 (field names adapted to this app's camelCase
// raw-output schema); neither of those spec examples included a nutrition
// panel, so their `nutrition` fixture is intentionally null — a deliberate
// case for exercising "no nutrition photo captured" downstream. §9.2's
// example is a two-carton multi-product response; multi-product parsing is
// out of scope for this MVP pass (see plan.md's confirmed decisions), so only
// the chocolate-flavour carton is modelled here as a standalone single-product
// scan. `shortbreadBiscuit` is a new fixture designed to exercise both the
// glossary-hit path (maida, invert sugar syrup, hydrogenated vegetable oil,
// soy lecithin, ammonium bicarbonate, sunset yellow are all real glossary
// entries) and the model-fallback path (salt, artificial butter flavouring
// have no glossary entry) in the same scan; its nutrition numbers match the
// high-sugar/high-satfat fixture in src/nutrition/ruleEngine.test.ts.

const annapoorniIngredients: RawIngredientsOutput = {
  productLabel: "Sri Annapoorni Coconut Chutney Mix",
  ingredients: [
    { name: "Coconuts", confidence: 0.98, allergen: false, modelPlainMeaning: "Whole coconut, used for flavor and texture", modelCategory: "natural" },
    { name: "Roasted Chenna Dal", confidence: 0.97, allergen: true, modelPlainMeaning: "Roasted split chickpeas (chana dal), a legume", modelCategory: "natural" },
    { name: "Green Chilli", confidence: 0.96, allergen: false, modelPlainMeaning: "Fresh green chili pepper, added for heat", modelCategory: "natural" },
    { name: "Curry Leaves", confidence: 0.96, allergen: false, modelPlainMeaning: "Aromatic leaves used in South Indian cooking", modelCategory: "natural" },
    { name: "Ginger", confidence: 0.95, allergen: false, modelPlainMeaning: "Fresh ginger root", modelCategory: "natural" },
    { name: "Mustard", confidence: 0.95, allergen: true, modelPlainMeaning: "Mustard seeds, a common allergen", modelCategory: "natural" },
    { name: "Edible Oil", confidence: 0.94, allergen: false, modelPlainMeaning: "Unspecified vegetable cooking oil", modelCategory: "natural" },
  ],
  allergensDetected: ["Mustard", "Chenna Dal (Legume)"],
  isVegetarian: true,
  fssaiLicenseNumber: "10015064000123",
  dietaryFlags: { jain: false, iyengar: true, sattvic: false },
  language: "English with Hindi instructions",
  notes: "Product is free from artificial colours and preservatives.",
};

const ultraMilkChocolateIngredients: RawIngredientsOutput = {
  productLabel: "Ultra Milk - Chocolate Flavour",
  ingredients: [
    { name: "Fresh Milk", confidence: 0.98, allergen: true, modelPlainMeaning: "Fresh cow's milk", modelCategory: "natural" },
    { name: "Sugar", confidence: 0.97, allergen: false, modelPlainMeaning: "Added sugar", modelCategory: "added_sugar" },
    { name: "Cocoa Powder", confidence: 0.96, allergen: false, modelPlainMeaning: "Powdered cocoa, used for chocolate flavor", modelCategory: "natural" },
    { name: "Whole Milk Powder", confidence: 0.97, allergen: true, modelPlainMeaning: "Dried whole milk in powder form", modelCategory: "natural" },
    { name: "Skim Milk Powder", confidence: 0.96, allergen: true, modelPlainMeaning: "Dried fat-free milk in powder form", modelCategory: "natural" },
    { name: "Vegetable Stabilizer", confidence: 0.94, allergen: false, modelPlainMeaning: "Plant-derived thickener that keeps the drink's texture smooth", modelCategory: "stabilizer_thickener" },
  ],
  allergensDetected: ["Milk"],
  isVegetarian: true,
  fssaiLicenseNumber: null,
  dietaryFlags: null,
  language: "Bahasa Indonesia + English",
  notes: "Contains milk allergens; chocolate-flavoured with added sugar and cocoa.",
};

const shortbreadIngredients: RawIngredientsOutput = {
  productLabel: "Golden Crumb Shortbread Biscuits",
  ingredients: [
    { name: "Maida", confidence: 0.97, allergen: true, modelPlainMeaning: "Refined wheat flour", modelCategory: "refined_flour" },
    { name: "Invert Sugar Syrup", confidence: 0.95, allergen: false, modelPlainMeaning: "A liquid added-sugar syrup", modelCategory: "added_sugar" },
    { name: "Hydrogenated Vegetable Oil", confidence: 0.94, allergen: false, modelPlainMeaning: "Vegetable oil hardened into a solid fat", modelCategory: "trans_fat_source" },
    { name: "Soy Lecithin", confidence: 0.93, allergen: true, modelPlainMeaning: "A soy-derived emulsifier", modelCategory: "emulsifier" },
    { name: "Salt", confidence: 0.98, allergen: false, modelPlainMeaning: "Table salt", modelCategory: "natural" },
    { name: "Ammonium Bicarbonate", confidence: 0.9, allergen: false, modelPlainMeaning: "A leavening agent that bakes off during cooking", modelCategory: "natural" },
    { name: "Artificial Butter Flavouring", confidence: 0.88, allergen: false, modelPlainMeaning: "A lab-made flavour compound designed to mimic butter taste", modelCategory: "flavour_enhancer" },
    { name: "Sunset Yellow", confidence: 0.92, allergen: false, modelPlainMeaning: "A synthetic yellow-orange food dye", modelCategory: "artificial_colour" },
  ],
  allergensDetected: ["Wheat (Gluten)", "Soya"],
  isVegetarian: true,
  fssaiLicenseNumber: "10023045001987",
  dietaryFlags: { jain: true, iyengar: true, sattvic: false },
  language: "English",
  notes: "No real butter; uses artificial butter flavouring. Contains gluten and soya.",
};

const shortbreadNutrition: RawNutritionOutput = {
  productLabel: "Golden Crumb Shortbread Biscuits",
  nutrition: {
    energyKcal: 520,
    proteinG: 5,
    totalCarbG: 65,
    sugarG: 28,
    addedSugarG: 20,
    fiberG: 1.5,
    totalFatG: 28,
    saturatedFatG: 17,
    transFatG: 0.2,
    sodiumMg: 350,
    micronutrients: null,
  },
  language: "English",
  notes: "Values are per 100g, as printed on the pack.",
};

export type MockFixtureId = "annapoorni" | "ultraMilkChocolate" | "shortbreadBiscuit";

interface MockFixtureSet {
  ingredients: RawIngredientsOutput;
  nutrition: RawNutritionOutput | null;
}

const FIXTURES: Record<MockFixtureId, MockFixtureSet> = {
  annapoorni: { ingredients: annapoorniIngredients, nutrition: null },
  ultraMilkChocolate: { ingredients: ultraMilkChocolateIngredients, nutrition: null },
  shortbreadBiscuit: { ingredients: shortbreadIngredients, nutrition: shortbreadNutrition },
};

export function getMockFixture(fixtureId: MockFixtureId): MockFixtureSet {
  return FIXTURES[fixtureId];
}

export interface CreateMockModelClientOptions {
  fixtureId: MockFixtureId;
  kind: "ingredients" | "nutrition";
  // Lets tests exercise the not-ready / error paths without a real device.
  failure?: "not_downloaded" | "error";
}

export function createMockModelClient(options: CreateMockModelClientOptions): ModelClient {
  const { fixtureId, kind, failure } = options;

  return {
    getLoadState(): ModelLoadState {
      if (failure === "not_downloaded") return { status: "not_downloaded" };
      if (failure === "error") return { status: "error", message: "mock model failed to load" };
      return { status: "ready" };
    },

    async ensureReady(): Promise<void> {
      if (failure === "not_downloaded") throw new Error("mock model is not downloaded");
      if (failure === "error") throw new Error("mock model failed to load");
    },

    async generate(_options: ModelGenerateOptions): Promise<string> {
      if (failure) throw new Error("mock model is not ready");

      const fixture = FIXTURES[fixtureId][kind];
      if (!fixture) {
        throw new Error(`no ${kind} fixture recorded for "${fixtureId}"`);
      }
      return JSON.stringify(fixture);
    },
  };
}
