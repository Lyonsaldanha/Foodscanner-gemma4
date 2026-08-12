import { detectIngredients } from "./detectIngredients";
import { createMockModelClient } from "./mockEngine";

const dummyImage = { uri: "mock://shortbread.jpg", width: 896, height: 896 };

describe("detectIngredients — traced against the shortbread mock fixture", () => {
  it("resolves every ingredient's source correctly and drops no field", async () => {
    const client = createMockModelClient({ fixtureId: "shortbreadBiscuit", kind: "ingredients" });
    const outcome = await detectIngredients(client, dummyImage);

    expect(outcome.success).toBe(true);
    if (!outcome.success) return;
    const { result } = outcome;

    expect(result.productLabel).toBe("Golden Crumb Shortbread Biscuits");
    expect(result.ingredients).toHaveLength(8);

    // Glossary-hit ingredients: source "glossary", plainMeaning from data.json
    // (not the model's own guess), isHiddenName true.
    const maida = result.ingredients.find((i) => i.rawName === "Maida");
    expect(maida).toMatchObject({
      source: "glossary",
      plainMeaning: "Highly refined wheat flour with the bran and germ milled out — low in fiber and micronutrients, with a higher glycemic impact than whole wheat.",
      category: "refined_flour",
      isHiddenName: true,
      allergen: true,
      confidence: 0.97,
    });

    const soyLecithin = result.ingredients.find((i) => i.rawName === "Soy Lecithin");
    expect(soyLecithin?.source).toBe("glossary");
    expect(soyLecithin?.category).toBe("emulsifier");

    // Model-fallback ingredient: no glossary entry for "Artificial Butter
    // Flavouring", so it must fall back to the model's own guess.
    const butterFlavouring = result.ingredients.find((i) => i.rawName === "Artificial Butter Flavouring");
    expect(butterFlavouring).toMatchObject({
      source: "model",
      plainMeaning: "A lab-made flavour compound designed to mimic butter taste",
      category: "flavour_enhancer",
      isHiddenName: true,
    });

    // Top-level fields must all survive the round trip, not just ingredients.
    expect(result.allergensDetected).toEqual(["Wheat (Gluten)", "Soya"]);
    expect(result.isVegetarian).toBe(true);
    expect(result.fssaiLicenseNumber).toBe("10023045001987");
    expect(result.language).toBe("English");
    expect(result.notes).toBe("No real butter; uses artificial butter flavouring. Contains gluten and soya.");
  });

  it("surfaces a friendly error instead of throwing when the model client fails", async () => {
    const client = createMockModelClient({ fixtureId: "shortbreadBiscuit", kind: "ingredients", failure: "error" });
    await expect(detectIngredients(client, dummyImage)).rejects.toThrow();
  });
});
