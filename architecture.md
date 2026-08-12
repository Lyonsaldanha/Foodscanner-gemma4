
Before writing code, read both specs — the India spec overrides/extends specific sections (allergens, compliance, dietary logic) rather than duplicating the whole app description. When the two specs conflict on a detail, the India spec is more current for India-market behavior; the main spec is authoritative for architecture, model internals, and the core data flow.

There are no commands to build, lint, or test yet — the project has not been scaffolded. Once an Expo/React Native app is initialized here (per the structure below), this file should be updated with the real `npm`/`expo` commands.

## What this app is

**Ingredient Lens** — a fully offline, on-device mobile app that identifies food ingredients from a camera photo. Points of note that shape every implementation decision:

- **No network dependency at inference time.** All AI runs on-device; only the initial ~2.59 GB model download requires internet.
- **Target device is a hard constraint.** POCO F1 (Beryllium): Snapdragon 845, Adreno 630, 6 GB RAM, Android 10. Any implementation choice (image resolution, memory usage, batching) must stay within what this specific mid-range 2018 device can do.
- **Inference is slow (15–28s per scan).** This is a first-class UX problem, not an edge case — the processing screen's step-by-step progress and cancel/retake flow are as important as the detection logic itself.

## Planned architecture

### Stack (per spec section 6.1)

| Layer | Technology |
| --- | --- |
| App framework | React Native + Expo |
| On-device inference | LiteRT-LM via `react-native-litert-lm` |
| Model | Gemma 4 E2B (multimodal, `.litertlm` mobile format) |
| Camera | `expo-camera` |
| Local DB | `expo-sqlite` (scan history) |
| State | React Context + hooks |

### Why LiteRT-LM specifically

Gemma 4 E2B uses Per-Layer Embeddings (PLE): 0.79 GB of decoder weights stay in RAM, while 1.12 GB of embedding layers are memory-mapped from disk instead of fully loaded. LiteRT-LM is the only runtime evaluated that implements this mapping for Gemma 4 — alternatives (react-native-executorch, llama.rn, ONNX Runtime) either use 3–8 GB on disk or don't do smart PLE mapping, which matters a lot on a 6 GB device. Don't swap runtimes without accounting for this.

### Planned project structure (spec section 11.1)

```
ingredient-lens/
├── app/
│   ├── index.tsx          # Entry point
│   ├── camera.tsx         # Camera capture screen
│   ├── result.tsx         # Ingredient result screen
│   └── history.tsx        # Saved scans screen
├── src/
│   ├── model/
│   │   ├── engine.ts      # LiteRT-LM initialisation
│   │   ├── prompt.ts      # System + user prompt constants
│   │   └── parser.ts      # JSON output parsing + fallbacks
│   ├── camera/
│   │   └── preprocess.ts  # Image resize + normalisation
│   └── db/
│       └── history.ts     # SQLite scan history
└── assets/                # UI assets only — model is stored in app data dir, never bundled
```

### End-to-end data flow

Capture (expo-camera) → resize to 896×896 + normalise to [-1, 1] in JS (~1–2s) → combine system prompt + image tensor → LiteRT-LM inference (vision encode ~3–5s, text generation ~10–20s, CPU/GPU split handled automatically by the runtime) → parse JSON output → render card UI + persist to SQLite.

### Model I/O contract

The system prompt (spec section 8.1) instructs Gemma 4 E2B to return **only** a JSON object — no surrounding text:

```json
{
  "ingredients": [
    { "name": "string", "confidence": 0.0-1.0, "allergen": boolean }
  ],
  "allergens_detected": ["string"],
  "language": "English|Bahasa Indonesia|Hindi|...",
  "notes": "string or null"
}
```

When multiple products appear in one photo, the model instead returns a `{"products": [...]}` array, each entry with its own `product_label`, `ingredients`, and `allergens_detected`. Any parser (`src/model/parser.ts`) must handle both shapes.

Output parsing must go through the fallback chain in this order (spec 8.5), not fail on the first error:
1. `JSON.parse()` on raw output
2. Strip markdown code fences (` ```json ... ``` `) and retry
3. Re-query the model with a stricter prompt
4. Show a friendly error inviting a retake — never a raw parse error

### Development workflow rule (spec section 10)

**Prompt and parsing changes are prototyped in Python before touching React Native.** Use `litert-lm-api` (`pip install litert-lm-api`) with the same `.litertlm` model file used on-device — results are identical, so this is a legitimate fast-iteration loop, not a separate implementation. The rule from the spec: no prompt change ships to React Native until it passes 20+ real (not synthetic) test product images in Python first. Two validated real-world reference cases exist in the specs and should be part of that test set: the Annapoorni Coconut Chutney Mix (bilingual English/Hindi, single product, legume+mustard allergens) and Ultra Milk cartons (Bahasa Indonesia/English, multi-product array case).

### India-market specifics (from the India spec)

When working on India-facing behavior, account for:
- **Allergen vocabulary in Hindi**: Sesame/Til (तिल), Tree nuts/Mewe (मेवे), Legumes/Dal (दालें), Mustard/Rai (राई), Asafoetida/Hing (हींग) — plus regional alternate names (e.g., Badam/Kaju for nuts).
- **FSSAI compliance signals**: FSSAI license number on packaging, and the vegetarian (green square)/non-vegetarian (red square) symbol — these should be extracted, not just prose ingredients.
- **Dietary practice flags** (Jain/Iyengar/Sattvic) were considered but removed from the schema on 2026-08-12 — see `plan.md`'s "Confirmed decisions" section for why. `isVegetarian` and FSSAI license number remain.
- **Regional scripts**: labels may mix Devanagari, Tamil, Telugu, Kannada, Marathi with English on the same package — this is handled natively by Gemma 4 E2B's multilingual training, not by app-side language switching.