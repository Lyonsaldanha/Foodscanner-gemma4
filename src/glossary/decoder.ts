import glossaryData from "./data.json";

export interface GlossaryEntry {
  id: string;
  aliases: string[];
  plainMeaning: string;
  category: string;
  healthNote: string;
}

export type GlossaryMatchType = "exact" | "fuzzy";

export interface GlossaryMatch {
  entry: GlossaryEntry;
  matchedAlias: string;
  matchType: GlossaryMatchType;
}

const GLOSSARY = glossaryData as GlossaryEntry[];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[().,]/g, "")
    .replace(/\s+/g, " ");
}

// Naive English de-pluralizer — good enough for ingredient-list nouns
// (e.g. "preservatives" -> "preservative"), not a full stemmer.
function depluralize(text: string): string {
  if (text.endsWith("ies") && text.length > 4) return text.slice(0, -3) + "y";
  // Sibilant + "es" (boxes -> box, dishes -> dish, glasses -> glass) drops two
  // chars; anything else ending in plain "s" (benzoates -> benzoate) drops one.
  if (/(?:s|x|z|ch|sh)es$/.test(text) && text.length > 4) return text.slice(0, -2);
  if (text.endsWith("s") && !text.endsWith("ss") && text.length > 3) return text.slice(0, -1);
  return text;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

// Allows more edit distance as strings get longer, so a single OCR typo
// doesn't sink a match on long chemical names but short words stay strict
// (e.g. "salt" must not fuzzy-match "malt").
function fuzzyThreshold(length: number): number {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  return 2;
}

export function decodeIngredient(rawName: string): GlossaryMatch | null {
  const normalizedRaw = normalize(rawName);
  if (!normalizedRaw) return null;
  const dePluralRaw = depluralize(normalizedRaw);

  for (const entry of GLOSSARY) {
    for (const alias of entry.aliases) {
      const normalizedAlias = normalize(alias);
      if (normalizedRaw === normalizedAlias || dePluralRaw === depluralize(normalizedAlias)) {
        return { entry, matchedAlias: alias, matchType: "exact" };
      }
    }
  }

  let best: GlossaryMatch | null = null;
  let bestDistance = Infinity;
  for (const entry of GLOSSARY) {
    for (const alias of entry.aliases) {
      const normalizedAlias = depluralize(normalize(alias));
      const distance = levenshtein(dePluralRaw, normalizedAlias);
      const threshold = fuzzyThreshold(Math.max(dePluralRaw.length, normalizedAlias.length));
      if (distance <= threshold && distance < bestDistance) {
        bestDistance = distance;
        best = { entry, matchedAlias: alias, matchType: "fuzzy" };
      }
    }
  }
  return best;
}

export function getGlossaryEntries(): GlossaryEntry[] {
  return GLOSSARY;
}
