# F-16 Exploded-View Viewer — Design (Phase 1)

## Intent
Showcase/portfolio-grade interactive web page for the Sketchfab F-16A
(https://sketchfab.com/3d-models/f16a-8e318343bf174e8f955707df54cb1fa6).
The plane smoothly disassembles into its major parts and reassembles.
Cinematic, minimal UI.

## Success criteria
- Page loads the F-16, shows it assembled, animates to exploded and back.
- Visual quality passes an impeccable design pass (critique + polish).
- Playwright run: loads with zero console errors, parts measurably move when
  exploded and return to origin when assembled, screenshots at desktop
  (1440x900) and mobile (375x812) look correct.
- Runs as a static folder (any static server); no build step.

## Tools
- **Blender MCP** (Blender 5.2.1, Sketchfab logged in) — import, split, export.
- **impeccable** (skill; installed for this project) — UI design + polish.
- **Playwright MCP** — browser verification.

## Pipeline

### 1. Blender: model → parts → GLB
1. Download model via `download_sketchfab_model` (uid `8e318343bf174e8f955707df54cb1fa6`).
   Record license + author; if CC-BY, credit on the page.
2. Normalise: apply transforms, nose points +X, up +Z (Blender), longest
   dimension ≈ 10 units, centred at origin.
3. Inspect existing objects/materials. Group into ~8–10 named parts:
   `fuselage`, `nose_cone`, `canopy`, `wing_L`, `wing_R`, `tail_fin`,
   `stabilizer_L`, `stabilizer_R`, `engine_nozzle`, `stores` (missiles/tanks).
   Use existing mesh/material separation; fall back to plane-bisect only if a
   major part is fused into one mesh. Parts not in the list merge into `fuselage`.
4. Each part: origin at its own bounds centre; custom property
   `explode_dir` (unit vector away from fuselage centre, biased outward/up)
   and `explode_dist`, plus `order` (stagger index) and `label` (display name).
5. Export `public/f16.glb` (glTF binary, custom props as extras, textures
   embedded, Y-up). Verify with viewport screenshot before/after a scripted
   test explode.

### 2. Web viewer (`index.html`, `main.js`, `style.css`)
- Three.js (+ GLTFLoader, OrbitControls) via import map from cdn.jsdelivr.net.
- Load GLB; for each part mesh read `userData` extras; store rest position.
- State `t ∈ [0,1]`: part position = rest + dir · dist · ease(stagger(t, order)).
- Controls: Assemble/Disassemble toggle (animates t, ~1.8s, staggered),
  explode slider (scrub t), orbit/zoom. Idle slow auto-rotate; stops on
  interaction.
- Hover → part label tooltip (raycast). Dark "hangar" look, soft studio
  lighting + environment, subtle ground shadow.
- Header reserves a mode switch slot for phase 2 (only F-16 mode active now).
- Loading state while GLB downloads; error message if it fails.
- Credit line for the model author.
- Exposes `window.__viewer = { setT, parts }` for Playwright checks.

### 3. impeccable
Run its design guidance while building the UI, then its critique/polish
commands on the finished page; apply fixes.

### 4. Playwright verification
Serve with `python3 -m http.server` on `public/`'s parent. Check: no console
errors; after Disassemble every part's world position differs from rest by
> 0.5·dist; after Assemble all back within 1e-3; screenshots assembled,
exploded, mobile.

## File layout
```
plane-labs/
  blender/build_f16.py      # the Blender script run via MCP (reproducible)
  public/f16.glb
  index.html  main.js  style.css
  docs/superpowers/specs/…
```

## Out of scope (phase 1)
Drag-to-reassemble gameplay, per-part descriptions, sound, rendered video.

## Future: phase 2 — 757 cockpit mode
Separate scene from
https://sketchfab.com/3d-models/boeing-757-200-icelandair-cockpit-1cb8f8109cb145849282ad703a652859
(interior only, different aircraft). Seated first-person look-around in a
second mode behind the header switch. Gets its own design after phase 1.
