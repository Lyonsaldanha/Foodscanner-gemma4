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
- **Scope**: MVP-first. Camera → Processing → Result is the full, real build target this pass. Onboarding, model-download screen, History screen, and deep India-specific UI (Jain/Iyengar/Sattvic filtering) are designed-for in the schema but not built this pass.
- **India fields** (`is_vegetarian`, FSSAI license number, dietary-practice flags) are always part of the one universal schema/prompt — no locale gating.
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
  dietaryFlags: { jain: boolean; iyengar: boolean; sattvic: boolean } | null;
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

- [ ] **T4.1 ModelClient abstraction**
  - *Context:* no real device/model exists in this sandbox — without this seam, nothing downstream is testable.
  - *Deliverable:* `src/model/types.ts`.
  - *Rubber-duck check:* every method the real engine needs is present, and nothing UI-specific has leaked into the interface.
  - *Result:*
  - *Completion summary:*

- [ ] **T4.2 Mock engine + fixtures**
  - *Context:* tests and any web-preview need deterministic model responses; fixtures double as living documentation of expected output shape.
  - *Deliverable:* `src/model/mockEngine.ts` with Annapoorni, Ultra Milk, and a new shortbread-biscuit fixture.
  - *Rubber-duck check:* each fixture response validates against the zod schema from T4.4 — not just hand-typed JSON that looks plausible.
  - *Result:*
  - *Completion summary:*

- [ ] **T4.3 Prompts (ingredients + nutrition)**
  - *Context:* prompt correctness drives OCR+decode quality directly; the ingredients prompt must request the model's own plain-meaning guess in the *same* call (glossary fallback) to avoid a second 15–28s round trip.
  - *Deliverable:* `src/model/prompts/ingredients.ts`, `prompts/nutrition.ts`.
  - *Rubber-duck check:* re-read each prompt field-by-field against the schema — does it actually ask for every field the type requires, including India fields and the multi-product variant?
  - *Result:*
  - *Completion summary:*

- [ ] **T4.4 Parser + zod validation + tests**
  - *Context:* raw model output is untrusted text (code fences, occasional malformed JSON) — the spec's 4-step fallback chain must be actually implemented, not just described.
  - *Deliverable:* `src/model/parser.ts`, `parser.test.ts`.
  - *Rubber-duck check:* a test exists exercising each of the 4 fallback rungs independently (well-formed / fenced / malformed / unparseable-friendly-error).
  - *Result:*
  - *Completion summary:*

- [ ] **T4.5 Orchestration**
  - *Context:* glues client+prompt+parser+glossary/rule-engine into the one call each screen needs.
  - *Deliverable:* `src/model/detectIngredients.ts`, `detectNutrition.ts`.
  - *Rubber-duck check:* trace one full call by hand (mock input → expected `ScanResult` fields) and confirm no field silently drops along the way.
  - *Result:*
  - *Completion summary:*

### Phase 5 — Camera screen

- [ ] **T5.1 Capture state hook**
  - *Context:* encodes the confirmed unguided two-target/one-shutter flow — getting this state shape right up front avoids UI bugs later.
  - *Deliverable:* `src/capture/useCaptureState.ts`.
  - *Rubber-duck check:* walk all 4 user paths (ingredients-only / nutrition-only / both / neither→blocked) against the hook's exposed state and actions.
  - *Result:*
  - *Completion summary:*

- [ ] **T5.2 Camera screen UI**
  - *Context:* this is the literal confirmed UX — "two button one top and camera on bottom."
  - *Deliverable:* `app/camera.tsx`.
  - *Rubber-duck check:* does the built screen match that description exactly (top toggle, bottom shutter, per-slot indicator, Analyze gated on ≥1 capture)?
  - *Result:*
  - *Completion summary:*

- [ ] **T5.3 Settings screen**
  - *Context:* auto single-photo mode was explicitly requested but must default off.
  - *Deliverable:* `app/settings.tsx`.
  - *Rubber-duck check:* confirm the toggle's default state is off on a fresh install, no persisted override needed to get "off."
  - *Result:*
  - *Completion summary:*

### Phase 6 — Processing & orchestration

- [ ] **T6.1 Preprocessing**
  - *Context:* spec requires 896×896 resize + [-1,1] normalization before inference; wrong preprocessing silently degrades model accuracy.
  - *Deliverable:* `src/camera/preprocess.ts` (via `expo-image-manipulator`).
  - *Rubber-duck check:* output dimensions/format match spec §6.2 exactly.
  - *Result:*
  - *Completion summary:*

