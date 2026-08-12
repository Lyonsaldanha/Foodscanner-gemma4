import { detectNutrition } from "./detectNutrition";
import { createMockModelClient } from "./mockEngine";

const dummyImage = { uri: "mock://shortbread-nutrition.jpg", width: 896, height: 896 };

describe("detectNutrition — traced against the shortbread mock fixture", () => {
  it("passes the model's cleaned numbers through untouched and computes the verdict deterministically", async () => {
    const client = createMockModelClient({ fixtureId: "shortbreadBiscuit", kind: "nutrition" });
    const outcome = await detectNutrition(client, dummyImage);

    expect(outcome.success).toBe(true);
    if (!outcome.success) return;
    const { result } = outcome;

    expect(result.productLabel).toBe("Golden Crumb Shortbread Biscuits");
    // Nutrition numbers must survive untouched — the model's job is OCR +
    // cleaning only, no field should be dropped or altered here.
    expect(result.nutrition).toEqual({
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
    });

    // Same fixture numbers as src/nutrition/ruleEngine.test.ts's shortbread
    // case — the verdict here must match that hand-recomputed expectation
    // exactly, proving the orchestrator didn't silently transform anything
    // before handing off to the rule engine.
    expect(result.balance.flags).toEqual({
      sugar: "high",
      saturatedFat: "high",
      sodium: "medium",
      protein: "low",
      fiber: "low",
    });
    expect(result.balance.overall).toBe("occasional_treat");

    expect(result.language).toBe("English");
    expect(result.notes).toBe("Values are per 100g, as printed on the pack.");
  });

  it("surfaces a rejection instead of throwing an uncaught error when the model client fails", async () => {
    const client = createMockModelClient({ fixtureId: "shortbreadBiscuit", kind: "nutrition", failure: "not_downloaded" });
    await expect(detectNutrition(client, dummyImage)).rejects.toThrow();
  });
});
