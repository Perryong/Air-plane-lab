# Boeing 777 — third aircraft (Phase 5)

Approved by the user 2026-09-29 ("proceed"), same flow as the Cessna.

**Model:** "boeing 777 aeroflot" by mamont nikita — uid `32c3ca1705bc4c05b5ea3b9052241491`,
CC BY 4.0 (commercial use allowed, credit required). SketchUp export: 225 meshes,
colour materials only (no textures), real scale (64.8 m span), nose −Y.

## Parts (11; Blender axes after orienting: +X nose, +Y left, +Z up)
| part | source | dir | dist |
|---|---|---|---|
| fuselage | `Layer0` body, windows, wing box `Group_031`, remaining bits | anchor | 0 |
| wing_L / wing_R | `Group_029` / `Component#81` | ±Y | 3.2 |
| flaps_L / flaps_R | `Component#47,49,50,52,53,55–59` by side | +Z | 1.8 |
| engine_L / engine_R | Trent 800 nacelles + pylons (child `fan_L` / `fan_R`: 24 blades + hub) | −Z | 2.2 |
| nose_gear | y < −28 m, z < 3.5 m | −Z | 2.2 |
| main_gear | bogies/legs, 1.5 < abs(x) < 7 m | −Z | 2.2 |
| tail_fin | `Component#2` | +Z | 2.4 |
| stabilizers | `Component#71` (child `elevator` = `Group_032`) | −X | 2.2 |

## Page
- Switch becomes F-16A · C172 · 777; routes `#airframe/b777`, `#fly/b777`; `public/b777.glb` (242 KB) lazy.
- Fly profile `b777`: cruise 55, max (TO/GA thrust) 72, turn 0.55, pitch rate 0.5, bank 30°.
  Model scale 2 (not real 4.9 — must fit rings); course ×1.4, rings ×2.5; camera 55 back, 15 up.
- Fly effects (`kind: "airliner"`): both fans spin with thrust (18 + 40·thrust rad/s), elevator
  deflects ±20°, trails ×0.5, no flame. Best time key `b777-ring-best`.
- Credit: "boeing 777 aeroflot" by mamont nikita, modified · CC BY 4.0.

## Testing
`check_glb.py public/b777.glb b777`; flight tests for the 777 profile and scaled course;
Playwright: switch/routes, 777 explode + assemble, 777 lap, fans spin, elevator deflects,
F-16/C172/cockpit regression, zero console errors.

## Out of scope
Aileron/spoiler animation, cabin interior, sound, textured livery (source has none).