- [ ] **T6.2 runScan orchestrator**
  - *Context:* the single place that must correctly branch on which photo(s) were captured and merge results without one panel's absence corrupting the other's data.
  - *Deliverable:* `src/scan/runScan.ts`.
  - *Rubber-duck check:* trace all 3 valid input combinations (ingredients-only / nutrition-only / both) through to the `ScanResult` shape by hand.
  - *Result:*
  - *Completion summary:*

- [ ] **T6.3 Processing screen UI**
  - *Context:* the 15–28s wait is called out in the spec as a first-class UX problem, not an afterthought.
  - *Deliverable:* `app/processing.tsx` with step progress + cancel.
  - *Rubber-duck check:* does cancel actually abort/discard the in-flight scan rather than just hiding the screen?
  - *Result:*
  - *Completion summary:*

### Phase 7 — Result screen (Conceptual Sketch Bento Box)

- [ ] **T7.1 Design tokens**
  - *Context:* the design style must be one consistent system, not per-screen improvisation.
  - *Deliverable:* `src/ui/theme.ts`.
  - *Rubber-duck check:* cross-check tokens against `CLAUDE.md`'s design section line-by-line (paper tone, single ink color, one accent reserved for warnings).
  - *Result:*
  - *Completion summary:*

- [ ] **T7.2 BentoGrid/SketchCard primitives**
  - *Context:* reused on every screen; getting irregular-border/bento-cell behavior right once avoids re-deriving it per screen.
  - *Deliverable:* `src/ui/BentoGrid.tsx`, `SketchCard.tsx`.
  - *Rubber-duck check:* render with 1 cell and with 5 mismatched-size cells — does the grid tile without overlap in both?
  - *Result:*
  - *Completion summary:*

- [ ] **T7.3 Result screen composition**
  - *Context:* this is where both use cases (decoded ingredients, balance verdict) actually reach the user — the whole point of the app.
  - *Deliverable:* `app/result.tsx`.
  - *Rubber-duck check:* with the shortbread-biscuit mock fixture rendered, confirm every field the user actually asked about (hidden ingredient names + why, balance verdict + which rules fired) is visibly on screen, not just present in data.
  - *Result:*
  - *Completion summary:*

### Phase 8 — Persistence

- [ ] **T8.1 SQLite history write-path**
  - *Context:* scans shouldn't be lost even though the History *screen* is a follow-up pass.
  - *Deliverable:* `src/db/history.ts`.
  - *Rubber-duck check:* write then read back a `ScanResult` and confirm round-trip fidelity — no field lost across the JSON-blob/indexed-column split.
  - *Result:*
  - *Completion summary:*

### Phase 9 — Python prototyping harness

- [ ] **T9.1 Prompt mirror + harness script**
  - *Context:* the spec's hard workflow rule (no prompt ships to RN without 20+ real-photo validation in Python first) needs the harness scaffolded even though it can't run here.
  - *Deliverable:* `python/prompts.py`, `python/test_harness.py`, `python/fixtures/README.md`.
  - *Rubber-duck check:* `python/prompts.py` content matches `src/model/prompts/*.ts` instructions exactly (manual sync check, documented as a standing rule since it isn't automated).
  - *Result:*
  - *Completion summary:*

### Phase 10 — Docs

- [ ] **T10.1 architecture.md**
  - *Context:* the three confirmed ADRs (capture flow, glossary+fallback, deterministic verdict + threshold sourcing) need a durable written record separate from `CLAUDE.md`'s guidance role, or they get re-litigated later.
  - *Deliverable:* `architecture.md` populated with module boundary + ADRs + `ScanResult` reference.
  - *Rubber-duck check:* does it capture the *why* for each ADR, not just the *what* (which already lives in code)?
  - *Result:*
  - *Completion summary:*

- [ ] **T10.2 CLAUDE.md update**
  - *Context:* it currently says "no commands yet," which becomes false the moment T0.1–T0.2 land.
  - *Deliverable:* real `npm` scripts, pointer to `architecture.md`, updated structure section.
  - *Rubber-duck check:* run every command `CLAUDE.md` now claims exists — do they all actually work?
  - *Result:*
  - *Completion summary:*

### Phase 11 — Verification sweep

- [ ] **T11.1 Full verification pass**
  - *Context:* closes the loop on every completion claim above instead of trusting each task's self-report in isolation.
  - *Deliverable:* run `typecheck`/`lint`/`test`, and a web-preview screenshot of the Result screen against the shortbread fixture.
  - *Rubber-duck check / completion summary:* state pass/fail per check, and explicitly list what remains unverifiable in this sandbox — real device inference, real OCR accuracy, `python/test_harness.py` actually running, and the spec's 20+-real-photo validation gate.
  - *Result:*
  - *Completion summary:*
