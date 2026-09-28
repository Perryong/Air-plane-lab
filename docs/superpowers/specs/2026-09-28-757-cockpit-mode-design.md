# 757 Cockpit Mode — Design (Phase 2)

## Intent
Add a second mode to the existing F-16 showcase page: the visitor sits in the
captain's seat of a Boeing 757-200 flight deck and looks around. Same HUD
visual world as the F-16 page (see `DESIGN.md`).

Model: "Boeing 757-200 Icelandair Cockpit" by VTX —
https://sketchfab.com/3d-models/boeing-757-200-icelandair-cockpit-1cb8f8109cb145849282ad703a652859
(uid `1cb8f8109cb145849282ad703a652859`, ~450k faces, glTF download ~85 MB).

**License: CC BY-NC-SA.** Attribution required; non-commercial use only; the
derived `public/cockpit.glb` is shared under the same license. Fine for a
personal portfolio, not for a paid or client site. The page credits it.

## Decisions (confirmed with user)
- Interaction: **seated look-around** — camera fixed at the captain's eye
  point, drag/swipe to look; no movement, no zoom.
- Mode switch: **same page**, header "Airframe · Cockpit" switch swaps the
  scene in place; cockpit lazy-loads on first entry; URL hash `#cockpit` /
  `#airframe` for deep links, reload and back button.

## Success criteria
- `#cockpit` shows the flight deck from the captain's seat; drag changes view.
- Airframe mode is unchanged: all phase-1 checks still pass, and the F-16 page
  does not download `cockpit.glb` until Cockpit is chosen.
- `public/cockpit.glb` ≤ 20 MB (target 10–15 MB), contains node `eye_captain`.
- Cockpit load failure shows an error; Airframe mode keeps working.
- Zero console errors; works at 1440×900 and 375×812; honours reduced motion.

## Pipeline

### 1. Blender: `blender/build_cockpit.py` (run via Blender MCP)
1. Download via the Sketchfab API with the addon's stored key (same method as
   phase 1; `download_sketchfab_model` is unsupported by the addon) into
   `blender/src_cockpit/` (gitignored).
2. Import into a fresh scene `Cockpit_Build` (never touch other scenes).
3. Normalise: real-world metres, forward (towards the windscreen) = +X, up = +Z.
4. Locate the captain's (left) seat; add an Empty `eye_captain` ≈0.75 m above
   the seat cushion, looking at the main instrument panel (+X, slight
   downward pitch). Verified with a viewport screenshot from that point.
5. Export raw GLB to `blender/cockpit_raw.glb` (gitignored).
6. `blender/compress.sh` gains a cockpit step: gltf-transform optimize with
   Draco + WebP, `--join false --flatten false` so `eye_captain` survives,
   textures 2048 px; if the result exceeds 20 MB, drop to 1024 px textures,
   then simplify geometry only (never removing `eye_captain`).

### 2. Pure look logic: `lookaround.js` (+ `tests/lookaround.test.mjs`)
- `clampLook(yaw, pitch) -> [yaw, pitch]` — yaw limited to ±150° from the
  panel, pitch to −50°…+35° (radians in code).
- `headingDeg(yaw) -> 0..359` integer for the HUD tape (0 = straight at the
  panel).
- `stepLook(current, target, dt, {reduced}) -> [yaw, pitch]` — eases toward
  the drag target (critically damped, ~120 ms); reduced motion returns target.

### 3. Page changes (`main.js`, `index.html`, `style.css`)
- Two `THREE.Scene`s share one renderer; the render loop draws the active one.
- Mode from `location.hash` (`#cockpit` → cockpit, anything else → airframe);
  `hashchange` switches; header links become `<a href="#airframe">` /
  `<a href="#cockpit">` with `aria-current` on the active one (replaces the
  "soon" placeholder).
- Cockpit mode: camera at `eye_captain` world position; pointer drag updates
  yaw/pitch target (drag sensitivity scales with viewport width); no OrbitControls
  in this mode. Keyboard: the canvas gets `tabindex="0"` and arrow keys look (for keyboard users).
- Cockpit loads once on first entry via the same GLTF/Draco loader, showing the
  "Acquiring…" percentage; on failure shows an error line and a link back to
  Airframe; Airframe keeps working.
- HUD per mode (CSS class on `body`):
  - Airframe: unchanged.
  - Cockpit: hide separation tape, soft-key, SEP/sections readout; show a
    top-centre heading tape (ticks + number from `headingDeg`), title
    "757-200 · Flight deck", hint "Drag to look around" until first drag,
    credit "Boeing 757-200 Icelandair Cockpit by VTX · CC BY-NC-SA".
- Mode change: short cross-fade of the canvas (~250 ms); instant under reduced
  motion.
- `window.__viewer` gains `mode`, `cockpitReady` (promise, created on first
  entry) and `look` (current `[yaw, pitch]`) for Playwright.

### 4. Verification
- `node --test tests/*.test.mjs` (explode + lookaround).
- `python3 tests/check_glb.py public/f16.glb` (unchanged) and
  `python3 tests/check_cockpit_glb.py public/cockpit.glb`: GLB magic, a node
  named `eye_captain`, embedded images, file ≤ 20 MB.
- Playwright (127.0.0.1:8123): airframe load does not request `cockpit.glb`;
  clicking Cockpit loads it and sets `#cockpit`; back button returns to
  Airframe; direct load of `/#cockpit` works; drag changes heading; look
  clamps at the limits; blocked `cockpit.glb` shows the error and Airframe
  still explodes; mobile 375×812 no horizontal scroll; no console errors;
  screenshots desktop + mobile.
- impeccable: `detect` on changed files; screenshots reviewed against the HUD
  direction contract; DESIGN.md updated with the heading tape component.

## File layout (new/changed)
```
blender/build_cockpit.py   blender/compress.sh (cockpit step)
lookaround.js              tests/lookaround.test.mjs
tests/check_cockpit_glb.py public/cockpit.glb
main.js  index.html  style.css  DESIGN.md
```

## Out of scope
Clickable switches, panel labels/tour, night lighting, sound, moving around
the cockpit, first officer's seat.
