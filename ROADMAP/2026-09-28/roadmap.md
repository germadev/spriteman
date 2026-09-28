# Spritemotion Roadmap Snapshot - 2026-09-28

## 1. Completed Work

- Layer-group interpolation now supports multiple reference points with paired start and end positions.
- Intermediate pixels blend nearby reference displacement with inverse-distance weighting.
- A single stationary reference behaves as a fixed anchor.
- Reference points can be created, selected, moved, and removed from the timeline and canvas workflow.
- Legacy group pivots remain readable as stationary references.
- Group pills stay inside the intermediate-frame region and truncate long names before endpoint cells.
- Live layer opacity uses focused previews, one update per animation frame, and debounced idle persistence.

## 2. Planned Work

- Add direct drag gestures for existing reference markers.
- Add component-level tests for reference editing and group controls.
- Expose easing controls for transform tracks.
- Add raster spritesheet export and define the atlas import model.

## 3. Pending & Backlog

- Evaluate optional falloff controls for reference-point influence.
- Decide whether reference vectors should support rotation and scale constraints in addition to displacement.
- Add storage recovery and multi-document memory limits.
- Establish browser, accessibility, and stable-release criteria.