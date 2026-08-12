**INGREDIENT LENS**

On-Device AI Ingredient Detection

*Comprehensive Technical & Product Specification*

| **Target Device** **POCO F1 (Beryllium)** AI Model: Gemma 4 E2B  •  Runtime: LiteRT-LM  •  Framework: React Native *August 2026* |
| :-: |


# **1. Executive Summary**

Ingredient Lens is a fully offline, on-device mobile application that identifies food ingredients from a camera photograph. The user points their phone camera at any food item — packaged or fresh — takes a photo, and the app returns a structured list of detected ingredients within 15–30 seconds, with no internet connection required.


The application runs Google's Gemma 4 E2B multimodal language model locally on the device using the LiteRT-LM runtime, built with React Native for cross-platform compatibility. The project is specifically validated and optimised for the POCO F1 (Beryllium), a device with 6 GB RAM and a Snapdragon 845 processor.


| **Why This Matters** • No internet dependency — works in kitchens, markets, or rural areas with no signal. • Zero API costs — model runs entirely on-device, no cloud bills. • Privacy-first — food photos never leave the device. • Gemma 4 E2B's Per-Layer Embedding architecture makes this possible on a phone. • Native support for 140+ languages makes the app truly global from day one. |
| - |


# **2. Problem Statement**

Identifying ingredients in food — whether from a packaged product label, a dish on a plate, or raw produce — is a daily need for people with allergies, dietary restrictions, or nutritional goals. Existing solutions either require internet connectivity (cloud AI APIs), are too simplistic (barcode scanners only), or demand expensive modern hardware.


The core technical challenge is running a capable multimodal AI model locally on a mid-range 2018 Android phone. Previous generations of on-device models were too weak for reliable ingredient detection. Gemma 4 E2B's novel Per-Layer Embedding (PLE) architecture solves this by achieving 2.3B effective parameters of quality with a memory footprint compatible with the POCO F1.


# **3. Target Device Specification**

## **POCO F1 (Beryllium)**

| **Component** | **Specification** | **Relevance** |
| :-: | :-: | :-: |
| Processor | Qualcomm Snapdragon 845 | Octa-core ARM, supports NEON SIMD for inference |
| GPU | Adreno 630 | OpenCL support — used for GPU-accelerated inference |
| RAM | 6 GB LPDDR4X | LiteRT-LM uses ~0.79 GB RAM for decoder weights |
| Storage | 64 / 128 GB UFS 2.1 | Model cached on disk after first download (~2.59 GB) |
| OS | Android 10+ (MIUI) | Minimum Android 8 required for LiteRT-LM |
| Camera | 12 MP f/1.9 + 5 MP | Primary lens used for ingredient photo capture |
| Battery | 4000 mAh | Inference draws ~2–3 W; one scan uses ~0.03% battery |


# **4. AI Model: Gemma 4 E2B**

## **4.1 What Gemma 4 E2B Is**

Gemma 4 E2B (Effective 2 Billion) is a multimodal language model released by Google DeepMind on 2 April 2026 under the Apache 2.0 open-source licence. It accepts images, text, and audio as input and generates text output.


The "E2B" designation means the model has 2 billion effective parameters at runtime, achieved via a novel architecture called Per-Layer Embeddings (PLE). The full model has 5.1 billion total parameters, but the PLE layers are only needed during the first token computation and can be memory-mapped from disk rather than held in physical RAM continuously.


## **4.2 Per-Layer Embeddings (PLE) — The Key Innovation**

Standard transformer models load all parameters into RAM continuously. Gemma 4 E2B splits its parameters into two groups:


| **Parameter Group** | **Size** | **Location at Runtime** | **Behaviour** |
| :-: | :-: | :-: | :-: |
| Text decoder weights | 0.79 GB | Physical RAM (always) | Loaded once, stays in memory for all tokens |
| PLE embedding layers | 1.12 GB | Memory-mapped from disk | Read from storage on demand, not held in RAM |
| Vision encoder | ~0.68 GB | Loaded during image processing | Active during image encoding, then released |


This architecture means the POCO F1's 6 GB RAM is more than sufficient. The practical peak RAM usage during an inference is approximately 1.8–2.2 GB, well within safe limits.


## **4.3 Capabilities Relevant to This App**

- Image + text understanding (multimodal): can analyse a photo and answer questions about it.

- OCR: can read printed text on packaging labels within the same inference.

- Object recognition: identifies raw produce, prepared dishes, and packaged products.

- Structured output: can be prompted to return JSON, making parsing straightforward.

- Multilingual: Natively trained on 140+ languages with default support for 35+.

