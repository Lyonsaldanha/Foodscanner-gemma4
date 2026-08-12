Before writing code, read both specs — the India spec overrides/extends specific sections (allergens, compliance, dietary logic) rather than duplicating the whole app description. When the two specs conflict on a detail, the India spec is more current for India-market behavior; the main spec is authoritative for architecture, model internals, and the core data flow. **`plan.md` supersedes both specs wherever it explicitly says so** — the sharpened schema, the deterministic rule engine, and the MVP scope decisions documented there are what was actually built, not the specs' original generic framing. This file records the *why* behind that; `plan.md` records the *what* and *how it was verified*, task by task.

Real commands exist now: `npm run typecheck`, `npm run lint`, `npm test`, `npm run start`/`web`. See `CLAUDE.md` for the pointer to `plan.md`, and `plan.md` itself for full per-task detail.

## What this app is

**Ingredient Lens** — a fully offline, on-device mobile app that decodes hidden/euphemistic ingredient names and gives a deterministic nutrition-balance verdict from photos of a packaged food product. Points of note that shape every implementation decision:

- **No network dependency at inference time.** All AI runs on-device; only the initial ~2.59 GB model download requires internet.
- **Target device is a hard constraint.** POCO F1 (Beryllium): Snapdragon 845, Adreno 630, 6 GB RAM, Android 10. Any implementation choice (image resolution, memory usage, batching) must stay within what this specific mid-range 2018 device can do.
- **Inference is slow (15–28s per scan).** This is a first-class UX problem, not an edge case — the processing screen's step-by-step progress and cancel/retake flow are as important as the detection logic itself.
- **The model is scoped tightly to what only it can do** (OCR, image understanding, a best-guess plain-English gloss) — everything that can be deterministic (glossary lookup, the nutrition balance verdict) is plain TypeScript, unit-tested, with no model call. See ADR 2 and ADR 3 below for why this split exists.

## Stack

| Layer | Technology |
| --- | --- |
| App framework | React Native + Expo (expo-router, file-based screens) |
| On-device inference | LiteRT-LM via `react-native-litert-lm` — real `ModelClient` (`src/model/engine.ts`) is **built and mock-tested, never run on real hardware**; see "What's not built" below |
| Model | Gemma 4 E2B (multimodal, `.litertlm` mobile format) |
| Camera | `expo-camera` |
| Image preprocessing | `expo-image-manipulator` |
| Local DB | `expo-sqlite` (scan history) |
| Validation | `zod` |
| Fonts | `@expo-google-fonts/caveat` (handwriting display face) |
| State | React hooks (`useState`/`useCaptureState`); no global store — a plain module-level variable (`src/scan/lastScanResult.ts`) hands the scan result from Processing to Result, which is all this app currently needs |

### Why LiteRT-LM specifically

Gemma 4 E2B uses Per-Layer Embeddings (PLE): 0.79 GB of decoder weights stay in RAM, while 1.12 GB of embedding layers are memory-mapped from disk instead of fully loaded. LiteRT-LM is the only runtime evaluated that implements this mapping for Gemma 4 — alternatives (react-native-executorch, llama.rn, ONNX Runtime) either use 3–8 GB on disk or don't do smart PLE mapping, which matters a lot on a 6 GB device. Don't swap runtimes without accounting for this.

## Actual project structure

