# Air-plane-lab

An interactive 3D page with three modes and three aircraft:

- **Airframe**: an F-16A (10 sections), a Cessna 172SP (12 sections: wing, struts, doors, cabin interior, gear, propeller…) or a Boeing 777 (11 sections: wings, flaps & slats, Trent 800 engines, gear, fin, stabilisers) that disassembles along clean exploded-diagram axes, then reassembles. Switch aircraft with **F-16A · C172 · 777** under the title (`#airframe/c172`, `#airframe/b777`). Orbit, scrub the separation tape, and hover parts for their names.
- **Cockpit** (`#cockpit`): sit in the captain's seat of a Boeing 757-200 flight deck and look around.
- **Fly** (`#fly`, `#fly/c172`, `#fly/b777`): pilot the F-16 (afterburner, vapour trails, speed effects), the Cessna (spinning propeller, moving elevator, gentler handling, smaller course) or the 777 (spinning engine fans, moving elevator, heavy handling, big rings; shown at 2× the F-16's size so it fits the rings) through a timed 12-ring course over terrain. Best time is saved per aircraft in your browser.

### Fly controls

| Key | Action |
|---|---|
| W / ↑ | Climb |
| S / ↓ | Dive |
| A D / ← → | Roll (and turn) |
| Space | Start · hold for afterburner (F-16), full throttle (C172) or take-off thrust (777) |
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
python3 tests/check_glb.py public/b777.glb b777
python3 tests/check_cockpit_glb.py public/cockpit.glb
```

## Rebuilding the models

`blender/build_f16.py`, `blender/build_cessna.py`, `blender/build_b777.py` and `blender/build_cockpit.py` run inside Blender (via Blender MCP) and export raw GLBs; `blender/compress.sh` compresses them into `public/`.

## Credits and licences

- F-16 model: ["F16A"](https://sketchfab.com/3d-models/f16a-8e318343bf174e8f955707df54cb1fa6) by [amf1re](https://sketchfab.com/amf1re), Sketchfab Standard licence.
- Cessna model: ["FREE Cessna 172SP"](https://sketchfab.com/3d-models/free-cessna-172sp-c9cadc2f026946da8cf9715a683739e9) by [NLM](https://sketchfab.com/NLM-Group), modified (split into parts, recompressed), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Boeing 777 model: ["boeing 777 aeroflot"](https://sketchfab.com/3d-models/boeing-777-aeroflot-32c3ca1705bc4c05b5ea3b9052241491) by [mamont nikita](https://sketchfab.com/mamontnikita62), modified (split into parts, recompressed), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Cockpit model: ["Boeing 757-200 Icelandair Cockpit"](https://sketchfab.com/3d-models/boeing-757-200-icelandair-cockpit-1cb8f8109cb145849282ad703a652859) by [VTX](https://sketchfab.com/VTX), modified, [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See `public/cockpit.glb.LICENSE.txt`. Non-commercial use only.
- Typeface: B612 (Google Fonts). Three.js from jsDelivr.
- `.claude/skills/impeccable`: [Impeccable](https://github.com/pbakaus/impeccable), Apache 2.0.
