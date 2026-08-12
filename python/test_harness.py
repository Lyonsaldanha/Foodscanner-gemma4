"""
Prototype and validate prompt changes against real product photos before
they ship to React Native — ingredient-lens-spec.md section 10's
Development Rule: no prompt change goes into React Native until it passes
20+ real (not synthetic) test images here in Python first, against the same
.litertlm model file used on-device.

NOT RUNNABLE IN THIS SANDBOX: needs the litert-lm-api Python package, the
real ~2.59GB .litertlm model file, and real product photos in fixtures/ —
none of which exist in this dev environment (see plan.md's Reality check).
This script is complete and correct against the documented API (spec
section 10.2), but has never actually been executed here.

Usage:
    pip install litert-lm-api
    python test_harness.py --kind both
"""

import argparse
import json
import sys
from pathlib import Path

from prompts import (
    INGREDIENTS_SYSTEM_PROMPT,
    NUTRITION_SYSTEM_PROMPT,
    build_ingredients_user_prompt,
    build_nutrition_user_prompt,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"
MODEL_PATH = "gemma-4-e2b-it.litertlm"
MIN_IMAGES_PER_PROMPT = 20  # ingredient-lens-spec.md section 10's Development Rule

# Lightweight structural check (top-level keys only) mirroring
# RawIngredientsOutputSchema / RawNutritionOutputSchema (src/model/rawOutput.ts).
# This script's job is fast prompt iteration, not to replace the zod
# validation that actually gates the React Native app (T4.4's parser).
INGREDIENTS_REQUIRED_KEYS = {
    "productLabel",
    "ingredients",
    "allergensDetected",
    "isVegetarian",
    "fssaiLicenseNumber",
    "language",
    "notes",
}
NUTRITION_REQUIRED_KEYS = {"productLabel", "nutrition", "language", "notes"}


def find_fixture_images(kind: str) -> list[Path]:
    # Naming convention: fixtures/ingredients_*.jpg for the ingredients
    # prompt, fixtures/nutrition_*.jpg for the nutrition prompt — see
    # fixtures/README.md.
    return sorted(FIXTURES_DIR.glob(f"{kind}_*.jpg")) + sorted(FIXTURES_DIR.glob(f"{kind}_*.png"))


def validate_shape(parsed: dict, required_keys: set[str]) -> list[str]:
    return sorted(k for k in required_keys if k not in parsed)


def run_suite(kind: str, system_prompt: str, user_prompt: str, required_keys: set[str]) -> bool:
    try:
        import litert_lm
    except ImportError:
        print(f"[{kind}] litert-lm-api is not installed (`pip install litert-lm-api`) — cannot run.")
        return False

    images = find_fixture_images(kind)
    print(f"[{kind}] {len(images)} fixture image(s) found in {FIXTURES_DIR}")
    if len(images) < MIN_IMAGES_PER_PROMPT:
        print(
            f"[{kind}] Below the {MIN_IMAGES_PER_PROMPT}-image Development Rule minimum — "
            "add more real product photos before shipping this prompt to React Native."
        )
    if not images:
        return False

    passed = 0
    failed = 0
    with litert_lm.Engine(MODEL_PATH) as engine:
        session = engine.create_session(system_prompt=system_prompt)
        for image_path in images:
            raw = session.send_message(user_prompt, image=str(image_path))
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError as e:
                print(f"  FAIL {image_path.name}: not valid JSON ({e})")
                failed += 1
                continue

            missing = validate_shape(parsed, required_keys)
            if missing:
                print(f"  FAIL {image_path.name}: missing keys {missing}")
                failed += 1
                continue

            print(f"  PASS {image_path.name}")
            passed += 1

    print(f"[{kind}] {passed} passed, {failed} failed, {len(images)} total")
    return failed == 0 and passed >= MIN_IMAGES_PER_PROMPT


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kind", choices=["ingredients", "nutrition", "both"], default="both")
    args = parser.parse_args()

    results = []
    if args.kind in ("ingredients", "both"):
        results.append(
            run_suite("ingredients", INGREDIENTS_SYSTEM_PROMPT, build_ingredients_user_prompt(), INGREDIENTS_REQUIRED_KEYS)
        )
    if args.kind in ("nutrition", "both"):
        results.append(run_suite("nutrition", NUTRITION_SYSTEM_PROMPT, build_nutrition_user_prompt(), NUTRITION_REQUIRED_KEYS))

    ready = bool(results) and all(results)
    print("\nREADY TO SHIP TO REACT NATIVE" if ready else "\nNOT READY — see failures/counts above")
    return 0 if ready else 1


if __name__ == "__main__":
    sys.exit(main())
