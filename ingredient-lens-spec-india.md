**INGREDIENT LENS**

On-Device AI Ingredient Detection for India

*Comprehensive Technical Specification*


# **1. Executive Summary**

Ingredient Lens is a fully offline, on-device mobile application optimised for Indian users. It identifies food ingredients from a camera photograph using Google's Gemma 4 E2B model running locally on the device.


# **2. Problem Statement & India Context**

India has the world's largest vegetarian population (30-40%), diverse regional cuisines, and complex dietary practices (Jain, Iyengar, Sattvic, etc.). Many users have sesame, tree nut, or dal allergies that are serious. Product labels routinely mix English, Hindi, and regional languages.


- Offline-first is essential: Rural India has unreliable mobile internet.

- FSSAI compliance: App should understand Indian food labeling standards.

- Hindi + regional languages: Labels mix multiple scripts.


# **3. Technology Stack**

AI Model: Gemma 4 E2B (2.3B effective parameters, 140+ language support)

Runtime: LiteRT-LM (Google's official on-device inference engine)

Framework: React Native + Expo (cross-platform)

Target Device: POCO F1 (6 GB RAM, Snapdragon 845, $150-200 price point)


# **4. Indian Allergens & Foods**

| **Allergen** | **Hindi** | **Common In** | **Alternate Names** |
| :-: | :-: | :-: | :-: |
| Sesame (Til) | तिल | Masalas, ladoos, tahini | Gingelly |
| Tree nuts | मेवे | Sweets, spice blends | Badam, kaju |
| Legumes (Dal) | दालें | Chenna dal, moong, urad | Gram, lentil |
| Mustard | राई | Pickles, chutneys | Sarson |
| Asafoetida (Hing) | हींग | Spice blends | Perunk (Tamil) |


# **5. India-Specific Features**

## **5.1 FSSAI Compliance**

- Reads FSSAI license number from packaging

- Detects vegetarian/non-vegetarian symbol (green/red square)

- Identifies common allergen declarations

- Reads manufacturing dates in Gregorian calendar


## **5.2 Dietary Practices**

- Jain diet: No onion, garlic, root vegetables

- Iyengar diet: No onion, garlic, meats

- Sattvic diet: Pure foods only


## **5.3 Multilingual Support**

- 140+ languages in Gemma 4 E2B

- Seamlessly handles bilingual labels (English + Hindi)

- Regional scripts: Devanagari, Tamil, Telugu, Kannada, Marathi


# **6. Offline Operation (Critical for India)**

- No internet required after first model download (2.59 GB)

- All inference runs locally on-device

- SQLite database stores scan history

- Perfect for tier-2/tier-3 cities and rural India


# **7. Real-World Test Case: Annapoorni Chutney Mix**

Indian masala package with bilingual (English + Hindi) labels.


\{

  "ingredients": \[

    \{ "name": "Coconuts", "confidence": 0.98 \},

    \{ "name": "Chenna Dal", "confidence": 0.97, "allergen": true \},

    \{ "name": "Mustard", "confidence": 0.95, "allergen": true \}

  \],

  "allergens\_detected": \["Mustard", "Legume"\],

  "is\_vegetarian": true

\}


# **8. Model Capabilities**

- Image + text (multimodal)

- OCR for reading package labels

- 140+ languages (no language switching needed)

- Structured JSON output for parsing


# **9. Inference Time on POCO F1**

First scan (cold start): 5-10 seconds model load + 15-28 seconds inference = ~20-38 seconds total

Subsequent scans: 15-28 seconds


# **10. Why This Works on POCO F1**

Gemma 4 E2B uses Per-Layer Embeddings (PLE) architecture:

- Text decoder weights (0.79 GB) loaded in RAM

- Embedding layers (1.12 GB) memory-mapped from disk

- Peak RAM usage: ~1.8-2.2 GB (well within 6 GB POCO F1 limit)


────────────────────────────────────────────────────

*Ingredient Lens  •  India-Focused Specification  •  August 2026*
