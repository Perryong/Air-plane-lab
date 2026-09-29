# Air-plane-lab

An interactive 3D page with three modes:

- **Airframe**: an F-16A (10 sections) or a Cessna 172SP (12 sections: wing, struts, doors, cabin interior, gear, propeller…) that disassembles along clean exploded-diagram axes, then reassembles. Switch aircraft with **F-16A · C172** under the title (`#airframe/c172`). Orbit, scrub the separation tape, and hover parts for their names.
- **Cockpit** (`#cockpit`): sit in the captain's seat of a Boeing 757-200 flight deck and look around.
- **Fly** (`#fly`, `#fly/c172`): pilot the F-16 (afterburner, vapour trails, speed effects) or the Cessna (spinning propeller, moving elevator, gentler handling, smaller course) through a timed 12-ring course over terrain. Best time is saved per aircraft in your browser.

### Fly controls

| Key | Action |
|---|---|
| W / ↑ | Climb |
| S / ↓ | Dive |
| A D / ← → | Roll (and turn) |
| Space | Start · hold for afterburner (F-16) or full throttle (C172) |
| P / Esc | Pause |
| R | Restart |

On phones: left stick to steer, AB button for afterburner.

## Run locally

No build step. From the repo root:

```bash
python3 -m http.server 8123 --bind 127.0.0.1
```

Open http://127.0.0.1:8123/ (Airframe) or http://127.0.0.1:8123/#cockpit.

## Tests

```bash
node --test tests/*.test.mjs
python3 tests/check_glb.py public/f16.glb
python3 tests/check_glb.py public/cessna.glb c172
python3 tests/check_cockpit_glb.py public/cockpit.glb
```

## Rebuilding the models

`blender/build_f16.py`, `blender/build_cessna.py` and `blender/build_cockpit.py` run inside Blender (via Blender MCP) and export raw GLBs; `blender/compress.sh` compresses them into `public/`.

## Credits and licences

- F-16 model: ["F16A"](https://sketchfab.com/3d-models/f16a-8e318343bf174e8f955707df54cb1fa6) by [amf1re](https://sketchfab.com/amf1re), Sketchfab Standard licence.
- Cessna model: ["FREE Cessna 172SP"](https://sketchfab.com/3d-models/free-cessna-172sp-c9cadc2f026946da8cf9715a683739e9) by [NLM](https://sketchfab.com/NLM-Group), modified (split into parts, recompressed), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Cockpit model: ["Boeing 757-200 Icelandair Cockpit"](https://sketchfab.com/3d-models/boeing-757-200-icelandair-cockpit-1cb8f8109cb145849282ad703a652859) by [VTX](https://sketchfab.com/VTX), modified, [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See `public/cockpit.glb.LICENSE.txt`. Non-commercial use only.
- Typeface: B612 (Google Fonts). Three.js from jsDelivr.
- `.claude/skills/impeccable`: [Impeccable](https://github.com/pbakaus/impeccable), Apache 2.0.