```
app/
├── _layout.tsx        # Root stack + Caveat font loading (useFonts, gates render)
├── index.tsx           # Placeholder entry, links to /camera
├── camera.tsx           # Capture screen: top toggle, bottom shutter, Analyze
├── settings.tsx          # Single-photo auto mode toggle (off by default)
├── processing.tsx         # Sequential step reveal, calls runScan, Cancel discards stale results
│                           # picks mock vs. real ModelClient via EXPO_PUBLIC_USE_MOCK_MODEL (default: mock)
└── result.tsx              # Bento-grid rendering of ScanResult

src/
├── types/
│   ├── scan.ts          # ScanResult and everything it's built from
│   └── capture.ts         # CaptureTarget/CaptureSlots/CaptureState/CaptureSettings
├── glossary/
│   ├── data.json         # 28 curated hidden-ingredient-name entries
│   └── decoder.ts          # Exact/fuzzy matching against data.json
├── nutrition/
│   ├── thresholds.ts       # FSA/EU-claim-sourced per-100g cutoffs, each with its rationale
│   └── ruleEngine.ts        # Deterministic NutritionPer100g -> BalanceVerdict
├── model/
│   ├── types.ts           # ModelClient interface — the seam (see ADR 1)
│   ├── rawOutput.ts         # Zod schemas for the model's pre-decode JSON shape
│   ├── prompts/
│   │   ├── ingredients.ts     # System+user prompt for the ingredients photo
│   │   └── nutrition.ts        # System+user prompt for the nutrition photo
│   ├── parser.ts            # 3-rung fallback chain: well-formed / fenced / extracted-from-prose
│   ├── mockEngine.ts         # ModelClient mock — canned fixtures, no device needed
│   ├── engine.ts            # Real ModelClient, wraps react-native-litert-lm — built, never run (no device)
│   ├── engine.test.ts         # Mocks react-native-litert-lm to test engine.ts's own mapping logic
│   ├── detectIngredients.ts    # ModelClient+prompt+parser+glossary decoder, one call
│   └── detectNutrition.ts      # ModelClient+prompt+parser+rule engine, one call
├── camera/
│   └── preprocess.ts        # Resize to 896x896 via expo-image-manipulator
├── capture/
│   └── useCaptureState.ts     # Unguided two-target/one-shutter capture state
├── scan/
│   ├── runScan.ts           # Branches on which photo(s) were captured, merges into ScanResult
│   └── lastScanResult.ts      # Module-level Processing -> Result hand-off
├── db/
│   └── history.ts           # SQLite scan_history table, JSON-blob-backed round-trip
└── ui/
    ├── theme.ts             # Design tokens (colors/fonts/radii/strokes/spacing)
    ├── SketchCard.tsx          # Bordered card primitive, incl. emphasized/warning variant
    └── BentoGrid.tsx           # 12-column irregular-cell grid

python/
├── prompts.py            # Byte-for-byte mirror of src/model/prompts/*.ts
├── test_harness.py        # litert-lm-api session runner + 20-real-photo validation gate
└── fixtures/README.md      # Naming convention; directory is empty (no real photos here)
```

## What's not built this pass

- **Real on-device inference itself.** `src/model/engine.ts` — the real `ModelClient` wrapping `react-native-litert-lm` — is written, type-checked against the real installed package types, and has its own mapping logic (progress→state, systemPrompt reset-before-execute, MemoryError handling) unit-tested with the package mocked (`engine.test.ts`). It has **never been run against real hardware**: no native build, no physical device, no `.litertlm` weights exist in this dev sandbox, so whether it actually works against the real API is unverified. `app/processing.tsx` picks it over the mock via `EXPO_PUBLIC_USE_MOCK_MODEL=false` (default: mock) — a dynamic `import()` gates loading `engine.ts` so the native-only package is never evaluated on the (default) mock/web-preview path. Every other module is built and tested against the mock (`src/model/mockEngine.ts`).
- **History screen** (UI) — the write-path (`src/db/history.ts`) exists and is tested, but there's no `app/history.tsx` yet.
- **Onboarding / model-download screen** — not built; `ModelLoadState` in `src/model/types.ts` already models the not_downloaded/downloading/loading/ready/error lifecycle for whenever it is.
- **True mid-flight scan cancellation.** Processing's Cancel button discards a stale result correctly (checked via a ref before acting on `runScan`'s resolution) but does not abort the in-flight model call itself — no `AbortSignal` is threaded through `ModelClient.generate`.
- **`dietaryFlags` (Jain/Iyengar/Sattvic)** — was part of the schema, removed 2026-08-12; see the India-market section below.

