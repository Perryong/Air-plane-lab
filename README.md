# Air-plane-lab

An interactive 3D page with three modes:

- **Airframe**: an F-16A that disassembles into ten sections along clean exploded-diagram axes, then reassembles. Orbit, scrub the separation tape, and hover parts for their names.
- **Cockpit** (`#cockpit`): sit in the captain's seat of a Boeing 757-200 flight deck and look around.
- **Fly** (`#fly`): pilot the F-16 through a timed 12-ring course over terrain, with afterburner, vapour trails and speed effects. Best time is saved in your browser.

### Fly controls

| Key | Action |
|---|---|
| W / ↑ | Climb |
| S / ↓ | Dive |
| A D / ← → | Roll (and turn) |
| Space | Start · hold for afterburner |
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
python3 tests/check_cockpit_glb.py public/cockpit.glb
```

## Rebuilding the models

`blender/build_f16.py` and `blender/build_cockpit.py` run inside Blender (via Blender MCP) and export raw GLBs; `blender/compress.sh` compresses them into `public/`.

## Credits and licences

- F-16 model: ["F16A"](https://sketchfab.com/3d-models/f16a-8e318343bf174e8f955707df54cb1fa6) by [amf1re](https://sketchfab.com/amf1re), Sketchfab Standard licence.
- Cockpit model: ["Boeing 757-200 Icelandair Cockpit"](https://sketchfab.com/3d-models/boeing-757-200-icelandair-cockpit-1cb8f8109cb145849282ad703a652859) by [VTX](https://sketchfab.com/VTX), modified, [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). See `public/cockpit.glb.LICENSE.txt`. Non-commercial use only.
- Typeface: B612 (Google Fonts). Three.js from jsDelivr.
- `.claude/skills/impeccable`: [Impeccable](https://github.com/pbakaus/impeccable), Apache 2.0.
