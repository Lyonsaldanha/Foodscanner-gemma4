import { z } from "zod";
import { parseModelOutput } from "./parser";
import { RawIngredientsOutputSchema } from "./rawOutput";

const simpleSchema = z.object({ name: z.string(), count: z.number() });
const validPayload = { name: "maida", count: 2 };

describe("parseModelOutput — rung 1: well-formed JSON", () => {
  it("parses and validates a plain JSON string with no wrapping", () => {
    const result = parseModelOutput(JSON.stringify(validPayload), simpleSchema);
    expect(result).toEqual({ success: true, data: validPayload, rung: "well_formed" });
  });
});

describe("parseModelOutput — rung 2: markdown-fenced JSON", () => {
  it("strips a ```json ... ``` fence and parses what's inside", () => {
    const raw = "```json\n" + JSON.stringify(validPayload) + "\n```";
    const result = parseModelOutput(raw, simpleSchema);
    expect(result).toEqual({ success: true, data: validPayload, rung: "fenced" });
  });

  it("strips a plain ``` ... ``` fence with no language tag", () => {
    const raw = "```\n" + JSON.stringify(validPayload) + "\n```";
    const result = parseModelOutput(raw, simpleSchema);
    expect(result).toEqual({ success: true, data: validPayload, rung: "fenced" });
  });
});

describe("parseModelOutput — rung 3: malformed but extractable (JSON embedded in prose)", () => {
  it("extracts a JSON object surrounded by unfenced commentary", () => {
    const raw = `Sure, here's the result:\n${JSON.stringify(validPayload)}\nHope that helps!`;
    const result = parseModelOutput(raw, simpleSchema);
    expect(result).toEqual({ success: true, data: validPayload, rung: "extracted" });
  });
});

describe("parseModelOutput — rung 4: unparseable -> friendly error", () => {
  it("returns a friendly error for text with no JSON at all", () => {
    const result = parseModelOutput("I'm sorry, I can't process this image.", simpleSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.friendlyError).toMatch(/retake the photo/i);
    }
  });

  it("returns a friendly error for syntactically broken JSON", () => {
    const result = parseModelOutput("{ name: 'maida', count: }", simpleSchema);
    expect(result.success).toBe(false);
  });

  it("returns a friendly error when JSON is syntactically valid but fails schema validation", () => {
    const raw = JSON.stringify({ name: "maida" }); // missing required "count"
    const result = parseModelOutput(raw, simpleSchema);
    expect(result.success).toBe(false);
  });
});

describe("parseModelOutput — integration with the real ingredients schema", () => {
  it("validates a well-formed RawIngredientsOutput payload", () => {
    const payload = {
      productLabel: "Test Product",
      ingredients: [
        { name: "Maida", confidence: 0.9, allergen: true, modelPlainMeaning: "Refined wheat flour", modelCategory: "refined_flour" },
      ],
      allergensDetected: ["Wheat"],
      isVegetarian: true,
      fssaiLicenseNumber: null,
      dietaryFlags: { jain: true, iyengar: true, sattvic: false },
      language: "English",
      notes: null,
    };
    const result = parseModelOutput(JSON.stringify(payload), RawIngredientsOutputSchema);
    expect(result.success).toBe(true);
  });
});
