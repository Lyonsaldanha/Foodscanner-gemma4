# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build plan

**[plan.md](plan.md)** is the living build plan — start there before doing any implementation work. It uses an atomic-task system: each task carries a *Context* (why it exists), a *Deliverable*, a pre-specified *Rubber-duck check* (how to verify it's actually correct, not just present), and, once done, a *Result* and *Completion summary*. Before starting new work, find the next unchecked task there and read its Context. On completing a task, fill in its Result/Rubber-duck-check-outcome/Completion-summary fields directly in `plan.md` — that's what lets a later session trust "done" without re-deriving it.

## Project state

This repository currently contains **specification documents only** — there is no source code, `package.json`, or build tooling yet:

- [ingredient-lens-spec.md](ingredient-lens-spec.md) — full technical/product spec (global)
- [ingredient-lens-spec-india.md](ingredient-lens-spec-india.md) — India-market-focused variant of the same spec (allergen glossary, FSSAI compliance, dietary practices)


## UI design style: Conceptual Sketch Bento Box

This is the intended visual language for the app's screens (camera, processing, result, history). It combines a **bento-box grid** (modular, unequal-sized rectangular cells that tile cleanly) with a **conceptual sketch** aesthetic (hand-drawn, annotated, whiteboard-like) rather than a polished glossy mobile-UI look. The intent is to make AI-detected data feel like an annotated field notebook, not a corporate dashboard.

**Layout**
- Compose each screen as a bento grid: irregular cells of varying size in a consistent gutter, not a uniform card list. The result screen's ingredient cards, allergen summary, and notes block should read as distinct bento cells of different proportions (e.g., a wide "notes" cell, a tall "allergens" cell, small square cells per ingredient).
- Cell boundaries are visible hand-drawn-style borders (slightly irregular stroke, not a pixel-perfect straight `1px solid` line) — evokes a sketched box, not a rendered rectangle.
- Leave deliberate whitespace/margin asymmetry between cells rather than perfectly even padding — sketches aren't gridded to the pixel.

**Line and stroke**
- Borders and dividers use a sketch/ink-line treatment: slightly variable stroke weight, rounded imperfect corners, occasional double-stroke (as if redrawn) on emphasized cells (e.g., allergen warnings).
- Icons are simple line-drawn/monoline glyphs (outline style), not filled or photographic — ingredients, allergen warnings, camera/flash controls should look sketched, consistent stroke width throughout.

**Typography**
- Headings/labels: a handwritten or marker-style display face for cell titles and callouts (e.g., "ALLERGENS", ingredient names as section headers) to reinforce the notebook feel.
- Body/data text (confidence scores, ingredient details, JSON-derived values): a clean, highly legible sans-serif — the sketch aesthetic applies to structure and chrome, not to the actual data the user needs to read quickly (a food-safety-relevant allergen list must stay unambiguous).

**Color**
- Base surface: off-white/paper tone (not pure white) to reinforce the sketchbook feel.
- Ink/line color: a single dark neutral (charcoal/ink), used consistently for all sketch borders and monoline icons.
- One accent color reserved exclusively for allergen/warning cells — used sparingly so it reads as urgent, e.g., a hand-drawn circle or double-underline around a flagged allergen rather than a solid alert-red block.
- Confidence levels can use a light annotation style (e.g., a small hand-drawn percentage tag) rather than a progress bar or gradient fill.

**Motion / interaction**
- Transitions between bento cells (e.g., tapping an ingredient to expand detail) should feel like "uncovering" more of the sketch — a cell expanding in place — rather than a modal sliding over the whole screen.
- The processing screen's step-by-step progress ("Encoding image…" → "Identifying ingredients…") should render as sketched checkmarks/annotations appearing sequentially in a bento cell, reinforcing the notebook metaphor rather than a generic spinner.

**Where this applies first**: the Result screen is the highest-value place to establish this style (ingredient cards + allergen highlighting + notes, per spec section 12.1), since it's where structured model output is most bento-shaped. Camera and Processing screens should carry the same ink/paper/sketch treatment for chrome (buttons, progress) even though they're less grid-heavy.
