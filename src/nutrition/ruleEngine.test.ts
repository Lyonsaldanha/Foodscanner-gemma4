import { computeBalanceVerdict } from "./ruleEngine";
import type { NutritionPer100g } from "../types/scan";

// Shortbread-biscuit-shaped fixture: high sugar (>22.5g/100g), high
// saturated fat (>5g/100g), medium sodium, low fiber, low protein.
const shortbreadBiscuit: NutritionPer100g = {
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
};

// Lower-sugar, higher-fiber/protein fixture (whole-grain cracker shaped):
// all reduce-nutrients low, both adequacy nutrients good.
const wholeGrainCracker: NutritionPer100g = {
  energyKcal: 380,
  proteinG: 12,
  totalCarbG: 60,
  sugarG: 3,
  addedSugarG: 1,
  fiberG: 6,
  totalFatG: 8,
  saturatedFatG: 1,
  transFatG: 0,
  sodiumMg: 100,
  micronutrients: null,
};

describe("computeBalanceVerdict — shortbread biscuit (high sugar/satfat) fixture", () => {
  const verdict = computeBalanceVerdict(shortbreadBiscuit);

  it("flags sugar and saturated fat high, sodium medium, protein and fiber low", () => {
    expect(verdict.flags).toEqual({
      sugar: "high",
      saturatedFat: "high",
      sodium: "medium",
      protein: "low",
      fiber: "low",
    });
  });

  it("cites the exact values and thresholds that triggered each rule", () => {
    expect(verdict.rulesTriggered).toEqual([
      "High in sugar (28g/100g, threshold >22.5g/100g)",
      "High in saturated fat (17g/100g, threshold >5g/100g)",
      "Moderate sodium (350mg/100g, threshold 120-600mg/100g)",
    ]);
  });

  it("rolls up to occasional_treat with a matching summary", () => {
    expect(verdict.overall).toBe("occasional_treat");
    expect(verdict.summary).toBe("High in sugar and saturated fat — best as an occasional treat.");
  });
});

describe("computeBalanceVerdict — whole-grain cracker (lower-sugar) fixture", () => {
  const verdict = computeBalanceVerdict(wholeGrainCracker);

  it("flags all reduce-nutrients low and both adequacy nutrients good", () => {
    expect(verdict.flags).toEqual({
      sugar: "low",
      saturatedFat: "low",
      sodium: "low",
      protein: "good",
      fiber: "good",
    });
  });

  it("cites the fiber and energy-share protein rules that triggered", () => {
    expect(verdict.rulesTriggered).toEqual([
      "Good source of fiber (6g/100g, >=3g/100g threshold)",
      "Good source of protein (12.6% of energy from protein, >=12% threshold)",
    ]);
  });

  it("rolls up to everyday with a matching summary", () => {
    expect(verdict.overall).toBe("everyday");
    expect(verdict.summary).toBe("Balanced macros for everyday eating. Good source of fiber and protein.");
  });
});