## Architecture Decision Records

### ADR 1 — `ModelClient` as an interface, not a concrete import

**Decision:** Every module above `src/model/types.ts`'s `ModelClient` interface (orchestration, screens) codes against that interface, never against `react-native-litert-lm` directly. `src/model/mockEngine.ts` is the only implementation that currently exists.

**Why:** There is no real Android device, no downloaded `.litertlm` weights, and no real product photos available in this dev sandbox — full stop. Without this seam, nothing past the camera screen would be buildable or testable here at all. With it, the glossary decoder, rule engine, parser, prompts, and orchestration are all fully unit-tested (59 tests as of this writing) against deterministic mock responses, and the *only* thing left unverified is the real device integration itself — a much smaller, clearly-bounded gap than "nothing works without a phone."

**Consequence, updated:** The real implementation (`src/model/engine.ts`) now exists — it turned out to need the package's plain imperative API (`createLLM`/`loadModel`/`execute`/`resetConversation`), not a React-hook bridge, once the installed package's actual types were checked instead of assumed from docs. `app/processing.tsx` already picks it via `EXPO_PUBLIC_USE_MOCK_MODEL=false`, so no further code swap is needed. What's left is purely a hardware gap, not a code gap: a native build (`expo prebuild` + `expo run:android`) and a physical device to actually run it on and see if the real API behaves as documented.

### ADR 2 — Glossary-first, model-fallback ingredient decoding, same inference call

**Decision:** `src/glossary/data.json` is the primary source for "what does this ingredient name actually mean." The model is asked, in the *same* call that identifies ingredients, to also supply its own best-guess plain meaning for names the glossary won't have — not a second round-trip. `DecodedIngredient.source` records which one actually resolved each ingredient (`"glossary" | "model" | null`).

**Why:** A second model call to resolve unknown ingredient names would double the 15–28s wait per spec §12.2's own framing of that wait as a first-class UX problem — unacceptable for a shopper standing in a store aisle. Glossary-first also means the app's core "maida → refined flour" value proposition is deterministic, unit-tested (`decoder.test.ts`), and immediately correctable by editing curated data, rather than being entirely dependent on the model getting it right every time.

**Consequence:** Glossary coverage directly bounds decoding quality for the terms it has (28 entries currently — real growth work, not a one-time task). Terms outside the glossary are only as good as the model's own guess, which is unverifiable without a real device.

### ADR 3 — Deterministic nutrition verdict, model does OCR/cleaning only

**Decision:** The model's only job on a nutrition-label photo is OCR + cleaning (unit normalization, per-100g conversion, nulling absent fields) — never a health judgment. `src/nutrition/ruleEngine.ts`, a pure function with zero model calls, computes the actual `BalanceVerdict` from those cleaned numbers against thresholds in `src/nutrition/thresholds.ts`, each with a stated source (UK FSA Front-of-Pack traffic-light guidance for sugar/saturated fat/sodium; EU/UK Nutrition and Health Claims Regulation (EC) 1924/2006 for fibre/protein "source of" claims).

**Why:** The whole point of this app's second use case is "is this product balanced" as a trustworthy, explainable answer — not opaque LLM output that could hallucinate a threshold or be inconsistent between two visually-similar products. A rule engine can be hand-verified (`ruleEngine.test.ts` hand-recomputes expected flags against the same thresholds before asserting) and cited back to the user (`rulesTriggered` names the exact value and cutoff).

