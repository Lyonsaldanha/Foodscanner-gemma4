import { decodeIngredient } from "./decoder";

describe("decodeIngredient — exact match", () => {
  it("matches case-insensitively and trims surrounding whitespace", () => {
    const match = decodeIngredient("  MAIDA  ");
    expect(match).not.toBeNull();
    expect(match?.entry.id).toBe("maida");
    expect(match?.matchType).toBe("exact");
  });

  it("matches through plural normalization not present verbatim as an alias", () => {
    const match = decodeIngredient("Sodium Benzoates");
    expect(match).not.toBeNull();
    expect(match?.entry.id).toBe("sodium-benzoate");
    expect(match?.matchType).toBe("exact");
  });

  it("matches a multi-word alias exactly", () => {
    const match = decodeIngredient("high fructose corn syrup");
    expect(match?.entry.id).toBe("hfcs");
    expect(match?.matchType).toBe("exact");
  });
});

describe("decodeIngredient — fuzzy match", () => {
  it("matches a single missing-letter typo", () => {
    const match = decodeIngredient("aspartme");
    expect(match).not.toBeNull();
    expect(match?.entry.id).toBe("aspartame");
    expect(match?.matchType).toBe("fuzzy");
  });

  it("matches a single substituted-letter typo", () => {
    const match = decodeIngredient("tartrazinr");
    expect(match).not.toBeNull();
    expect(match?.entry.id).toBe("tartrazine");
    expect(match?.matchType).toBe("fuzzy");
  });

  it("does not fuzzy-match unrelated short words to avoid false positives", () => {
    // "salt" is 4 letters -> fuzzy threshold is 0, so it must not match "maida" or others.
    const match = decodeIngredient("salt");
    expect(match).toBeNull();
  });
});

describe("decodeIngredient — no match", () => {
  it("returns null for text with no glossary relation", () => {
    expect(decodeIngredient("banana")).toBeNull();
  });

  it("returns null for an empty or whitespace-only string", () => {
    expect(decodeIngredient("")).toBeNull();
    expect(decodeIngredient("   ")).toBeNull();
  });
});
