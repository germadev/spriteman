# Spritemotion Roadmap Snapshot - 2026-09-28 Reference Drag

## 1. Completed Work

- Reference origins and destinations can now be dragged directly on their boundary frames.
- Reference gestures take priority over layer translation, painting, pixel movement, and canvas pan.
- A complete drag is grouped into one undo step; clicking without moving creates no history entry.
- The reference-driven interpolation, bounded group pill, v2 persistence, and legacy pivot compatibility remain verified.

## 2. Planned Work

- Add component-level automated pointer tests for reference editing.
- Evaluate optional influence-radius controls after real animation workflows are tested.
- Continue with transform-track authoring and raster export milestones.

## 3. Pending & Backlog

- Rotation and scale constraints driven by references.
- Keyboard selection and deletion of reference points.
- Multi-document memory and storage recovery limits.