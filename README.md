# Ingredient Lens

An Expo + TypeScript app that scans a grocery product's ingredient panel with the phone camera, decodes it into plain-language ingredient explanations, flags allergens, and computes a nutrition "balance" verdict from the label's per-100g values — all on-device.

Ingredient/allergen decoding runs against a bundled glossary and a deterministic nutrition rule engine (FSA per-100g thresholds); free-text enrichment for ingredients the glossary doesn't recognize is done via **Gemma 4 E2B** running locally through [`react-native-litert-lm`](https://github.com/hung-yueh/react-native-litert-lm) — no data leaves the device, no cloud inference calls.

## Status

MVP is feature-complete against a mock model client (camera → processing → result → history, full UI in the "Conceptual Sketch Bento Box" style — see [`CLAUDE.md`](CLAUDE.md)). Real on-device inference integration is in active bring-up: it builds, installs, and downloads the model on physical Android hardware, but has not yet completed a successful end-to-end scan — see [`plan.md`](plan.md) Phase 14 for the full, current debugging trail, including a confirmed upstream bug in the underlying inference package that's currently blocking it ([google-ai-edge/LiteRT-LM#2461](https://github.com/google-ai-edge/LiteRT-LM/issues/2461)).

## Getting started

```bash
npm install
npm run start        # expo start — scan the QR code with Expo Go, or press a/w for android/web
```

By default the app runs against a mock model client so it's fully usable without any native build or model download. To exercise the real on-device model:

```bash
cp .env.example .env   # set EXPO_PUBLIC_USE_MOCK_MODEL=false
npx expo prebuild --platform android
npx expo run:android   # requires a physical arm64 Android device; see plan.md Phase 14
```

### Other commands

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
npm test             # jest --passWithNoTests
npm run web          # expo start --web
```

## Project structure

```
app/                  expo-router screens: camera, processing, result, history, settings
src/
  camera/, capture/    camera capture + image preprocessing
  glossary/            ingredient/allergen glossary decoder
  nutrition/           FSA per-100g rule engine (BalanceVerdict)
  model/               ModelClient abstraction — mock + real (Gemma 4 E2B) implementations
  scan/                 orchestration: glossary → model enrichment → verdict
  db/                   SQLite-backed scan history
  ui/                   shared components + design tokens
python/                 prompt-mirror test harness (validates prompts outside the app)
```

## Documentation

| Doc | What it covers |
|---|---|
| [`plan.md`](plan.md) | Living build plan — atomic tasks with context, rubber-duck checks, and results. Start here before any implementation work. |
| [`architecture.md`](architecture.md) | Module boundaries, Architecture Decision Records, the real `ScanResult` schema |
| [`ingredient-lens-spec.md`](ingredient-lens-spec.md) | Full product/technical spec (global) |
| [`ingredient-lens-spec-india.md`](ingredient-lens-spec-india.md) | India-market variant: allergen glossary, FSSAI compliance, dietary practices |
| [`CLAUDE.md`](CLAUDE.md) | UI design language and repo conventions |

## Known limitations

- Real on-device multimodal inference (image + text → ingredients) currently fails on every physical device tested, due to an open upstream bug in `react-native-litert-lm`'s Android backend handling — not a bug in this app's code. Full root-cause trail in `plan.md` T14.2.
- The nutrition balance verdict is a deterministic rule-of-thumb (UK FSA per-100g thresholds), not medical or dietary advice — the app says so on the result screen.
- No cloud fallback by design: if the on-device model can't load, ingredient enrichment beyond the bundled glossary is unavailable rather than silently sent off-device.

## Privacy

All image capture, OCR/ingredient decoding, and model inference happen on-device. No product photos, scan results, or ingredient data are sent to any server.