- Function calling: supports structured tool-use natively.

- 128K token context window: can handle very long ingredient lists on complex products.


## **4.4 Multilingual Support (140+ Languages)**

Gemma 4 E2B was pre-trained across 140+ languages and provides robust default support for 35+ languages. This is a major advantage for a global ingredient detection app — no separate language detection or model switching needed.


The model handles mixed-language documents seamlessly. For example, if a product label contains English ingredient list, Hindi instructions, and Indonesian allergen warnings all on the same package, Gemma 4 E2B understands all three simultaneously.


| **Language Family** | **Examples** | **Use Case** |
| :-: | :-: | :-: |
| Romance | English, Spanish, French, Portuguese, Italian | Western Europe, Americas |
| Germanic | German, Dutch, Swedish | Northern/Central Europe |
| Slavic | Russian, Polish, Czech, Ukrainian | Eastern Europe |
| East Asian | Mandarin, Japanese, Korean, Vietnamese | Asia-Pacific |
| South Asian | Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati | India, South Asia |
| Middle Eastern | Arabic, Hebrew, Farsi, Turkish | Middle East, North Africa |
| Southeast Asian | Indonesian, Thai, Tagalog, Malay | Southeast Asia |
| African | Amharic, Swahili, Yoruba, Zulu | Africa |


This means a single app build works globally without language-specific models or additional inference overhead.


# **5. Runtime: LiteRT-LM**

## **5.1 What LiteRT-LM Is**

LiteRT-LM is Google's official on-device inference engine for large language models, the successor to TensorFlow Lite. It is purpose-built for running Gemma models on mobile hardware. It is not a third-party wrapper — it is the same runtime that powers Gemma on Pixel phones and in Google Chrome.


## **5.2 Why LiteRT-LM Over Alternatives**

| **Runtime** | **Gemma 4 E2B Support** | **Model Size on Disk** | **RAM Management** | **Verdict for POCO F1** |
| :-: | :-: | :-: | :-: | :-: |
| LiteRT-LM | ✓ Official / First-class | 2.59 GB | Memory-maps PLE layers | Best choice |
| react-native-executorch | ✓ Supported | 8.13 GB (.pte) | Standard | Too large on disk |
| llama.rn (llama.cpp) | ✓ Via GGUF | 3–4 GB (Q4) | Standard | No smart PLE mapping |
| ONNX Runtime | ⚠ Needs v1.27+ from source | 2–3 GB | Standard | Complex setup |


The decisive advantage of LiteRT-LM is its PLE memory-mapping strategy. No other runtime implements this for Gemma 4.


## **5.3 Model Formats**

| **Format** | **Size** | **RAM** | **Use Case** |
| :-: | :-: | :-: | :-: |
| .litertlm (Mobile) | 2.59 GB | ~1.8 GB peak | Full multimodal (text + image) — used in this app |
| .litertlm (Mobile text-only) | 0.84 GB | ~0.6 GB | Text-only, no image input |
| .litertlm (BF16) | 11.4 GB | 11+ GB | Server / research use |


# **6. Application Architecture**

## **6.1 Technology Stack**

| **Layer** | **Technology** | **Purpose** |
| :-: | :-: | :-: |
| App Framework | React Native + Expo | Cross-platform UI, Android-first build |
| On-Device Inference | LiteRT-LM (via react-native-litert-lm) | Runs Gemma 4 E2B on the phone |
| Camera Input | expo-camera | Captures photos for analysis |
| Image Preprocessing | Custom JS + native bridge | Resize, normalise, format conversion |
| Model Storage | LiteRT-LM auto-cache | Downloads once, stores in app data directory |
| State Management | React Context + hooks | Manages inference state, history, settings |
| Local Database | expo-sqlite | Stores scan history, saved ingredient lists |
| Desktop Testing | litert-lm-api (Python pip) | Prototype and test prompts before mobile deployment |


## **6.2 End-to-End Data Flow**

The following describes exactly what happens from the moment the user presses the shutter button to the moment ingredients appear on screen:


- Step 1 — Camera Capture

  The user opens the app and points the camera at a food item. On pressing the capture button, expo-camera returns a raw JPEG image at the device's native resolution (up to 12 MP on POCO F1).

