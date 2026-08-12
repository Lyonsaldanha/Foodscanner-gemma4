// Per-100g nutrient cutoffs the rule engine (T3.2) evaluates cleaned label
// data against. Kept in one place, each with its rationale, so the balance
// verdict stays an explainable heuristic instead of an invented one.

// UK Food Standards Agency Front-of-Pack (FoP) traffic-light thresholds,
// evaluated per 100g of product (https://www.gov.uk/government/publications/
// front-of-pack-nutrition-labelling-guidance): low <= lowMaxG, high > highMinG,
// medium in between.
export const SUGAR_PER_100G = {
  lowMaxG: 5,
  highMinG: 22.5,
} as const;

export const SATURATED_FAT_PER_100G = {
  lowMaxG: 1.5,
  highMinG: 5,
} as const;

// FSA publishes this cutoff in salt, not sodium: low <= 0.3g salt/100g,
// high > 1.5g salt/100g. Converted to sodium via the standard salt = sodium x 2.5
// factor (salt is ~39% sodium by mass) since the app's schema stores sodiumMg.
export const SODIUM_PER_100G = {
  lowMaxMg: 120, // 0.3g salt / 2.5 * 1000
  highMinMg: 600, // 1.5g salt / 2.5 * 1000
} as const;

// EU/UK Nutrition and Health Claims Regulation (EC) No 1924/2006, Annex —
// "SOURCE OF FIBRE" claim requires >= 3g fibre per 100g.
export const FIBER_PER_100G = {
  goodMinG: 3,
} as const;

// Same Annex — "SOURCE OF PROTEIN" claim requires protein to provide >= 12%
// of the food's energy value. Preferred when energyKcal is available.
export const PROTEIN_ENERGY_SHARE = {
  goodMinFraction: 0.12,
} as const;

// Fallback only: used when energyKcal is null and the %-of-energy claim
// above can't be computed. Not an official regulatory threshold — a common
// simplified proxy ("5g+ protein per 100g reads as a decent source").
export const PROTEIN_PER_100G_FALLBACK = {
  goodMinG: 5,
} as const;
