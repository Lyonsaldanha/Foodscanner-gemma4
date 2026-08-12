# Fixtures

Real product photos for `test_harness.py`, per `ingredient-lens-spec.md` section 10's Development Rule: **no prompt change ships to React Native until it passes 20+ real (not synthetic) test images here first**, against the same `.litertlm` model file used on-device.

This directory is empty in the repo — no real product photos are available in this dev sandbox (see `plan.md`'s Reality check). Whoever has real hardware/photos should populate it before iterating on prompt changes.

## Naming convention

`test_harness.py` discovers images by filename prefix:

- `ingredients_*.jpg` / `ingredients_*.png` — tested against `INGREDIENTS_SYSTEM_PROMPT`
- `nutrition_*.jpg` / `nutrition_*.png` — tested against `NUTRITION_SYSTEM_PROMPT`

Aim for at least 20 of each before considering a prompt change ready to ship. Use real photos, not synthetic/generated ones — the spec is explicit that real product images guide prompt refinement in ways synthetic ones don't (varied lighting, glare, curved packaging, real print quality, real multilingual labels).

## Suggested coverage

Based on `ingredient-lens-spec.md` §9 and `ingredient-lens-spec-india.md`, a good spread includes:

- Indian packaged snacks/condiments with bilingual (English + regional-script) labels
- Products with an FSSAI license number and vegetarian/non-vegetarian symbol visible
- At least a few products with genuinely no nutrition panel printed (tests the app's null-handling, not just the happy path)
- A mix of clean flat-lay photos and realistic in-hand/in-store lighting