- Step 2 — Image Preprocessing

  The raw JPEG is resized to 896 × 896 pixels (LiteRT-LM's optimal input resolution for Gemma 4 E2B). Pixel values are normalised to the range \[-1, 1\]. This step runs in JavaScript and takes approximately 1–2 seconds.

- Step 3 — Prompt Construction

  A structured system prompt is combined with the preprocessed image tensor. The system prompt instructs Gemma 4 E2B to return a JSON object listing detected ingredients, confidence levels, and allergen information.

- Step 4 — LiteRT-LM Inference

  The image tensor and prompt are passed to the LiteRT-LM session. The model processes the image through its vision encoder (~3–5 seconds), then runs autoregressive text generation (~10–20 seconds). CPU and GPU are both engaged: the Adreno 630 handles matrix multiplications, while ARM cores handle attention and other operations.

- Step 5 — Output Parsing

  The raw text output from Gemma 4 E2B is a JSON string. The ingredient parser extracts the ingredient array, allergen flags, and confidence scores. Malformed JSON is caught and handled.

- Step 6 — UI Render

  The parsed ingredient list is displayed in a card-based UI. Each ingredient shows its name, confidence, and allergen tags. The result is saved to local SQLite history.


| **Estimated Total Time Per Scan (POCO F1)** Image capture:           instant Preprocessing:           1–2 seconds Vision encoding:         3–5 seconds Text generation:         10–20 seconds Parsing + rendering:     1 second ───────────────────────────────────── Total:                   ~15–28 seconds |
| - |


## **6.3 CPU / GPU Split**

LiteRT-LM automatically splits inference work between CPU and GPU. The developer does not need to configure this manually.


# **7. Model Lifecycle**

## **7.1 First Launch — Model Download**

The Gemma 4 E2B mobile model file (2.59 GB) cannot be bundled inside the app binary due to app store size limits. On first launch, the app downloads the model from a CDN. LiteRT-LM's model manager handles this automatically with progress callbacks.


| **First Launch Experience** 1. App opens → shows welcome screen with download prompt. 2. User taps 'Download AI Model' → 2.59 GB download begins. 3. Progress bar shows download status (5–15 minutes on typical mobile data). 4. Download completes → model verified via SHA-256 checksum. 5. App transitions to camera screen. Never shown again. |
| - |


## **7.2 Subsequent Launches — Model Loading**

On every subsequent launch, LiteRT-LM loads the cached model. The text decoder weights (0.79 GB) are loaded into RAM. The PLE layers (1.12 GB) are memory-mapped and not loaded into physical RAM. Model loading takes approximately 3–6 seconds on POCO F1 cold start.


# **8. Prompt Engineering**

## **8.1 System Prompt**

You are an ingredient detection assistant. When given an image of food,

a food package, or a dish, you identify all visible ingredients and

return ONLY a valid JSON object in this exact format:

\{

  "ingredients": \[

    \{ "name": "string", "confidence": 0.0-1.0, "allergen": boolean \}

  \],

  "allergens\_detected": \["string"\],

  "language": "English|Bahasa Indonesia|Hindi|...",

  "notes": "string or null"

\}

Do not include any text outside the JSON object.

If multiple products are visible, return an array of objects,

each with a "product\_label" field describing the product.


## **8.2 Multilingual Prompt Handling**

No language-specific prompts needed. The system prompt is language-agnostic. Gemma 4 E2B automatically detects the language(s) on the packaging and responds in kind. The "language" field in the JSON helps the app understand which language the OCR text was in.


## **8.3 User Prompt (per scan)**

Identify all ingredients visible in this image.


## **8.4 Edge Case: Multi-Product Photos**

When the user photographs multiple products simultaneously (e.g., two milk cartons side by side), the system prompt instructs Gemma 4 E2B to return an array of objects. Each object includes a "product\_label" field describing which product it refers to:


\{

  "products": \[

    \{

      "product\_label": "Ultra Milk - Plain",

      "ingredients": \[ ... \],

      "allergens\_detected": \[ ... \]

    \},

    \{

      "product\_label": "Ultra Milk - Chocolate",

      "ingredients": \[ ... \],

      "allergens\_detected": \[ ... \]

    \}

  \]

\}


## **8.5 Output Parsing Strategy**

- Primary: Attempt JSON.parse() on the raw model output.

- Fallback 1: Strip markdown code fences (\`\`\`json ... \`\`\`) and retry.

- Fallback 2: Re-query the model with an explicit stricter prompt.

- Fallback 3: Display a friendly error and invite the user to retake the photo.


# **9. Real-World Test Cases**

The following two product images have been used to validate the architecture and expected model behaviour:


## **9.1 Test Case 1: Sri Annapoorni Coconut Chutney Mix (India)**

Product: Packaged spice/condiment mix from India. Label is bilingual (English + Hindi).


Expected Model Output:


\{

  "ingredients": \[

    \{ "name": "Coconuts", "confidence": 0.98, "allergen": false \},

    \{ "name": "Roasted Chenna Dal", "confidence": 0.97, "allergen": true \},

    \{ "name": "Green Chilli", "confidence": 0.96, "allergen": false \},

    \{ "name": "Curry Leaves", "confidence": 0.96, "allergen": false \},

    \{ "name": "Ginger", "confidence": 0.95, "allergen": false \},

    \{ "name": "Mustard", "confidence": 0.95, "allergen": true \},

    \{ "name": "Edible Oil", "confidence": 0.94, "allergen": false \}

  \],

  "allergens\_detected": \["Mustard", "Chenna Dal (Legume)"\],

  "language": "English with Hindi instructions",

  "notes": "Product is free from artificial colours and preservatives."

\}


| **Test Case 1 Validation** ✓ Clear English ingredient list on packaging ✓ Allergen detection (Mustard, legumes) ✓ Bilingual support (English + Hindi) ✓ Manufacturer claims (no artificial additives) captured in notes |
| - |


## **9.2 Test Case 2: Ultra Milk Cartons (Indonesia) — Multi-Product Edge Case**

Product: Two milk beverage cartons side by side (plain milk + chocolate flavour). Labels in Bahasa Indonesia and English.


Expected Model Output (Array Format):


\{

  "products": \[

    \{

      "product\_label": "Ultra Milk - Plain Fresh Milk",

      "ingredients": \[

        \{ "name": "Fresh Milk", "confidence": 0.99, "allergen": true \}

      \],

      "allergens\_detected": \["Milk"\],

      "language": "Bahasa Indonesia + English",

      "notes": "100% fresh milk. No preservatives."

    \},

    \{

      "product\_label": "Ultra Milk - Chocolate Flavour",

      "ingredients": \[

        \{ "name": "Fresh Milk", "confidence": 0.98, "allergen": true \},

        \{ "name": "Sugar", "confidence": 0.97, "allergen": false \},

        \{ "name": "Cocoa Powder", "confidence": 0.96, "allergen": false \},

        \{ "name": "Whole Milk Powder", "confidence": 0.97, "allergen": true \},

        \{ "name": "Skim Milk Powder", "confidence": 0.96, "allergen": true \},

        \{ "name": "Vegetable Stabilizer", "confidence": 0.94, "allergen": false \}

      \],

      "allergens\_detected": \["Milk"\],

      "language": "Bahasa Indonesia + English",

      "notes": "No artificial sweetener. Shake before opening."

    \}

  \]

\}


| **Test Case 2 Validation** ✓ Multi-product detection (two cartons in one photo) ✓ Product differentiation (plain vs chocolate) ✓ Multilingual OCR (Bahasa Indonesia + English) ✓ Allergen highlighting (Milk — consistent across both) ✓ Manufacturer instructions captured (shake before opening) |
| - |


## **9.3 Real-World Insights from Test Cases**

- Manufacturer claims matter: "No artificial colours" or "No preservatives" should be captured in the notes field, not just raw ingredient list.

- Allergen patterns: Allergen detection should be cross-checked against common allergen lists (e.g., the "big 8" in some jurisdictions).

- Bilingual content: Labels mixing two or more languages are common in international products. Gemma 4's multilingual training handles this seamlessly without language-switching overhead.

- Product differentiation: When multiple items appear, clear labeling is critical for user clarity.


# **10. Python Development Workflow**

Before implementing any prompt or parsing logic in React Native, all development and testing is done in Python using the official litert-lm-api library. This allows rapid iteration without rebuilding the mobile app.


## **10.1 Python Setup**

pip install litert-lm-api


## **10.2 Python Testing with Real Images**

import litert\_lm

import json


SYSTEM\_PROMPT = """You are an ingredient detection assistant...

(see section 8.1)

"""


with litert\_lm.Engine("gemma-4-e2b-it.litertlm") as engine:

    session = engine.create\_session(system\_prompt=SYSTEM\_PROMPT)


    \# Test Case 1: Annapoorni

    result = session.send\_message(

        "Identify all ingredients visible in this image.",

        image="annapoorni.jpg"

    )

    print("Test 1:", json.dumps(json.loads(result), indent=2))


    \# Test Case 2: Ultra Milk (multi-product)

    result = session.send\_message(

        "Identify all ingredients visible in this image.",

        image="ultra\_milk\_both.jpg"

    )

    parsed = json.loads(result)

    if "products" in parsed:

        print(f"Multi-product detected: \{len(parsed\[\\"products\\"\])\} items")


| **Development Rule** No prompt change goes into React Native until it passes 20+ test images in Python first. The same .litertlm model file is used in both environments — results are identical. Real product images (not synthetic) guide prompt refinement. |
| - |


# **11. React Native Implementation Overview**

## **11.1 Project Structure**

ingredient-lens/

├── app/

│   ├── index.tsx          \# Entry point

│   ├── camera.tsx         \# Camera capture screen

│   ├── result.tsx         \# Ingredient result screen

│   └── history.tsx        \# Saved scans screen

├── src/

│   ├── model/

│   │   ├── engine.ts      \# LiteRT-LM initialisation

│   │   ├── prompt.ts      \# System + user prompt constants

│   │   └── parser.ts      \# JSON output parsing + fallbacks

│   ├── camera/

│   │   └── preprocess.ts  \# Image resize + normalisation

│   └── db/

│       └── history.ts     \# SQLite scan history

└── assets/

    └── (UI assets only — model stored in app data dir)


## **11.2 Core Inference Hook**

// src/model/engine.ts (simplified)

import \{ useModel, GEMMA\_4\_E2B\_IT \} from "react-native-litert-lm";


export function useIngredientDetector() \{

  const \{ model, isReady, downloadProgress \} = useModel(

    GEMMA\_4\_E2B\_IT,

    \{

      backend: "gpu",

      systemPrompt: INGREDIENT\_SYSTEM\_PROMPT,

      enableMemoryTracking: true,

    \}

  );


  const detectIngredients = async (photoUri: string) =\> \{

    const resized = await preprocessImage(photoUri);

    const raw = await model.sendMessage(

      "Identify all ingredients visible in this image.",

      \{ image: resized \}

    );

    return parseIngredientOutput(raw);

  \};


  return \{ detectIngredients, isReady, downloadProgress \};

\}


# **12. User Experience Design**

## **12.1 Screen Flow**

- Onboarding Screen: Explains the app and initiates model download.

- Download Screen: Shows progress bar and estimated time.

- Camera Screen: Full-screen viewfinder with capture button and flash toggle.

- Processing Screen: Progress animation with step-by-step updates.

- Result Screen: Card-based ingredient list with allergen highlighting.

- History Screen: Past scans searchable by ingredient name.


## **12.2 Handling the Wait Time**

The 15–28 second inference time is the biggest UX challenge. Solutions:


- Show step-by-step progress (Encoding image… → Identifying ingredients…)

- Display estimated remaining time, updated every 2 seconds.

- Allow user to cancel and retake the photo at any point.

- Distinguish first-run model loading from inference time.


# **13. Offline Operation**

After the initial model download, the app operates with zero network dependency:


- All AI inference (Gemma 4 E2B via LiteRT-LM)

- Scan history database (SQLite)

- Ingredient information and allergen data (bundled JSON reference)

- All UI assets


The app detects network availability on launch and shows an informational banner only if the model has not yet been downloaded and no network is available.


# **14. Known Limitations**

| **Limitation** | **Detail** | **Mitigation** |
| :-: | :-: | :-: |
| Inference speed | 15–28 seconds per scan | Step-by-step progress UI; cancel/retake |
| First-launch download | 2.59 GB download required | Clear onboarding; Wi-Fi prompt |
| Dim / blurry photos | Model accuracy drops significantly | Photo quality guidance overlay |
| Very small text on labels | OCR limited by photo resolution | Tap-to-zoom before capture |
| Novel/niche ingredients | May produce lower confidence scores | Confidence indicator shown |
| Multiple overlapping items | Model may miss partially hidden items | Prompt encourages single-item focus |
| Battery temperature | Extended inference raises device temp | Thermal monitoring; inference pause |


# **15. Future Enhancements**

- Barcode scanning: Supplement AI detection with optional barcode scan.

- Nutritional data: Link detected ingredients to offline nutrition reference.

- Allergen profiles: Personal allergen alerts that highlight dangerous ingredients.

- Recipe suggestions: Given detected ingredients, suggest recipes.

- Audio output: Read detected ingredients aloud using expo-speech.

- Model updates: When LiteRT-LM web adds multimodal support, offer PWA version.


# **16. Appendix: Key References**

- Gemma 4 official documentation: ai.google.dev/gemma/docs/core

- LiteRT-LM runtime: ai.google.dev/edge/litert-lm/overview

- Gemma 4 E2B mobile model (HuggingFace): huggingface.co/google/gemma-4-e2b-it

- react-native-executorch: executorch.swmansion.com

- llama.rn multimodal docs: github.com/mybigday/llama.rn

- Python litert-lm-api: pip install litert-lm-api



*Ingredient Lens  •  Technical Specification  •  August 2026  •  Confidential*
