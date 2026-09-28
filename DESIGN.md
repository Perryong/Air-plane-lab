---
name: F-16A Exploded View
description: The jet's own head-up display, floating over a dusk sky, drives the airframe apart and back together.
colors:
  hud: "#6cff8f"
  hud-mid: "rgb(108 255 143 / 0.62)"
  hud-dim: "rgb(108 255 143 / 0.22)"
  sky-0: "#0c1218"
  sky-1: "#16212b"
  horizon: "#3a2f2a"
typography:
  display:
    fontFamily: "B612, system-ui, sans-serif"
    fontSize: "clamp(28px, 4vw, 44px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
  label:
    fontFamily: "B612, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.06em"
  softkey:
    fontFamily: "B612, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.14em"
  readout:
    fontFamily: "B612 Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.06em"
rounded:
  none: "0"
spacing:
  gutter: "clamp(16px, 3vw, 40px)"
  sm: "6px"
  md: "14px"
  lg: "24px"
components:
  softkey:
    backgroundColor: "transparent"
    textColor: "{colors.hud}"
    typography: "{typography.softkey}"
    rounded: "{rounded.none}"
    padding: "14px 28px"
  softkey-active:
    backgroundColor: "{colors.hud}"
    textColor: "{colors.sky-0}"
  softkey-disabled:
    textColor: "{colors.hud-dim}"
---

# Design System: F-16A Exploded View

## Overview
The page is the aircraft's head-up display. Everything the visitor reads or touches is collimated symbology: phosphor-green strokes and uppercase B612 floating over a full-bleed WebGL scene of the jet in dusk light. There are no panels, cards or filled surfaces; the aircraft owns the frame and the interface recedes into its edges.

## Colors
### Primary
**HUD Phosphor** `#6cff8f`: every stroke, glyph, caret and bracket. Used as ink only, never as a fill (the one exception is the soft-key's pressed flash).
### Neutral
**Dusk Sky** `#0c1218` → `#16212b`, with a low **Horizon Ember** `#3a2f2a` glow at the bottom edge: the page ground, painted behind a transparent canvas.
### Named Rules
- **The Ink-Only Rule:** green is a line or a letter, never an area.
- **Three Brightnesses:** full (live values, actions), 62% (captions, units, credit), 22% (inactive/unavailable). No other tints.

## Typography
B612, the typeface Airbus drew for cockpit displays, carries every word; B612 Mono only for numbers that change (tabular figures, figure-space padded so values never jitter).
### Hierarchy
- Display: aircraft designation, 28–44px bold.
- Soft-key: the single primary action, 15px bold, 0.14em tracking.
- Label/readout: 11–13px uppercase, 0.06em tracking.
Prose that must be read as a sentence (error text, credit) drops uppercase and tightens tracking to 0.02em.

## Layout
Symbology sits on the four edges at one gutter (`clamp(16px, 3vw, 40px)`): designation top-left, mode switch top-right, separation tape mid-right, readouts bottom-left, soft-key bottom-centre, credit bottom-right. The centre is always the aircraft. Below 640px the top stacks and the soft-key takes its own row.

## Elevation & Depth
Depth belongs to the 3D scene (low warm key light, cool rim, soft floor shadow). The HUD layer is flat; its only shadow is a 1px/2px dark text shadow so green holds over bright metal.

## Shapes
Square everything (`rounded: 0`). Corners are expressed as 1px L-brackets, never radii.

## Components
### Soft-key (primary action)
Bracketed label: two 1px half-brackets that spread 4px on hover, invert to a green fill with sky text while pressed, dim to 22% when disabled.
### Separation Tape (signature)
A vertical range drawn as an altitude tape: 1px spine, major ticks every 10%, minor every 2%, a solid green pointer caret. Up = more separation. Step 1%.
### Designation Bracket
Four 1px corner brackets that track the hovered (or tapped) part's projected bounds every frame, part name set beneath in 12px caps.
### Heading Tape (flight-deck signature)
Top-centre horizontal tape shown in Cockpit mode: 1px major ticks every 40px (10°), minor every 8px, a solid green caret above, three-digit B612 Mono heading beneath; slides as the visitor looks around. Edges fade out with a mask.
### Legibility Scrim (flight deck only)
Soft sky-0 fades (78% → 0) along the top 150px and bottom 130px, only in Cockpit mode, so green ink holds over the bright interior. It is a legibility device, not decoration; never a panel.
### Navigation
Mode switch as text links (`#airframe`, `#cockpit`); current mode full green with a 1px underline, the other at 62%, full green on hover.

## Do's and Don'ts
### Do:
- Keep the aircraft in the centre and the symbology on the edges.
- Use a 1px stroke for every line, bracket and tick.
- Give changing numbers B612 Mono with fixed-width padding.
### Don't:
- Don't fill areas with green, or add panels, cards, blur or glow bloom behind symbology.
- Don't draw "ghost" unlit 8s behind digits: in this face they read as real numbers ("880%").
- Don't invent aircraft performance figures; labels are part names only.