**Consequence:** The verdict is only as good as its thresholds' relevance to the target market and its OCR input's accuracy — neither of which this app claims to be a substitute for professional dietary advice (the app's own copy should stay explicit about that; not yet enforced anywhere in UI copy as of this writing).

## Model I/O contract

Two independent capture targets (ingredients panel, nutrition label), two independent prompts, two independent raw JSON shapes — see `src/model/rawOutput.ts` for the zod schemas that are the actual source of truth, and `src/types/scan.ts` for `ScanResult`, the shape everything gets merged into:

```ts
interface ScanResult {
  scannedAt: string;
  productLabel: string | null;
  ingredients: DecodedIngredient[] | null;      // null if no ingredients photo was captured
  allergensDetected: string[];
  isVegetarian: boolean | null;
  fssaiLicenseNumber: string | null;
  language: string | null;
  nutrition: NutritionPer100g | null;            // null if no nutrition photo was captured
  balance: BalanceVerdict | null;                // null if no nutrition photo was captured
  notes: string | null;                          // merged from both photos' notes, if both captured
}
```

This deliberately supersedes the original generic spec's `{ingredients, allergens_detected, language, notes}` shape and its snake_case field names — `plan.md`'s "Schema" section has the full type definitions for `DecodedIngredient`, `NutritionPer100g`, and `BalanceVerdict`.

**Multi-product photos**: the original spec's array-based `{"products": [...]}` format for multiple products in one photo is explicitly *not* supported — `ScanResult` models exactly one product. Both prompts (`src/model/prompts/*.ts`) instead instruct the model to describe only the single most prominent, front-facing product when more than one is visible. This is a deliberate MVP scope decision, not an oversight.

**Output parsing** (`src/model/parser.ts`) goes through a 3-rung fallback chain before giving up with a friendly error — also a deliberate deviation from the original spec's 4-step version:
1. `JSON.parse()` directly, validated against the zod schema
2. Strip a ` ```json ... ``` ` (or bare ` ``` ... ``` `) fence, retry
3. Slice from the first `{` to the last `}` (handles JSON embedded in unfenced prose), retry
4. None of the above worked → a friendly error string, never a raw parse exception

The spec's original 4th rung — "re-query the model with a stricter prompt" — was dropped from the parser itself because that requires a second model call and belongs in orchestration (`src/scan/runScan.ts`), not a pure text→data function; it is not currently implemented anywhere (a real, stated gap, not a silent one).

## Development workflow rule (spec section 10)

**Prompt and parsing changes are prototyped in Python before touching React Native.** `python/prompts.py` mirrors `src/model/prompts/*.ts` by hand (a standing rule, not automated — re-verify after every prompt edit); `python/test_harness.py` implements spec §10.2's documented `litert_lm.Engine`/`session.send_message` pattern plus a programmatic 20-real-photo-minimum gate. Neither has ever actually run against `litert_lm` in this sandbox — no package install, no model file, no real photos exist here. Two validated real-world reference cases exist in the specs and should be part of that test set once real photos are available: the Annapoorni Coconut Chutney Mix (bilingual English/Hindi, legume+mustard allergens — also one of `src/model/mockEngine.ts`'s three mock fixtures) and Ultra Milk cartons (Bahasa Indonesia/English, the multi-product edge case the app deliberately scopes down to single-product).

## India-market specifics (from the India spec)

When working on India-facing behavior, account for:
- **Allergen vocabulary in Hindi**: Sesame/Til (तिल), Tree nuts/Mewe (मेवे), Legumes/Dal (दालें), Mustard/Rai (राई), Asafoetida/Hing (हींग) — plus regional alternate names (e.g., Badam/Kaju for nuts).
- **FSSAI compliance signals**: FSSAI license number on packaging, and the vegetarian (green square)/non-vegetarian (red square) symbol — extracted as `fssaiLicenseNumber`/`isVegetarian` on `ScanResult`, not just left in prose.
- **Dietary practice flags** (Jain/Iyengar/Sattvic) were considered but removed from the schema on 2026-08-12 — per user feedback, they read as an unearned "cultural stamp" rather than the grounded, checkable classification the rest of this app aims for (contrast ADR 2/3's sourced, citable bases). See `plan.md`'s "Confirmed decisions" section for the full reasoning. `isVegetarian` and FSSAI license number remain.
- **Regional scripts**: labels may mix Devanagari, Tamil, Telugu, Kannada, Marathi with English on the same package — this is handled natively by Gemma 4 E2B's multilingual training, not by app-side language switching.
