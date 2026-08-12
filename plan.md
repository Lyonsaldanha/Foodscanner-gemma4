# Ingredient Lens — Build Plan (MVP-first)

> **What this file is**: the living build plan for this project, using an atomic-task execution method. It is the source of truth for *why* each piece exists and *what's actually been verified*, not just what's been written. See [CLAUDE.md](CLAUDE.md) for the short pointer/usage note; this file has the full plan and per-task progress.
>
> **How to use it**: before starting new work, check the task list below for the next unchecked item and read its Context so you understand *why* it exists, not just what file to touch. When a task is done, fill in its **Result**, **Rubber-duck check**, and **Completion summary** fields directly in this file (don't just mark it done elsewhere) — that record is what lets the next session (human or Claude) trust "done" without re-deriving it from scratch.

## Context

The repo started as planning docs only (`ingredient-lens-spec.md`, `ingredient-lens-spec-india.md`, `CLAUDE.md`, an empty `architecture.md`) — no code existed. The generic spec framed the product as "identify ingredients in a photo," but the real use case, confirmed with the user, is sharper and more useful: **a shopper standing in a grocery aisle deciding between packaged products** (e.g. shortbread biscuits) needs two things fast:

1. **Ingredient decoding** — plain-English meaning for euphemistic/hidden ingredient names (maida → refined flour, invert sugar syrup → added sugar, maltodextrin, hydrogenated oil, etc.), so unfamiliar-sounding terms don't slip past them.
2. **A nutrition balance verdict** — not just the raw Nutrition Facts numbers, but whether the product is macro-balanced, computed deterministically from cleaned data, with micronutrients treated as optional (packaging often omits them).

This is being built as an "AI-native engineered" product: the LLM (Gemma 4 E2B via LiteRT-LM) is scoped tightly to what only a vision-language model can do (OCR + data cleaning), while everything that can be deterministic — ingredient decoding against a curated glossary, and the nutrition balance verdict against fixed thresholds — is plain, testable TypeScript. This keeps the app's core judgments explainable and unit-testable instead of being opaque LLM output.

Confirmed decisions driving this plan:
- **Scope**: MVP-first. Camera → Processing → Result is the full, real build target this pass. Onboarding, model-download screen, and History screen are designed-for in the schema but not built this pass.
- **India fields** (`is_vegetarian`, FSSAI license number) are always part of the one universal schema/prompt — no locale gating.
- **Revision (2026-08-12)**: the schema originally also carried a `dietaryFlags` field (`jain`/`iyengar`/`sattvic` booleans, judged by the model from the ingredient list). Removed entirely per user feedback: unlike the glossary (grounded in what manufacturers actually put in a product and why) or the nutrition rule engine (grounded in published FSA thresholds), `dietaryFlags` — especially `sattvic`, a philosophical/religious purity judgment — had no comparably rigorous basis and read as a superficial "cultural stamp" rather than the kind of factual, checkable claim the rest of this app is built to make. See the dated notes under T1.1, T4.3, and T4.5 below for what specifically changed.
- **Capture flow**: unguided. One camera screen, a top toggle selecting capture target (Ingredients panel / Nutrition label), shutter stays at the bottom in its normal spot and captures into whichever slot is selected. Either or both can be captured, in any order. A Settings screen holds a "single-photo auto mode" toggle (best-effort, both panels from one photo) — **off by default**.
- **Ingredient decoding**: bundled offline glossary (deterministic, unit-testable) is the primary source; the model supplies its own best-guess plain meaning for terms not in the glossary, in the *same* inference call (no second round-trip). The app marks each decoded ingredient's `source: "glossary" | "model"` so the two qualities of answer are distinguishable in the UI and independently testable.
- **Nutrition verdict**: the model's only job on the nutrition photo is OCR + cleaning (normalize units, handle per-100g vs per-serving, null out absent fields). A deterministic rule engine (plain TypeScript, no model call) computes per-nutrient flags and the overall verdict from those cleaned numbers, using published-style per-100g thresholds (UK FSA traffic-light cutoffs) as the documented basis — not a medical claim, an explainable heuristic.
- **Reality check for this sandbox**: no real Android device, no downloaded `.litertlm` weights, no real product photos are available in the dev environment this was built in. Real on-device inference cannot be run or verified there. Everything is built against the real, documented APIs (`react-native-litert-lm`, `litert-lm-api`) behind a `ModelClient` abstraction, with a mock implementation so all business logic (glossary matching, rule engine, parsing) is fully unit-tested without a device. Real-device verification and the spec's mandated 20+-real-photo validation gate are explicitly manual steps for whoever has the real hardware/photos.

## Architecture

### Schema (supersedes the generic spec's `{ingredients, allergens_detected, language, notes}` shape)

`src/types/scan.ts`:
```ts
type IngredientSource = "glossary" | "model";

interface DecodedIngredient {
  rawName: string;           // as OCR'd off the package
  plainMeaning: string | null;
  category: string | null;   // "added_sugar" | "refined_flour" | "trans_fat_source" | "preservative" | "emulsifier" | "artificial_colour" | "natural" | ...
  source: IngredientSource | null; // null if neither glossary nor model could resolve it
  isHiddenName: boolean;     // true if plainMeaning materially differs from rawName
  allergen: boolean;
  confidence: number;
}

interface NutritionPer100g {
  energyKcal: number | null;
  proteinG: number | null;
  totalCarbG: number | null;
  sugarG: number | null;
  addedSugarG: number | null;
  fiberG: number | null;
  totalFatG: number | null;
  saturatedFatG: number | null;
  transFatG: number | null;
  sodiumMg: number | null;
  micronutrients: { name: string; amount: number; unit: string }[] | null; // often absent
}

type NutrientFlag = "low" | "medium" | "high";

interface BalanceVerdict {
  flags: { sugar: NutrientFlag; saturatedFat: NutrientFlag; sodium: NutrientFlag; protein: "low" | "good"; fiber: "low" | "good" };
  rulesTriggered: string[];   // human-readable, e.g. "High in sugar (18g/100g, >22.5g/100g threshold)"
  overall: "everyday" | "moderate" | "occasional_treat";
  summary: string;            // one templated sentence built from the flags
}

interface ScanResult {
  scannedAt: string;
  productLabel: string | null;
  ingredients: DecodedIngredient[] | null;
  allergensDetected: string[];
  isVegetarian: boolean | null;
  fssaiLicenseNumber: string | null;
  language: string | null;
  nutrition: NutritionPer100g | null;
  balance: BalanceVerdict | null;
  notes: string | null;
}
```

### Module boundary

```
Camera screen (capture) → runScan orchestrator
  ├─ ingredients photo → preprocess → ModelClient (ingredients prompt) → parser (fallback chain) → glossary decoder → DecodedIngredient[]
  └─ nutrition photo   → preprocess → ModelClient (nutrition prompt)   → parser (fallback chain) → rule engine       → BalanceVerdict
       → merge into ScanResult → persist (SQLite) → Result screen (bento UI)
```

`ModelClient` is an interface (`src/model/types.ts`) with one real implementation (`engine.ts`, wraps `react-native-litert-lm`) and one mock (`mockEngine.ts`, canned fixture responses) — everything above the client is testable with the mock, no device needed.

## Execution method: atomic task system

Each task below is independently completable and independently verifiable. Every task carries four parts:

- **Context** — why this task is needed for the product (pre-filled at plan time).
- **Result** — what was actually produced (filled in on completion).
- **Rubber-duck check** — re-derive what the task *should* have produced from its Context and requirement, then check the actual Result against that from scratch. Not "it compiles" — "does it actually do the thing." The specific check to run is pre-specified per task.
- **Completion summary** — one or two sentences, accurate over impressive, stating pass/fail and anything left open.

---

### Phase 0 — Scaffolding & tooling

- [x] **T0.0 In-repo `plan.md` + `CLAUDE.md` pointer**
  - *Context:* the plan only lived in Claude Code's internal plan storage, outside the git repo — needs to be committed as a real project file so it survives and travels with the repo.
  - *Deliverable:* this file, plus a pointer section in `CLAUDE.md`.
  - *Rubber-duck check:* does `CLAUDE.md`'s pointer alone (without the planning conversation) tell a future Claude instance what `plan.md` is and how to keep it updated?
  - *Result:* Created `plan.md` at repo root with full Context/Architecture/atomic-task-list. Added a "Build plan" section to `CLAUDE.md` (before "Project state") linking to it and explaining the Context/Deliverable/Rubber-duck-check/Result/Completion-summary fields and the update rule.
  - *Completion summary:* Done. Re-reading only the new `CLAUDE.md` section (no other context) is enough to know `plan.md` exists, what it's for, and that finishing a task means editing its fields in-place — check passes.

- [x] **T0.1 Expo+TS scaffold**
  - *Context:* no RN project exists; expo-router matches the spec's file-based screen layout (`app/camera.tsx` etc.) directly.
  - *Deliverable:* `package.json`, `tsconfig.json` (strict), `app.json`, expo-router entry (`app/_layout.tsx`) + placeholder route (`app/index.tsx`).
  - *Rubber-duck check:* `tsc --noEmit` runs clean on the empty skeleton; the placeholder route actually renders.
  - *Result:* Scaffolded via `create-expo-app` (blank-typescript template) into a temp dir, then merged into the repo (package.json/app.json/tsconfig/assets), converted to expo-router (`main: "expo-router/entry"`, removed the template's `App.tsx`/`index.ts`, added `app/_layout.tsx` + `app/index.tsx`). No `babel.config.js` needed — SDK 57 resolves `babel-preset-expo` without one. Verified live via `npx expo start --web` in the Browser preview: tab title and page text render "Ingredient Lens" / the placeholder copy, zero console errors.
  - *Completion summary:* Done — `tsc --noEmit` is clean and the route renders in a live web preview, not just "it built." Both rubber-duck checks pass.

- [x] **T0.2 Lint/test tooling**
  - *Context:* "engineered, not vibe-coded" means typecheck/lint/test are enforced from the first commit, not bolted on later.
  - *Deliverable:* ESLint config, `jest`+`jest-expo`+`@testing-library/react-native`, `lint`/`typecheck`/`test`/`start` npm scripts.
  - *Rubber-duck check:* all four scripts run without config errors (even against near-empty source).
  - *Result:* `npx expo lint` scaffolded `eslint.config.js` (flat config, `eslint-config-expo`). Added `jest`/`jest-expo`/`@testing-library/react-native`, a `"jest": {"preset": "jest-expo"}` block in `package.json`, and `typecheck`/`test` scripts. `test` uses `--passWithNoTests` since no test files exist yet (T2.2/T3.2/T4.4 add the first real ones) — that's an expected, not masked, state.
  - *Completion summary:* Done. Ran all four scripts for real: `npm run typecheck` (clean), `npm run lint` (clean), `npm test` (`No tests found, exiting with code 0`), `start`/`web` already proven live in T0.1. No config errors on any of them.

- [x] **T0.3 Dependencies + .gitignore**
  - *Context:* `zod` is needed later for real schema validation of model output (not just trusting `JSON.parse`); model files (~2.59GB) must never be committed.
  - *Deliverable:* deps installed (`expo-router`, `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants`, `react-dom`+`react-native-web`+`@expo/metro-runtime` for web preview, `expo-camera`, `expo-sqlite`, `expo-image-manipulator`, `zod`), `.gitignore` updated (`node_modules`, `.expo`, `dist`, `*.tsbuildinfo`, `*.litertlm`, native `/ios` `/android`).
  - *Rubber-duck check:* `git status` shows none of those paths tracked.
  - *Result:* All deps installed via `npx expo install` (SDK-compatible versions) + plain `npm install zod`. `app.json` now declares `expo-router`, `expo-camera` (with a camera-usage-string plugin config), and `expo-sqlite` plugins, plus Android `CAMERA` permission. `.gitignore` extended with the full Expo/RN ignore set and `*.litertlm`.
  - *Completion summary:* Done. `git status` (checked below in T0.1's verification pass) shows `node_modules/` untracked as expected; no `.litertlm` files exist yet to verify against, but the pattern is in place.

### Phase 1 — Types

- [x] **T1.1 Core schema types**
  - *Context:* the sharpened schema (decoded ingredients w/ `source`, per-100g nutrition, rule-based verdict) is the contract every other module codes against — get it right once.
  - *Deliverable:* `src/types/scan.ts`, `src/types/capture.ts`.
  - *Rubber-duck check:* walk each confirmed decision (capture flow, glossary+model-fallback, deterministic verdict) and confirm every field needed to represent it exists, with no orphan/unused fields.
  - *Result:* `src/types/scan.ts` transcribes the plan's schema verbatim (`DecodedIngredient` w/ `source: "glossary" | "model" | null`, `NutritionPer100g`, `BalanceVerdict`, `ScanResult`), plus small named helper types (`Micronutrient`, `DietaryFlags`, `NutrientAdequacyFlag`) that were anonymous inline shapes in the plan — named for reuse without changing meaning. `src/types/capture.ts` adds `CaptureTarget`, `CapturedPhoto`, `CaptureSlots` (a `Record<CaptureTarget, CapturedPhoto | null>`), `CaptureState` (`activeTarget` + `slots`), and `CaptureSettings` (`autoSinglePhotoMode: boolean`).
  - *Completion summary:* Done. Walked all 4 capture paths (ingredients-only/nutrition-only/both/neither) — each is representable as a `CaptureSlots` value with the "neither" case (Analyze blocked) derivable from both slots being `null`, no dedicated field needed. Walked glossary+model-fallback — `source: IngredientSource | null` and `isHiddenName` cover it. Walked deterministic verdict — `BalanceVerdict.flags`/`rulesTriggered`/`overall` cover it. No orphan fields found. `tsc --noEmit` and `expo lint` both clean.
  - *Revision (2026-08-12):* removed the `DietaryFlags` interface and `ScanResult.dietaryFlags` field entirely — see the dated note under "Confirmed decisions" above for why.

### Phase 2 — Glossary module

- [x] **T2.1 Glossary seed data**
  - *Context:* deterministic decoding needs real curated data — this file IS the "maida is refined flour" value proposition.
  - *Deliverable:* `src/glossary/data.json`, ~25 entries (maida, invert sugar syrup, maltodextrin, HFCS, hydrogenated/palm oil, sodium benzoate, etc.), each with `aliases/plainMeaning/category/healthNote`.
  - *Rubber-duck check:* no placeholder text in any entry; spot-check 3 entries against public food-labeling knowledge for accuracy.
  - *Result:* `src/glossary/data.json` — 28 entries, each with `id/aliases/plainMeaning/category/healthNote`. Covers added sugars (maida-adjacent invert sugar syrup, maltodextrin, HFCS, corn syrup solids, dextrose), trans-fat/oil sources (hydrogenated vegetable oil, palm oil), preservatives (sodium benzoate, potassium sorbate, sodium metabisulphite, TBHQ, sodium nitrite, calcium propionate, BHA), sweeteners (aspartame, sucralose, acesulfame-K), emulsifiers/stabilizers (mono-/diglycerides, lecithin, carrageenan, xanthan gum), artificial colours (tartrazine, sunset yellow, erythrosine), and flavour enhancers (MSG, hydrolyzed vegetable protein), plus a natural leavening agent (ammonium bicarbonate) to show the glossary isn't only-negative.
  - *Completion summary:* Done. Scripted validation confirms all 28 entries have non-empty `id/aliases/plainMeaning/category/healthNote` and no placeholder/TODO text. Spot-checked 3 against public food-labeling knowledge: maida (refined wheat flour, bran/germ removed, low fiber) correct; sodium benzoate (E211, benzene-formation caveat with ascorbic acid under light/heat) correct and appropriately hedged; tartrazine (E102, azo dye, hyperactivity-study association, FSSAI-permitted within limits) correct. `category` values are consistent strings ready for T2.2's decoder to key off.

- [x] **T2.2 Decoder + tests**
  - *Context:* OCR text won't exactly match glossary keys (case/plurals/typos) — matching must be robust or the glossary is dead weight.
  - *Deliverable:* `src/glossary/decoder.ts`, `decoder.test.ts`.
  - *Rubber-duck check:* confirm the test suite actually exercises exact-match, fuzzy/typo-match, and no-match→`null` separately, not just a happy path.
  - *Result:* `decodeIngredient(rawName)` normalizes case/whitespace/punctuation, de-pluralizes (with a sibilant-aware rule so "-ates" words like "benzoates" don't get mangled to "-at"), does an exact-match pass against all alias strings first, then falls back to a length-scaled Levenshtein fuzzy pass (0 edits allowed ≤4 chars, 1 edit ≤8 chars, 2 edits beyond — so short words like "salt" can't false-positive-match). Returns `{entry, matchedAlias, matchType}` or `null`. Also added `@types/jest` (missing devDependency) and `"types": ["jest"]` to `tsconfig.json` — `describe`/`it`/`expect` weren't resolving without it.
  - *Completion summary:* Done. `decoder.test.ts` has 8 tests in 3 explicit groups: exact-match (case/whitespace, plural-normalized, multi-word alias), fuzzy-match (missing-letter typo, substituted-letter typo, negative case confirming short words don't false-positive), and no-match (unrelated word, empty/whitespace string) — all pass. `tsc --noEmit`, `expo lint`, and `npm test` all clean.

### Phase 3 — Nutrition rule engine

- [x] **T3.1 Thresholds**
  - *Context:* the balance verdict must be explainable and reproducible, not invented — needs one documented, citable basis (UK-FSA-style per-100g cutoffs).
  - *Deliverable:* `src/nutrition/thresholds.ts` with inline rationale.
  - *Rubber-duck check:* every threshold has a stated source/rationale; units are consistently per-100g throughout.
  - *Result:* `SUGAR_PER_100G` (low ≤5g, high >22.5g) and `SATURATED_FAT_PER_100G` (low ≤1.5g, high >5g) transcribe the UK FSA Front-of-Pack traffic-light guidance directly. `SODIUM_PER_100G` (low ≤120mg, high >600mg) is the FSA's salt-based cutoff (low ≤0.3g, high >1.5g salt/100g) converted via the standard salt = sodium × 2.5 factor, since the app schema stores `sodiumMg` not salt. `FIBER_PER_100G.goodMinG` (3g) and `PROTEIN_ENERGY_SHARE.goodMinFraction` (12% of energy) come from the EU/UK Nutrition and Health Claims Regulation (EC) 1924/2006 Annex "source of fibre"/"source of protein" claims. `PROTEIN_PER_100G_FALLBACK.goodMinG` (5g) is explicitly flagged in its own comment as a non-official proxy, used only when `energyKcal` is null and the %-of-energy protein claim can't be computed.
  - *Completion summary:* Done. Every export has an inline comment naming its source (FSA FoP guidance or EC 1924/2006 Annex) or, for the one non-official value, says so explicitly rather than implying false authority. All thresholds are per-100g (sodium's mg unit is called out and derived consistently from the per-100g salt cutoff, not a different basis). `tsc --noEmit` and `expo lint` clean.

- [x] **T3.2 Rule engine + tests**
  - *Context:* this pure function IS the "is it balanced" answer the product promises — it must be deterministic to be trustworthy.
  - *Deliverable:* `src/nutrition/ruleEngine.ts`, `ruleEngine.test.ts` (a shortbread-biscuit-shaped high-sugar/high-satfat fixture + a lower-sugar fixture).
  - *Rubber-duck check:* hand-recompute expected flags for both fixtures against `thresholds.ts` and confirm the test assertions match that hand calculation exactly.
  - *Result:* `computeBalanceVerdict(nutrition)` flags sugar/saturatedFat/sodium via `thresholds.ts`'s low/high cutoffs (null -> "low", no fabricated risk from missing data), flags fiber via the 3g/100g "source of fibre" cutoff, and flags protein via the 12%-of-energy "source of protein" claim when `energyKcal` is available, falling back to the flat 5g/100g proxy otherwise. `rulesTriggered` cites the exact value and threshold for every medium/high reduce-nutrient and every "good" adequacy nutrient (skips uninteresting "low"/default states). `overall` is any-high -> `occasional_treat`, else any-medium -> `moderate`, else `everyday`; `summary` is templated from which nutrients triggered which flags. `ruleEngine.test.ts` has two fixtures: a shortbread-biscuit-shaped one (sugar 28g, satFat 17g, sodium 350mg, fiber 1.5g, protein 5g @ 520kcal) and a whole-grain-cracker-shaped one (sugar 3g, satFat 1g, sodium 100mg, fiber 6g, protein 12g @ 380kcal).
  - *Completion summary:* Done. Hand-recomputed both fixtures against `thresholds.ts` before writing assertions: shortbread → sugar 28>22.5 high, satFat 17>5 high, sodium 350 in (120,600] medium, fiber 1.5<3 low, protein energy-share 20/520=3.8%<12% low → `occasional_treat`; cracker → sugar 3<=5 low, satFat 1<=1.5 low, sodium 100<=120 low, fiber 6>=3 good, protein energy-share 48/380=12.6%>=12% good → `everyday`. Verified the 0.12*100 float formatting explicitly in a scratch script (`node -e`) to confirm it prints `"12"` not `"12.000...02"` before hardcoding the expected string. All 6 new assertions (flags/rulesTriggered/overall+summary × 2 fixtures) match the engine's actual output exactly — not approximately. `tsc --noEmit`, `expo lint`, and `npm test` (14/14) all clean.

### Phase 4 — Model integration layer

- [x] **T4.1 ModelClient abstraction**
  - *Context:* no real device/model exists in this sandbox — without this seam, nothing downstream is testable.
  - *Deliverable:* `src/model/types.ts`.
  - *Rubber-duck check:* every method the real engine needs is present, and nothing UI-specific has leaked into the interface.
  - *Result:* `ModelClient` interface: `getLoadState()` (returns a `ModelLoadState` union mirroring spec §7's not_downloaded/downloading/loading/ready/error lifecycle), `ensureReady()` (resolves once download+load complete, no-op if already ready), and `generate({systemPrompt, userPrompt, image})` (one inference call, raw text out — parsing is explicitly the parser's job, not the client's, per the module boundary in this file's Architecture section). `PreprocessedImage` is the seam type for T6.1's preprocess output (`uri/width/height`), so the client never touches raw camera bytes.
  - *Completion summary:* Done. Cross-checked against spec §11.2's real API shape (`useModel` returning `{model, isReady, downloadProgress}`, `model.sendMessage(text, {image})`) — `getLoadState`/`ensureReady` cover the hook's readiness/download surface, `generate` covers `sendMessage`. No React hooks, screen names, or navigation concepts leaked into the interface — it's a plain object shape callable from orchestration code or tests alike. `tsc --noEmit` and `expo lint` clean. Note left in comments: a real implementation will need a small wrapper to bridge react-native-litert-lm's hook-based API into this plain interface — not built this pass (no task for it, no device to validate against).

- [x] **T4.2 Mock engine + fixtures**
  - *Context:* tests and any web-preview need deterministic model responses; fixtures double as living documentation of expected output shape.
  - *Deliverable:* `src/model/mockEngine.ts` with Annapoorni, Ultra Milk, and a new shortbread-biscuit fixture.
  - *Rubber-duck check:* each fixture response validates against the zod schema from T4.4 — not just hand-typed JSON that looks plausible.
  - *Result:* T4.2's rubber-duck check needs a zod schema that per the phase ordering doesn't exist until T4.4, so pulled that piece forward: `src/model/rawOutput.ts` now holds the zod schemas for the model's raw (pre-decode) output shape (`RawIngredientsOutputSchema`, `RawNutritionOutputSchema`) plus inferred TS types — T4.4 will still own the parser fallback chain that uses them. `mockEngine.ts` exports `createMockModelClient({fixtureId, kind, failure?})` (a `ModelClient` whose `generate()` returns canned JSON, with a `failure` knob for testing not-ready/error paths) and `getMockFixture(fixtureId)`. Three fixtures: `annapoorni` and `ultraMilkChocolate` mirror spec §9.1/§9.2's documented model output (camelCase-adapted; both have `nutrition: null` since neither spec example included a nutrition panel — §9.2's multi-product array is scoped down to just the chocolate carton, since ScanResult/this MVP pass doesn't model multi-product); `shortbreadBiscuit` is new and deliberately mixes glossary-hit ingredients (maida, invert sugar syrup, hydrogenated vegetable oil, soy lecithin, ammonium bicarbonate, sunset yellow — all real `src/glossary/data.json` entries) with model-fallback ones (salt, artificial butter flavouring — no glossary entry), plus a full nutrition fixture reusing the exact numbers from `ruleEngine.test.ts`'s shortbread fixture.
  - *Completion summary:* Done, and validated for real rather than by inspection: `mockEngine.test.ts` runs `RawIngredientsOutputSchema.safeParse`/`RawNutritionOutputSchema.safeParse` against all three fixtures' raw data *and* against `JSON.parse(await client.generate(...))` (the actual runtime path), plus covers the `failure` knob and the "no nutrition fixture for this product" rejection. 10/10 new tests pass (24/24 total). `tsc --noEmit` and `expo lint` clean.

- [x] **T4.3 Prompts (ingredients + nutrition)**
  - *Context:* prompt correctness drives OCR+decode quality directly; the ingredients prompt must request the model's own plain-meaning guess in the *same* call (glossary fallback) to avoid a second 15–28s round trip.
  - *Deliverable:* `src/model/prompts/ingredients.ts`, `prompts/nutrition.ts`.
  - *Rubber-duck check:* re-read each prompt field-by-field against the schema — does it actually ask for every field the type requires, including India fields and the multi-product variant?
  - *Result:* `INGREDIENTS_SYSTEM_PROMPT` spells out the exact JSON shape field-by-field with inline guidance per field, and requests `modelPlainMeaning`/`modelCategory` as the model's *own* best-guess ("always attempt this even if not fully certain") — the glossary-fallback data — in the same call. Explicit rules for `dietaryFlags` (jain = no onion/garlic/root veg, iyengar = no onion/garlic/meat, sattvic = no onion/garlic/meat/alcohol/heavy processing, default `false` not a favorable guess when unreadable, null only if the whole ingredient list is unreadable) and for `isVegetarian`/`fssaiLicenseNumber` (India fields, requested unconditionally — no locale gating, matching the plan's confirmed decision). Both prompts end with the same one-line multi-product rule: describe only the single most prominent product, no array — a deliberate, stated deviation from the original generic spec's array-based multi-product format, since `ScanResult` (T1.1) doesn't model multiple products. `NUTRITION_SYSTEM_PROMPT` explicitly forbids judgment ("do not judge, rate, or comment") and spells out per-100g normalization (incl. serving-size conversion), the "null, don't invent" rule per field, and that a null/absent `micronutrients` array is expected, not an error.
  - *Completion summary:* Done. Walked `RawIngredientsOutputSchema` and `RawNutritionOutputSchema` (`src/model/rawOutput.ts`) field-by-field against both prompts on a second pass and found two real gaps, now fixed: the ingredients prompt didn't say when the whole `dietaryFlags` object may be null vs. always-attempted, and the nutrition prompt never addressed the multi-product case at all. Every field in both schemas now has a corresponding instruction in its prompt. `tsc --noEmit` and `expo lint` clean (prompts are plain string constants, nothing to unit-test directly — T4.4's parser tests exercise the response shape these prompts request).
  - *Revision (2026-08-12):* the `dietaryFlags` block and its "how to fill jain/iyengar/sattvic" rule paragraph were removed from `INGREDIENTS_SYSTEM_PROMPT` entirely — see the dated note under "Confirmed decisions" above for why. Everything else in this Result/Completion summary (the multi-product rule, the `modelPlainMeaning`/`modelCategory` glossary-fallback instruction, `NUTRITION_SYSTEM_PROMPT`'s scope) is unaffected and still accurate.

- [x] **T4.4 Parser + zod validation + tests**
  - *Context:* raw model output is untrusted text (code fences, occasional malformed JSON) — the spec's 4-step fallback chain must be actually implemented, not just described.
  - *Deliverable:* `src/model/parser.ts`, `parser.test.ts`.
  - *Rubber-duck check:* a test exists exercising each of the 4 fallback rungs independently (well-formed / fenced / malformed / unparseable-friendly-error).
  - *Result:* `parseModelOutput<T>(raw, zodSchema)` tries 3 progressively more forgiving extraction strategies against the *same* zod schema (a syntactically-valid-but-schema-mismatched payload doesn't count as success at any rung): rung 1 direct `JSON.parse`, rung 2 strip a ` ```json...``` `/` ```...``` ` fence via regex then parse, rung 3 slice from the first `{` to the last `}` (handles JSON embedded in unfenced prose like "Sure, here's the result: {...} Hope that helps!") then parse. All three failing returns `{success: false, friendlyError}` instead of throwing — the spec's original 4th rung ("re-query the model with a stricter prompt") was dropped since that requires a second model call and belongs in the orchestrator (T4.5), not this pure text→data function; a friendly error is what the parser itself can actually guarantee.
  - *Completion summary:* Done. `parser.test.ts` has one `describe` block per rung (4 total) plus an integration block against the real `RawIngredientsOutputSchema`: well-formed (2 tests: fenced-with-`json`-tag, fenced-no-tag), extracted-from-prose, and three unparseable cases (no JSON at all, syntactically broken JSON, and syntactically-valid-but-schema-invalid — proving the zod gate actually rejects mismatched payloads rather than passing anything JSON.parse-able). 8 new tests, all pass (32/32 total). `tsc --noEmit` and `expo lint` clean.

- [x] **T4.5 Orchestration**
  - *Context:* glues client+prompt+parser+glossary/rule-engine into the one call each screen needs.
  - *Deliverable:* `src/model/detectIngredients.ts`, `detectNutrition.ts`.
  - *Rubber-duck check:* trace one full call by hand (mock input → expected `ScanResult` fields) and confirm no field silently drops along the way.
  - *Result:* `detectIngredients(client, image)`: `ensureReady()` → `generate()` with the ingredients prompt → `parseModelOutput` against `RawIngredientsOutputSchema` → each `RawIngredientEntry` resolved through `decodeRawIngredient` (glossary hit wins and sets `source:"glossary"`; else the model's own non-null `modelPlainMeaning` sets `source:"model"`; else unresolved with `source:null`) → all top-level fields (`productLabel`/`allergensDetected`/`isVegetarian`/`fssaiLicenseNumber`/`dietaryFlags`/`language`/`notes`) passed through unchanged. `detectNutrition(client, image)`: same shape, but the model's cleaned `NutritionPer100g` passes through untouched and `computeBalanceVerdict` (T3.2, no model call) computes `balance` — the model never renders a judgment, only OCR+cleaning, per the confirmed architecture decision.
  - *Completion summary:* Done, and the trace was executed as real tests rather than by hand-inspection only: `detectIngredients.test.ts` runs the shortbread mock fixture through the full pipeline and asserts both a glossary-sourced ingredient (Maida — exact glossary `plainMeaning`/`category`, not the model's own guess) and a model-fallback ingredient (Artificial Butter Flavouring — no glossary entry, so the model's guess surfaces), plus every top-level field, confirming nothing drops. `detectNutrition.test.ts` confirms the nutrition numbers survive untouched and the computed `balance.flags`/`overall` match the same hand-recomputed expectation from `ruleEngine.test.ts`'s shortbread fixture exactly — proving the orchestrator didn't silently transform anything before handoff. Both files also test the model-client-failure path rejects rather than throwing uncaught. 8 new tests, 36/36 total pass. `tsc --noEmit` and `expo lint` clean.
  - *Revision (2026-08-12):* `dietaryFlags` is no longer one of `IngredientsDetectionResult`'s top-level passed-through fields — see the dated note under "Confirmed decisions" above for why. `productLabel`/`allergensDetected`/`isVegetarian`/`fssaiLicenseNumber`/`language`/`notes` still pass through unchanged as described.

### Phase 5 — Camera screen

- [x] **T5.1 Capture state hook**
  - *Context:* encodes the confirmed unguided two-target/one-shutter flow — getting this state shape right up front avoids UI bugs later.
  - *Deliverable:* `src/capture/useCaptureState.ts`.
  - *Rubber-duck check:* walk all 4 user paths (ingredients-only / nutrition-only / both / neither→blocked) against the hook's exposed state and actions.
  - *Result:* `useCaptureState(initialTarget?)` returns `{activeTarget, slots, setActiveTarget, capturePhoto, retake, reset, canAnalyze}`. `capturePhoto(uri)` always writes into whichever slot `activeTarget` currently names (the confirmed one-shutter/top-toggle model) rather than taking a target argument, so the toggle is the single source of truth for where a shot lands. `canAnalyze` is `slots.ingredients !== null || slots.nutrition !== null`. Also added `retake(target)` (clears one slot) and `reset()` (clears both) since the camera screen (T5.2) will need a way to redo a bad shot without this hook's shape needing revision later.
  - *Completion summary:* Done. `useCaptureState.test.ts` has one test per user path (ingredients-only, nutrition-only, both-in-either-order, neither-stays-blocked) plus retake/reset coverage — 6 tests, all pass (42/42 total). Hit one environment snag along the way: this repo's `@testing-library/react-native@14.0.1` has an async `renderHook`/`act` (both return `Promise`, unlike older RTL versions), which only showed up as a `tsc` type error (`Property 'result' does not exist on type 'Promise<...>'`) — fixed by awaiting both throughout. `tsc --noEmit` and `expo lint` clean.

- [x] **T5.2 Camera screen UI**
  - *Context:* this is the literal confirmed UX — "two button one top and camera on bottom."
  - *Deliverable:* `app/camera.tsx`.
  - *Rubber-duck check:* does the built screen match that description exactly (top toggle, bottom shutter, per-slot indicator, Analyze gated on ≥1 capture)?
  - *Result:* `app/camera.tsx` gates on `useCameraPermissions()` first (loading / not-granted states use the ink/paper/sketch chrome CLAUDE.md calls for even on non-grid screens). Once granted: `CameraView` fills the screen via `StyleSheet.absoluteFill` (it doesn't support children — confirmed by reading `expo-camera`'s source, which warns and can crash if you try — so the toggle/shutter/Analyze UI is a separate absolutely-positioned overlay `View`, not nested inside it). Top bar: two `ToggleButton`s bound to `useCaptureState`'s `activeTarget`/`setActiveTarget`, each showing a "✓" per-slot indicator when that slot is filled, plus a settings link (`/settings`, built next in T5.3). Bottom bar: a circular shutter button calling `cameraRef.current.takePictureAsync()` then `captureState.capturePhoto(photo.uri)`, with an Analyze button that only renders when `canAnalyze` is true (empty placeholder view keeps the shutter centered either way). Also added an "Open camera" link on `app/index.tsx` so the route is reachable for testing.
  - *Completion summary:* Verified live in the Browser preview, not just by reading the code: the not-granted permission screen renders with the correct paper/ink/sketch styling (screenshotted), and tapping "Grant Camera Access" triggers a real `getUserMedia` request — console confirms it reached the browser's camera API and was blocked by the sandbox, with zero JS errors either side of that. `tsc --noEmit` and `expo lint` both clean. **Honest limit**: the granted-permission state (live camera feed + toggle/shutter/Analyze overlay actually composited together) could not be visually verified, since this sandbox has no camera to grant — same documented "no real device" limitation as the rest of this plan. The overlay's structure and gating logic were verified by code review against `useCaptureState`'s already-tested behavior (T5.1), not by seeing it rendered.

- [x] **T5.3 Settings screen**
  - *Context:* auto single-photo mode was explicitly requested but must default off.
  - *Deliverable:* `app/settings.tsx`.
  - *Rubber-duck check:* confirm the toggle's default state is off on a fresh install, no persisted override needed to get "off."
  - *Result:* `app/settings.tsx` holds `autoSinglePhotoMode` as local `useState<CaptureSettings["autoSinglePhotoMode"]>(false)` — no settings-persistence layer exists yet (only scan-history persistence, T8.1, is in scope this pass), so "off by default" falls straight out of the initial state literal rather than needing any stored-override logic. Uses the native `Switch` (not a custom sketch control — reasonable scope call for a first pass Settings screen) inside an ink/paper sketch-bordered card, with a back link to `/camera`.
  - *Completion summary:* Verified live in the Browser preview: read the DOM node's `.checked` property directly on fresh mount → `false`, confirming default-off without relying on visual inspection alone; clicked the switch and re-read `.checked` → `true`, confirming the toggle actually updates state, not just renders. Zero console errors. `tsc --noEmit` and `expo lint` clean.

### Phase 6 — Processing & orchestration

- [x] **T6.1 Preprocessing**
  - *Context:* spec requires 896×896 resize + [-1,1] normalization before inference; wrong preprocessing silently degrades model accuracy.
  - *Deliverable:* `src/camera/preprocess.ts` (via `expo-image-manipulator`).
  - *Rubber-duck check:* output dimensions/format match spec §6.2 exactly.
  - *Result:* `preprocessImage(uri)` resizes to `MODEL_INPUT_SIZE` (896×896, exported as a named constant) via `ImageManipulator.manipulate(uri).resize(...).renderAsync()`, saves as JPEG, and maps the result to `PreprocessedImage` (`{uri, width, height}`, T4.1's seam type). Deliberately scoped down from spec §6.2's literal wording: the spec also calls for normalizing pixel values to [-1,1] "in JavaScript", but `expo-image-manipulator` only exposes file-level operations (resize/crop/rotate/save) — there's no raw-pixel-buffer API in this project's dependencies to do that math in JS, and the real `model.sendMessage(text, {image})` call (spec §11.2) takes an image reference, not a pre-normalized float tensor. Documented in-code as a stated gap (native-side responsibility, unverifiable without a real react-native-litert-lm bridge) rather than silently doing something different from what was asked.
  - *Completion summary:* Done for the part that's actually buildable in JS this pass: dimensions (896×896) and format (JPEG) match spec §6.2 exactly. `expo-image-manipulator` has no `jest-expo` mock and needs a real native bridge unavailable in this sandbox, so `preprocess.test.ts` mocks the module (using `mock`-prefixed variable names, required for Jest's factory-hoisting rules) to verify the *orchestration* — `manipulate` called with the input URI, `resize` called with exactly `{width:896, height:896}`, `saveAsync` called with JPEG format, and the result correctly mapped to `PreprocessedImage`. This proves the wiring is correct, not that real image manipulation produces a correct pixel result — that's the same "no real device" gap already documented in this file's Reality check. `tsc --noEmit`, `expo lint`, and `npm test` (43/43) all clean.

- [x] **T6.2 runScan orchestrator**
  - *Context:* the single place that must correctly branch on which photo(s) were captured and merge results without one panel's absence corrupting the other's data.
  - *Deliverable:* `src/scan/runScan.ts`.
  - *Rubber-duck check:* trace all 3 valid input combinations (ingredients-only / nutrition-only / both) through to the `ScanResult` shape by hand.
  - *Result:* `runScan({client, slots})` runs each captured slot through `preprocessImage` → `detectIngredients`/`detectNutrition` independently (two separate `if` blocks, not a shared try/catch, so one call's failure can't be mistaken for the other's), then merges into one `ScanResult`: ingredient-sourced fields (`ingredients`/`allergensDetected`/`isVegetarian`/`fssaiLicenseNumber`) default to `null`/`[]` when that photo wasn't captured; `nutrition`/`balance` default to `null` likewise; `productLabel`/`language` prefer the ingredients result but fall back to nutrition's; `notes` joins both sides' notes when both are present. Added `createMockModelClientForFixture` to `mockEngine.ts` alongside the existing `createMockModelClient` — the existing one is fixed to one `kind` at construction (fine for testing `detectIngredients`/`detectNutrition` in isolation), but `runScan` drives one client through up to two different-kind calls in the same scan, so the new factory reads `options.systemPrompt` to route to the right fixture.
  - *Completion summary:* Done. `runScan.test.ts` traces all 3 valid combinations for real against the shortbread fixture: ingredients-only (ingredients populated, `nutrition`/`balance` stay `null` — "not captured, so not fabricated," not silently defaulted to some verdict), nutrition-only (`nutrition`/`balance` populated, ingredient fields stay `null`/`[]`, not corrupted by the nutrition call), and both (all fields populated, both sides' `notes` survive the merge — checked for both fragments, not just one overwriting the other). Also tests that a model-client failure rejects rather than resolving, consistent with `detectIngredients`/`detectNutrition`'s own behavior. 4 new tests, 47/47 total pass. `tsc --noEmit` and `expo lint` clean. (Written just before an in-session detour to remove the `dietaryFlags` field — re-verified clean against that change too.)

- [x] **T6.3 Processing screen UI**
  - *Context:* the 15–28s wait is called out in the spec as a first-class UX problem, not an afterthought.
  - *Deliverable:* `app/processing.tsx` with step progress + cancel.
  - *Rubber-duck check:* does cancel actually abort/discard the in-flight scan rather than just hiding the screen?
  - *Result:* `app/processing.tsx` receives which photo(s) were captured via router params (`camera.tsx`'s Analyze button now passes `ingredientsUri`/`nutritionUri`), builds a step list that adapts to what was actually captured (`Encoding image…` → `Identifying ingredients…` and/or `Reading nutrition label…` → `Computing verdict…`), and reveals steps sequentially via timers while `runScan` runs underneath — `runScan` has no granular progress callback to drive this off of, so the reveal is a timed approximation of progress, not literal step-by-step signal from the scan itself (stated plainly, not hidden). On success, stores the result in the new `src/scan/lastScanResult.ts` (a module-level variable — simplest hand-off to the not-yet-built Result screen, T7.3; a full `ScanResult` is too large/nested for a URL param and no other screen needs a shared store yet) and navigates to `/result`. **Cancel**: sets a `cancelledRef` and navigates back immediately; critically, the in-flight `runScan(...)` promise's `.then` continuation checks `cancelledRef.current` *before* calling `setLastScanResult`/navigating/showing an error — so a scan that resolves after Cancel was pressed is actually discarded, not just raced against a hidden screen. True mid-flight abort of the model call itself (an `AbortSignal` threaded through `ModelClient.generate`) is not implemented — noted as a real, scoped gap, not silently skipped. Also swaps in `createMockModelClientForFixture("shortbreadBiscuit")` as a stated placeholder (`TODO(real device)` comment) since no real `ModelClient` implementation exists yet (T4.1 explicitly scoped that out).
  - *Completion summary:* Verified live in the Browser preview: navigating to `/processing` with fake `file://` URIs correctly ran the sequential step reveal (screenshotted via `get_page_text`, showing 3 steps checked off in order before the 4th), then hit a real error — the browser (correctly) refuses to load a `file://` resource, which `preprocessImage` surfaced as a catch, and the screen rendered the friendly-error state with a working "Retake Photo" button (clicked it live, confirmed it navigates to `/camera`). Zero unexpected console errors — only the expected `file://` block. **Honest limit**: could not click Cancel mid-flight live — the mocked pipeline resolves faster than this tool's navigate/read/click round-trip latency allows racing it, and this is inherent to local-promise timing, not something a slower/real network would reproduce differently. The discard-on-cancel behavior was verified by code review (the `cancelledRef` check gates every post-await action) rather than by a live click. `tsc --noEmit` and `expo lint` clean (had to remove two `setState` calls at the top of the effect body — a real `react-hooks/set-state-in-effect` lint error, not a style nit — since they were redundant with the already-correct initial state).

### Phase 7 — Result screen (Conceptual Sketch Bento Box)

- [x] **T7.1 Design tokens**
  - *Context:* the design style must be one consistent system, not per-screen improvisation.
  - *Deliverable:* `src/ui/theme.ts`.
  - *Rubber-duck check:* cross-check tokens against `CLAUDE.md`'s design section line-by-line (paper tone, single ink color, one accent reserved for warnings).
  - *Result:* `colors` (paper/ink/inkMuted/accent), `fonts` (`display`/`displaySemiBold` = real bundled handwriting font, `body` left `undefined` deliberately for platform-default sans-serif), `radii` (`sketch` for cards/big buttons, `sketchTight` for pill-style controls — both asymmetric per-corner), `strokes` (`normal`/`emphasized`), `spacing`. The handwriting requirement isn't faked: installed `@expo-google-fonts/caveat` + `expo-font` (both real npm packages, network access confirmed available this session) and load `Caveat_600SemiBold`/`Caveat_700Bold` via `useFonts()` in `app/_layout.tsx`, gating render on load. Also retrofitted `camera.tsx`/`settings.tsx`/`processing.tsx` (built in T5.2/T5.3/T6.3 before this file existed, with duplicated ad hoc hex/radius values) to import from `theme.ts` instead — same values, now one source of truth, and headings now render in the real handwriting font instead of a bold-system-font placeholder.
  - *Completion summary:* Cross-checked line-by-line against `CLAUDE.md`'s design section: "off-white/paper tone, not pure white" ✓ (`#f6f1e6`), "single dark neutral... used consistently" ✓ (`colors.ink`, one value, no palette), "one accent color reserved exclusively for allergen/warning cells" ✓ (`colors.accent`, a single token with that stated purpose in its comment), "handwritten or marker-style display face" ✓ (real bundled Caveat font, not a stand-in), "clean, highly legible sans-serif" for body/data ✓ (`fonts.body: undefined` documented as "let platform default apply"), asymmetric hand-redrawn corners ✓ (`radii.sketch`/`sketchTight`, no two corners share a radius). The "occasional double-stroke on emphasized cells" requirement is explicitly *not* a token (documented in-code as a nested-border component technique for T7.2, not fakeable as a single style value). Verified live: `document.fonts` in the Browser preview shows `Caveat_700Bold` with `status: "loaded"` (not just a CSS property pointing at a missing font), and Settings/Camera render with zero console errors in a fresh tab. `tsc --noEmit`, `expo lint`, and `npm test` (47/47) all clean.

- [x] **T7.2 BentoGrid/SketchCard primitives**
  - *Context:* reused on every screen; getting irregular-border/bento-cell behavior right once avoids re-deriving it per screen.
  - *Deliverable:* `src/ui/BentoGrid.tsx`, `SketchCard.tsx`.
  - *Rubber-duck check:* render with 1 cell and with 5 mismatched-size cells — does the grid tile without overlap in both?
  - *Result:* `BentoGrid`/`BentoCell` use a 12-column system (`BentoSpan = 3|4|6|8|9|12`, deliberately coarse — bento cells are chunky, not fine-grained) via percentage `width`. Avoided the classic percentage-width-+-flex-`gap` overflow bug (percentages don't shrink to make room for a parent `gap`) by putting the gutter *inside* each cell as padding instead, with a matching negative margin on the grid to keep the outer edge flush — every row's cells still sum to exactly 100% width regardless of span mix. `SketchCard` takes a `variant: "default" | "emphasized"`; `"emphasized"` renders two nested bordered `View`s (not just a thicker single border) for CLAUDE.md's "occasional double-stroke (as if redrawn)" look on allergen/warning cells, and is the only place `colors.accent` is used — matching the "reserved exclusively" rule from `theme.ts`.
  - *Completion summary:* Verified live, not just read — built a temporary debug route (`app/_debug-bento.tsx`, deleted after verification, not part of the shipped app) rendering exactly the two required cases: 1 full-width cell, and 5 mismatched-size cells (span 12/6/6/4/8, including one `emphasized` variant). Measured every cell's actual `getBoundingClientRect()` in the Browser preview rather than eyeballing a screenshot: same-row cells have real horizontal gaps (e.g. 341px→396px, 223px→275px, both >0), and different rows land at distinct y-coordinates — confirmed no overlap in either case. `tsc --noEmit`, `expo lint`, and `npm test` (47/47, unaffected) all clean.

- [x] **T7.3 Result screen composition**
  - *Context:* this is where both use cases (decoded ingredients, balance verdict) actually reach the user — the whole point of the app.
  - *Deliverable:* `app/result.tsx`.
  - *Rubber-duck check:* with the shortbread-biscuit mock fixture rendered, confirm every field the user actually asked about (hidden ingredient names + why, balance verdict + which rules fired) is visibly on screen, not just present in data.
  - *Result:* Reads `getLastScanResult()` (T6.3's hand-off store); shows a "no scan yet" empty state with a link back to `/camera` if null (reachable by navigating to `/result` directly). Composes via `BentoGrid`/`SketchCard` (T7.2): an `emphasized` ALLERGENS cell (only rendered if any exist) sized 6 or 12 depending on whether a balance verdict is also present; a BALANCE cell showing `overall`, `summary`, and every `rulesTriggered` line; one `BentoCell span={4}` per ingredient showing `rawName`, an explicit "HIDDEN NAME" badge when `isHiddenName` (not just inferred from plainMeaning being present — the field gets its own visible marker), `plainMeaning`, a confidence percentage rendered as a small bordered tag (not a bar/gradient, per CLAUDE.md), `category` and `source` tags (so glossary vs. model provenance is visible, not just internal), and an "⚠ allergen" note + emphasized card variant when `allergen` is true; a full-width NOTES cell.
  - *Completion summary:* Verified live end-to-end, not against synthetic debug data — drove the actual app flow (`/processing?ingredientsUri=...&nutritionUri=...` with loadable `data:` URIs, since the Browser preview blocks `file://`) through the real mocked `runScan` → `/result`, and read the rendered page text: product label, both allergens, the verdict ("Occasional Treat") with its summary and all 3 `rulesTriggered` lines, and all 8 ingredients each showing their HIDDEN NAME badge + plain meaning + confidence + category + correct `source` (glossary for the 6 glossary-matched ingredients, model for the 2 fallback ones — Salt and Artificial Butter Flavouring) all appeared. Went a level deeper than page text for two specific claims: measured `getBoundingClientRect()` on the ALLERGENS/BALANCE/NOTES cell titles to confirm the bento layout actually tiles side-by-side (6+6) then wide (12) with real data, not just in the T7.2 debug harness; and walked the emphasized allergen card's DOM ancestor chain via `getComputedStyle` to confirm the nested double-border technique genuinely renders (outer 3px + inner 2px, both the exact accent color `rgb(179,69,43)`), not just present in `SketchCard`'s source. Zero console errors in a fresh tab. `tsc --noEmit`, `expo lint`, and `npm test` (47/47, unaffected) all clean.

### Phase 8 — Persistence

- [x] **T8.1 SQLite history write-path**
  - *Context:* scans shouldn't be lost even though the History *screen* is a follow-up pass.
  - *Deliverable:* `src/db/history.ts`.
  - *Rubber-duck check:* write then read back a `ScanResult` and confirm round-trip fidelity — no field lost across the JSON-blob/indexed-column split.
  - *Result:* `scan_history` table: `scannedAt`/`productLabel`/`overall` are indexed convenience columns for future list/sort queries (the not-yet-built History screen), `scanResultJson` is the full `JSON.stringify(result)` blob and the *only* thing `deserializeScanResult` reads — the convenience columns are write-only from the read side, so they structurally cannot cause field loss on read. `serializeScanResult`/`deserializeScanResult` are pure functions, separated from the async `insertScan`/`getScanById`/`getAllScans` DB calls specifically so round-trip fidelity is testable without a native SQLite bridge.
  - *Completion summary:* Done. `history.test.ts` has two layers: a pure round-trip test against `serializeScanResult`/`deserializeScanResult` directly, run twice — once with every `ScanResult` field populated (nested ingredients array, full nutrition/balance objects, micronutrients array) and once with every optional field null/empty — both assert deep equality against the original object, not a spot-check of a few fields. Then an integration layer mocks `expo-sqlite` (no native bridge in this sandbox) with a real in-memory array standing in for the table, so `insertScan`→`getScanById`/`getAllScans` exercises the actual SQL-shaped code path end to end, including a not-found case and a multi-row `getAllScans`. 5 new tests, 52/52 total pass. `tsc --noEmit` and `expo lint` clean (hit the same `jest.mock` factory-hoisting restriction as T2.2/T6.1 — a `interface` declared *inside* the factory still tripped it, apparently because babel's hoist-checker doesn't distinguish type-only identifiers; fixed by inlining the type instead of naming it).

### Phase 9 — Python prototyping harness

- [x] **T9.1 Prompt mirror + harness script**
  - *Context:* the spec's hard workflow rule (no prompt ships to RN without 20+ real-photo validation in Python first) needs the harness scaffolded even though it can't run here.
  - *Deliverable:* `python/prompts.py`, `python/test_harness.py`, `python/fixtures/README.md`.
  - *Rubber-duck check:* `python/prompts.py` content matches `src/model/prompts/*.ts` instructions exactly (manual sync check, documented as a standing rule since it isn't automated).
  - *Result:* `prompts.py` transcribes `INGREDIENTS_SYSTEM_PROMPT`/`NUTRITION_SYSTEM_PROMPT` (+ user-prompt builders) verbatim as Python triple-quoted strings, with an in-file comment stating the standing manual-sync rule. `test_harness.py` follows spec §10.2's documented API (`litert_lm.Engine(model_path)` → `create_session(system_prompt=...)` → `session.send_message(user_prompt, image=path)`), but goes beyond the spec's bare example: it discovers fixture images by naming convention (`ingredients_*`/`nutrition_*`), does a lightweight top-level-key structural check against each response (mirroring `RawIngredientsOutputSchema`/`RawNutritionOutputSchema`'s field lists), and programmatically enforces spec §10's "20+ real images" Development Rule as a pass/fail gate (`MIN_IMAGES_PER_PROMPT = 20`) rather than just stating it in a comment. `fixtures/README.md` documents the naming convention and suggested photo coverage (bilingual Indian labels, FSSAI/veg-symbol visible, some genuinely-no-nutrition-panel products) — the directory itself is empty, since no real product photos exist in this sandbox.
  - *Completion summary:* Done, verified for real rather than by eye: `python -m py_compile` on both files passes (valid syntax), `python -c "import prompts"` successfully imports and prints both prompt strings, and running `test_harness.py --kind both` gracefully reports "litert-lm-api is not installed" and exits 1 (correct behavior — it doesn't crash, and correctly refuses to claim "ready" without the real dependency). Most importantly, the field-by-field sync claim was checked programmatically, not manually: a one-off script regex-extracted both prompt strings from `prompts.py` and both TS template literals from `src/model/prompts/*.ts` and asserted string equality — `ingredients match: True`, `nutrition match: True`, byte-for-byte. **Honest limit, matching this file's Reality check**: the harness has never actually run against `litert_lm` (not installed, no model file, no real photos) — its correctness against the real API is unverified, only its correctness against the spec's documented API shape and against `prompts.py`. JS suite unaffected: `tsc --noEmit`, `expo lint`, `npm test` (52/52) all clean.

### Phase 10 — Docs

- [x] **T10.1 architecture.md**
  - *Context:* the three confirmed ADRs (capture flow, glossary+fallback, deterministic verdict + threshold sourcing) need a durable written record separate from `CLAUDE.md`'s guidance role, or they get re-litigated later.
  - *Deliverable:* `architecture.md` populated with module boundary + ADRs + `ScanResult` reference.
  - *Rubber-duck check:* does it capture the *why* for each ADR, not just the *what* (which already lives in code)?
  - *Result:* Rewrote `architecture.md` end to end — it previously described the *original generic spec's* assumptions (pre-`plan.md`, snake_case JSON shape, 4-step parser with a re-query rung, `{"products":[...]}` multi-product array), all since superseded/deviated-from by decisions this plan.md documents; it hadn't been touched since early scaffolding and had drifted stale relative to what actually got built. New structure: "What this app is", real stack table (flagging `react-native-litert-lm` as **not yet built**), the actual project file tree (not the old planned one), a "What's not built this pass" section (real `ModelClient`, History screen, onboarding, true mid-flight cancel, the removed `dietaryFlags`), 3 ADRs (`ModelClient`-as-interface, glossary-first-model-fallback, deterministic-verdict-model-does-OCR-only) each with Decision/Why/Consequence, the real `ScanResult` shape, the real 3-rung parser chain (explicitly noting the dropped 4th "re-query" rung and why), and an updated Development-workflow section pointing at the now-real `python/` harness.
  - *Completion summary:* Done. Every ADR follows Decision → Why → Consequence, and the Why lines cite the actual pressure that produced the decision (the 15–28s wait, "no device exists here", "opaque LLM output isn't trustworthy for a health-adjacent verdict") rather than restating what the code already shows. Cross-checked the file tree and "what's not built" list against the real repo contents (`find src app python -type f`) rather than writing from memory, so it doesn't quietly go stale the way the previous version did. No test suite impact (docs-only); `tsc --noEmit`/`expo lint`/`npm test` unaffected (52/52).

- [x] **T10.2 CLAUDE.md update**
  - *Context:* it currently says "no commands yet," which becomes false the moment T0.1–T0.2 land.
  - *Deliverable:* real `npm` scripts, pointer to `architecture.md`, updated structure section.
  - *Rubber-duck check:* run every command `CLAUDE.md` now claims exists — do they all actually work?
  - *Result:* Replaced the stale "specification documents only, no source code" Project state section with a real summary (Expo+TS app, most of the MVP plan complete, pointers to `plan.md`/`architecture.md`), a fenced code block listing all 5 claimed commands (`typecheck`/`lint`/`test`/`start`/`web`, copied verbatim from `package.json`'s actual `scripts` block, not retyped from memory), and a reference-docs list. "Build plan" and "UI design style" sections left untouched — still accurate, already matched what got built (cross-checked against `theme.ts`/`SketchCard.tsx`/`BentoGrid.tsx` while writing T7.1–T7.3, no drift found).
  - *Completion summary:* Done. Ran all 5 claimed commands for real, not just cited their exit codes from memory: `npm run typecheck` (exit 0), `npm run lint` (exit 0), `npm test` (exit 0, 52/52), and `start`/`web` verified via the live Browser preview (already running throughout this session) — navigated to `localhost:8081`, got back the actual rendered "Ingredient Lens" / "Open camera" page text. Every command CLAUDE.md now claims exists, works.

### Phase 11 — Verification sweep

- [x] **T11.1 Full verification pass**
  - *Context:* closes the loop on every completion claim above instead of trusting each task's self-report in isolation.
  - *Deliverable:* run `typecheck`/`lint`/`test`, and a web-preview screenshot of the Result screen against the shortbread fixture.
  - *Rubber-duck check / completion summary:*
    - **`npm run typecheck`: PASS** (exit 0, clean).
    - **`npm run lint`: PASS** (exit 0, clean — `expo lint`).
    - **`npm test`: PASS** — 52/52 tests, 10/10 suites, run with `--verbose` this time so every individual test name is on record in this file's history, not just suite-level pass counts: `ruleEngine` (6), `parser` (8), `mockEngine` (10), `detectNutrition` (2), `detectIngredients` (2), `runScan` (4), `preprocess` (1), `useCaptureState` (6), `decoder` (8), `history` (5).
    - **Screenshot of the Result screen: attempted, tool-level failure, substituted with an equally-rigorous non-visual check.** `computer{action:"screenshot"}` timed out every time it was tried this session ("the Browser pane is not displayed, so the page is not compositing frames") — a sandbox/tool limitation, not something retrying fixed. Substituted per this file's established pattern (used throughout T5–T7): drove the real app flow (`/processing?ingredientsUri=...&nutritionUri=...` with loadable `data:` URIs) through to `/result` against the shortbread fixture, in a **fresh tab** (to rule out stale console history, a real gotcha hit earlier in this session), and confirmed (a) `get_page_text` shows every expected field — product label, both allergens, the verdict + all 3 triggered rules, all 8 ingredients with hidden-name badges/plain meanings/confidence/category/correct glossary-vs-model source, merged notes — reproduced identically to the first time this was checked in T7.3, and (b) zero console errors in the fresh tab. This is the same DOM-measurement-based verification standard applied throughout T7.2/T7.3 (`getBoundingClientRect`, `getComputedStyle`, `document.fonts`), just without the literal screenshot pixels.
  - *What remains genuinely unverifiable in this sandbox* (stated plainly, not glossed over — consistent with every task above that touched this boundary):
    - **Real on-device inference** — no `ModelClient` implementation wrapping `react-native-litert-lm` exists (ADR 1, `architecture.md`); every test and every live-preview run in this entire session used the mock (`src/model/mockEngine.ts`). The real model has never been called.
    - **Real OCR accuracy** — the mock fixtures' `modelPlainMeaning`/nutrition numbers were authored by hand (mirroring the two documented spec test cases plus one invented shortbread fixture), not produced by Gemma 4 E2B reading an actual photo. Real-world OCR quality, multilingual handling, and glare/lighting robustness are unknown.
    - **`python/test_harness.py` actually running** — confirmed syntactically valid and importable (`py_compile`, `import prompts`) and confirmed to fail gracefully without `litert-lm-api` installed, but it has never executed a real `litert_lm.Engine` session, because that package, the `.litertlm` model file, and real product photos are all absent here.
    - **The spec's 20+-real-photo validation gate** (section 10's Development Rule) — `python/fixtures/` is empty; the gate is implemented and enforced *in code* (`MIN_IMAGES_PER_PROMPT = 20` in `test_harness.py`) but has never been exercised against a single real photo, let alone 20.
    - **The Browser preview's screenshot capability itself** — a tooling gap in this session's environment, separate from the app; worth flagging to whoever picks this up next in case it's fixable, since DOM-based verification is a reasonable substitute but not a full replacement for actually looking at the rendered pixels (font rendering, spacing/alignment issues invisible to `getBoundingClientRect`, color contrast).

### Phase 12 — Real device integration

> The MVP (Phases 0–11) is complete and fully mock-verified. This phase is "Part A" of running the app on a real phone: everything buildable without hardware, so the codebase is 100% ready to run for real the moment a device is available. "Part B" (native build, real device, real model download, real photos, the Python harness actually running) is out of scope for this repo's Claude-executable work — see the user-approved plan at the time this phase started for the full split and hand-off steps.

- [x] **T12.1 Install react-native-litert-lm + config**
  - *Context:* the real `ModelClient` (ADR 1's marked gap) needs the actual package installed and Expo configured for it before any code can be written against real types instead of guessing from docs.
  - *Deliverable:* `react-native-nitro-modules` + `react-native-litert-lm` installed; `app.json` gets the `react-native-litert-lm` plugin and `android.minSdkVersion: 26`.
  - *Rubber-duck check:* `npx expo config --type public` resolves cleanly with the new plugin listed, and the existing test suite is unaffected.
  - *Result:* Both packages installed via `npx expo install`/`npm install`. Before writing any code against the package, verified its *actual installed* type declarations (`node_modules/react-native-litert-lm/lib/**/*.d.ts`) rather than trusting the web-search summary that informed the initial plan — this surfaced a real correction: `loadModel(pathOrUrl, config?, onDownloadProgress?)` already exposes a plain download-progress callback, so the planned `ModelProvider`/React-hook-bridging step (originally needed to get live progress) turned out to be unnecessary. The plain imperative API (`createLLM`/`loadModel`/`execute`/`resetConversation`) fully satisfies `ModelClient` on its own.
  - *Completion summary:* Done. `npx expo config --type public` resolves the full config with `react-native-litert-lm` in the plugins array and no errors (also surfaced that the plugin auto-adds `android.permission.RECORD_AUDIO`, expected given the package's audio-input support). `tsc --noEmit`, `expo lint`, `npm test` (52/52) all unaffected — nothing imports the new package yet at this point.

- [x] **T12.2 Real ModelClient implementation**
  - *Context:* this is the one file ADR 1 says a future session needs to write — the actual bridge from our `ModelClient` interface to the real inference engine.
  - *Deliverable:* `src/model/engine.ts`.
  - *Rubber-duck check:* every `ModelClient` method has a real, type-checked mapping to a real package API (not a guess), and the systemPrompt-per-call vs. session-level-systemPrompt mismatch is explicitly handled, not ignored.
  - *Result:* `getLoadState()` returns module-level state updated by `loadModel`'s progress callback (mapped to `downloading`/`loading`/`ready`/`error`). `ensureReady()` calls `createLLM()` once then `loadModel(GEMMA_4_E2B_IT, {backend, multimodal:true}, onProgress)`, memoized so concurrent callers await the same in-flight promise rather than double-loading a 2.58GB model. `generate({systemPrompt, userPrompt, image})` calls `llm.resetConversation(undefined, systemPrompt)` (the documented, cheap way to switch the session-level system prompt without reloading weights) immediately followed by `llm.execute([{type:"text",...}, {type:"image", path: image.uri}])` — `execute()` is the package's "recommended unified entry point" per its own JSDoc, and `image.uri` (from T6.1's `preprocessImage`) is already the local file path the `path` field wants, no new plumbing. `MemoryError` (thrown by `loadModel` when a pre-flight estimate says the model won't fit) is caught via the package's own `isMemoryError()` type guard and surfaced as a `ModelLoadState.error` with the estimate's `verdict`/`recommendation`, not an uncaught crash.
  - *Completion summary:* Done. `tsc --noEmit` passes against the real installed package types (not stubs) and `expo lint` is clean. **Cannot be run** — no native build, no device, no model file in this sandbox; this is written-and-typechecked-only, explicitly not "tested to work." `engine.test.ts` (next task) covers what's actually verifiable here: the mapping logic, mocked.

### Phase 12 remaining (not yet done)

- [ ] **T12.3 Swap processing.tsx to the real client behind a flag**
  - *Context:* the mock must stay available for continued web-preview iteration and the existing test suite; the swap should be one flag, not a code fork.
  - *Deliverable:* `app/processing.tsx` picks `realModelClient` vs `createMockModelClientForFixture(...)` based on an env flag (e.g. `EXPO_PUBLIC_USE_MOCK_MODEL`, defaulting to mock so nothing currently working regresses).
  - *Rubber-duck check:* web preview still runs the mock path unchanged (re-verify the shortbread fixture flow from T11.1 still works); flipping the flag is the only change needed to attempt the real path on a native build.
  - *Result:*
  - *Completion summary:*

- [ ] **T12.4 engine.test.ts**
  - *Context:* the mapping logic in `engine.ts` (progress→state transitions, systemPrompt reset-before-execute, MemoryError handling) is real code with real bugs possible, and none of it needs a device to test if `react-native-litert-lm` itself is mocked.
  - *Deliverable:* `src/model/engine.test.ts`, mocking `react-native-litert-lm` the same way `preprocess.test.ts` mocks `expo-image-manipulator`.
  - *Rubber-duck check:* tests actually exercise the three things called out in T12.2's Result — progress-to-state mapping, the resetConversation-before-execute call sequence, and MemoryError surfacing as a load error — not just "it doesn't throw."
  - *Result:*
  - *Completion summary:*

- [ ] **T12.5 Update docs for Part A completion**
  - *Context:* `architecture.md`'s "what's not built" list and ADR 1's "Consequence" note are now partly stale once T12.1–T12.4 land.
  - *Deliverable:* `architecture.md` updated (real `ModelClient` moves from "not built" to "built, never run on real hardware"); this file's Phase 12 intro updated if scope changed during execution.
  - *Rubber-duck check:* a reader of `architecture.md` alone (no memory of this session) can tell exactly what's real vs. mocked vs. untested, with no overclaiming.
  - *Result:*
  - *Completion summary:*
