# Product

<!-- impeccable:product-schema 1 -->

> Written unattended from the approved spec (user asked to proceed while away). Lines marked *(inferred)* were not confirmed by the user.

## Platform

web

## Stack
static HTML/CSS/JS, no build step; Three.js from cdn.jsdelivr.net (confirmed via approved spec)

## Users
Visitors to the user's portfolio who want to see a fighter jet come apart and go back together. *(inferred: general design/tech-curious audience, desktop first, phones common)*

## Product Purpose
A showcase: the Sketchfab F-16A (by amf1re) disassembles into its ten major sections and reassembles, orbitable in 3D. Success = it loads fast, looks polished, and the explode reads as a satisfying mechanical event.

## Positioning
A real textured airframe split into its genuine major sections (radome, canopy, wings, stabilators, fin, nozzle, stores) — not a generic spinning model viewer.

## Capabilities and Constraints
- Controls: Assemble/Disassemble toggle, explode scrubber, orbit/zoom, hover part names.
- Ten parts: Fuselage, Nose cone / radome, Canopy, Left/Right wing, Vertical tail, Left/Right stabilator, Engine nozzle, Fuel tanks & stores.
- GLB 6.5 MB (Draco + WebP); must show a loading state and a load-failure state.
- Future phase 2: a Boeing 757 cockpit mode behind a header mode switch (slot reserved, not built).

## Brand Commitments
Model credit required: "F16A" by amf1re, Sketchfab Standard license.

## Evidence on Hand
Only the 3D model itself (`public/f16.glb`). No specs, stats, or descriptive copy supplied — do not invent aircraft performance claims.

## Product Principles
- The aircraft leads; the interface recedes.
- Motion is the content: the explode must feel engineered, not floaty.
- Honest labels only — part names, nothing speculative.

## Accessibility & Inclusion
Respect prefers-reduced-motion; keyboard-operable controls; WCAG AA text contrast. *(inferred baseline)*
