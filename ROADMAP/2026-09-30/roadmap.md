# Spritemotion Roadmap Snapshot - 2026-09-30

## Completed Work

- Existing reference-point editing, layer groups, and frame interpolation remain available.
- Pencil and contiguous fill tools now share the canvas HUD. Fill operates on the selected layer and commits as a single undoable edit.
- Mouse and touch painting support the tool selector, and the palette eraser works with either tool.

## Planned Work

- Evaluate additional pixel-art tools such as lines and rectangles, with previews before committing.
- Add browser-level tests for painting across layers and for touch gestures.
- Add easing controls, raster spritesheet export, and atlas import support.

## Pending & Backlog

- Define brush shapes and sizes without weakening pixel-perfect editing.
- Improve narrow-screen workspace layout so the canvas and layer panels remain usable together.
- Establish storage recovery, accessibility, and stable-release criteria.