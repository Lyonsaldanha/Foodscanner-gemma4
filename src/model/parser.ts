import type { z } from "zod";

// Untrusted model text -> validated data. Implements the fallback chain
// this repo's plan.md documents: 1) well-formed JSON, 2) markdown-fenced
// JSON, 3) JSON embedded in surrounding prose (no fence) but otherwise
// syntactically valid, 4) truly unparseable -> a friendly error instead of
// a crash. Each rung both parses AND zod-validates — a syntactically valid
// but schema-mismatched object does not count as success at that rung.

export type ParseRung = "well_formed" | "fenced" | "extracted";

export type ParseModelOutputResult<T> =
  | { success: true; data: T; rung: ParseRung }
  | { success: false; friendlyError: string };

function tryParseAndValidate<T>(text: string, schema: z.ZodType<T>): T | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const result = schema.safeParse(json);
  return result.success ? result.data : null;
}

function stripCodeFences(text: string): string | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return match ? match[1] : null;
}

function extractBracedSubstring(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function parseModelOutput<T>(raw: string, schema: z.ZodType<T>): ParseModelOutputResult<T> {
  const wellFormed = tryParseAndValidate(raw, schema);
  if (wellFormed) return { success: true, data: wellFormed, rung: "well_formed" };

  const fenced = stripCodeFences(raw);
  if (fenced) {
    const fencedResult = tryParseAndValidate(fenced, schema);
    if (fencedResult) return { success: true, data: fencedResult, rung: "fenced" };
  }

  const extracted = extractBracedSubstring(raw);
  if (extracted) {
    const extractedResult = tryParseAndValidate(extracted, schema);
    if (extractedResult) return { success: true, data: extractedResult, rung: "extracted" };
  }

  return {
    success: false,
    friendlyError: "We couldn't read the model's response. Please retake the photo and try again.",
  };
}
