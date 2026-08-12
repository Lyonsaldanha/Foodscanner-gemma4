import { runScan } from "./runScan";
import { createMockModelClientForFixture } from "../model/mockEngine";
import type { CaptureSlots } from "../types/capture";

// runScan's job is to thread preprocessImage's output through, not to
// re-verify image manipulation itself (already covered in
// src/camera/preprocess.test.ts) — mocked here to avoid the native bridge.
jest.mock("../camera/preprocess", () => ({
  preprocessImage: jest.fn(async (uri: string) => ({ uri: `preprocessed:${uri}`, width: 896, height: 896 })),
}));

const ingredientsOnly: CaptureSlots = {
  ingredients: { uri: "file://ingredients.jpg", capturedAt: "2026-01-01T00:00:00.000Z" },
  nutrition: null,
};
const nutritionOnly: CaptureSlots = {
  ingredients: null,
  nutrition: { uri: "file://nutrition.jpg", capturedAt: "2026-01-01T00:00:00.000Z" },
};
const both: CaptureSlots = {
  ingredients: { uri: "file://ingredients.jpg", capturedAt: "2026-01-01T00:00:00.000Z" },
  nutrition: { uri: "file://nutrition.jpg", capturedAt: "2026-01-01T00:00:00.000Z" },
};

describe("runScan — ingredients-only capture", () => {
  it("populates ingredient fields and leaves nutrition/balance null", async () => {
    const client = createMockModelClientForFixture("shortbreadBiscuit");
    const outcome = await runScan({ client, slots: ingredientsOnly });

    expect(outcome.success).toBe(true);
    if (!outcome.success) return;
    const { scanResult } = outcome;

    expect(scanResult.productLabel).toBe("Golden Crumb Shortbread Biscuits");
    expect(scanResult.ingredients).toHaveLength(8);
    expect(scanResult.allergensDetected).toEqual(["Wheat (Gluten)", "Soya"]);
    // Not captured -> not attempted -> must stay null, not a fabricated verdict.
    expect(scanResult.nutrition).toBeNull();
    expect(scanResult.balance).toBeNull();
  });
});

describe("runScan — nutrition-only capture", () => {
  it("populates nutrition/balance fields and leaves ingredient fields null/empty", async () => {
    const client = createMockModelClientForFixture("shortbreadBiscuit");
    const outcome = await runScan({ client, slots: nutritionOnly });

    expect(outcome.success).toBe(true);
    if (!outcome.success) return;
    const { scanResult } = outcome;

    expect(scanResult.nutrition).not.toBeNull();
    expect(scanResult.balance?.overall).toBe("occasional_treat");
    // Not captured -> not attempted -> must stay null/empty, not corrupted by the nutrition call.
    expect(scanResult.ingredients).toBeNull();
    expect(scanResult.allergensDetected).toEqual([]);
    expect(scanResult.isVegetarian).toBeNull();
  });
});

describe("runScan — both photos captured", () => {
  it("merges ingredient and nutrition fields into one ScanResult without either corrupting the other", async () => {
    const client = createMockModelClientForFixture("shortbreadBiscuit");
    const outcome = await runScan({ client, slots: both });

    expect(outcome.success).toBe(true);
    if (!outcome.success) return;
    const { scanResult } = outcome;

    expect(scanResult.ingredients).toHaveLength(8);
    expect(scanResult.nutrition).not.toBeNull();
    expect(scanResult.balance?.overall).toBe("occasional_treat");
    expect(scanResult.productLabel).toBe("Golden Crumb Shortbread Biscuits");
    // Both sides recorded a note — both must survive the merge, not just one.
    expect(scanResult.notes).toContain("No real butter");
    expect(scanResult.notes).toContain("per 100g");
  });

  it("rejects rather than resolving when the model client itself fails (ensureReady/generate throw, same as detectIngredients/detectNutrition)", async () => {
    const client = createMockModelClientForFixture("shortbreadBiscuit", "error");
    await expect(runScan({ client, slots: both })).rejects.toThrow();
  });
});

describe("runScan — cancellation (T13.3)", () => {
  it("rejects rather than resolving when the scan is aborted mid-flight", async () => {
    const client = createMockModelClientForFixture("shortbreadBiscuit");
    const controller = new AbortController();
    controller.abort();

    await expect(runScan({ client, slots: both, signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
