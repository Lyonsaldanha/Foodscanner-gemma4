import { createMockModelClient, createMockModelClientForFixture, getMockFixture, type MockFixtureId } from "./mockEngine";
import { RawIngredientsOutputSchema, RawNutritionOutputSchema } from "./rawOutput";

const FIXTURE_IDS: MockFixtureId[] = ["annapoorni", "ultraMilkChocolate", "shortbreadBiscuit"];

const dummyImage = { uri: "mock://photo.jpg", width: 896, height: 896 };

describe("mock fixtures validate against the raw-output zod schemas", () => {
  it.each(FIXTURE_IDS)("%s ingredients fixture is schema-valid", (fixtureId) => {
    const { ingredients } = getMockFixture(fixtureId);
    const result = RawIngredientsOutputSchema.safeParse(ingredients);
    expect(result.success).toBe(true);
  });

  it.each(FIXTURE_IDS)("%s nutrition fixture is schema-valid when present", (fixtureId) => {
    const { nutrition } = getMockFixture(fixtureId);
    if (nutrition === null) {
      expect(nutrition).toBeNull();
      return;
    }
    const result = RawNutritionOutputSchema.safeParse(nutrition);
    expect(result.success).toBe(true);
  });
});

describe("createMockModelClient", () => {
  it("generate() returns JSON that round-trips through the zod schema for ingredients", async () => {
    const client = createMockModelClient({ fixtureId: "shortbreadBiscuit", kind: "ingredients" });
    const raw = await client.generate({ systemPrompt: "", userPrompt: "", image: dummyImage });
    const parsed: unknown = JSON.parse(raw);
    const result = RawIngredientsOutputSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("generate() returns JSON that round-trips through the zod schema for nutrition", async () => {
    const client = createMockModelClient({ fixtureId: "shortbreadBiscuit", kind: "nutrition" });
    const raw = await client.generate({ systemPrompt: "", userPrompt: "", image: dummyImage });
    const parsed: unknown = JSON.parse(raw);
    const result = RawNutritionOutputSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("rejects generate() when constructed with a failure mode", async () => {
    const client = createMockModelClient({ fixtureId: "annapoorni", kind: "ingredients", failure: "error" });
    expect(client.getLoadState()).toEqual({ status: "error", message: "mock model failed to load" });
    await expect(client.generate({ systemPrompt: "", userPrompt: "", image: dummyImage })).rejects.toThrow();
  });

  it("throws when asked for a nutrition fixture that doesn't exist for a product", async () => {
    const client = createMockModelClient({ fixtureId: "annapoorni", kind: "nutrition" });
    await expect(client.generate({ systemPrompt: "", userPrompt: "", image: dummyImage })).rejects.toThrow(
      /no nutrition fixture/
    );
  });

  // T13.3's rubber-duck check: confirm generate() actually stops
  // resolving/rejects promptly once an AbortSignal fires mid-flight, not
  // just that some caller stops waiting on it.
  it("rejects promptly, not with fixture data, when aborted while generate() is in flight", async () => {
    const client = createMockModelClient({ fixtureId: "shortbreadBiscuit", kind: "ingredients" });
    const controller = new AbortController();

    const promise = client.generate({ systemPrompt: "", userPrompt: "", image: dummyImage, signal: controller.signal });
    controller.abort(); // fires before generate()'s own microtask-delayed resolution

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects immediately when the signal is already aborted before generate() is even called", async () => {
    const client = createMockModelClientForFixture("shortbreadBiscuit");
    const controller = new AbortController();
    controller.abort();

    await expect(
      client.generate({ systemPrompt: "", userPrompt: "", image: dummyImage, signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
