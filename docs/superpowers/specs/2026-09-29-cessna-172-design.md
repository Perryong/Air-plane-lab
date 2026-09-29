# Cessna 172SP — second aircraft (Phase 4)

## Intent
Add a second aircraft, the Cessna 172SP, to the Airframe (exploded view) and
Fly (ring course) modes, chosen with an **F-16A · C172** switch. Approved by
the user 2026-09-29, with permission to continue through plan and build.

Model: "FREE Cessna 172SP" by NLM — uid `c9cadc2f026946da8cf9715a683739e9`,
**CC BY 4.0** (commercial use allowed, credit required):
"This work is based on "FREE Cessna 172SP" by NLM licensed under CC-BY-4.0".

## Source model facts (inspected in Blender)
69 meshes under named parent empties; nose −Y, up +Z, span 3.69 model units.
Ground props (concrete chocks `Cube.010`, remove-before-flight tags
`Plane.030`, `Circle.002`, tie-down `Circle.005`) are dropped. The elevator
(`Plane.010`) is its own mesh; ailerons/flaps are one mesh across both wings
and the rudder is fused into the fin, so only the **elevator** and the
**propeller** can move in Fly.

## Parts (12, one axis each; Blender axes after normalising: +X nose, +Y left, +Z up)
| part | source parents | dir | dist |
|---|---|---|---|
| fuselage | body shell, inner shell, tail cone, small fittings | anchor | 0 |
| wing | `Plane.005`, `.020`, `.021`, `.022`, `.029` | +Z | 3.0 |
| struts | `Circle.004`, `Plane.031` | +Z | 1.6 |
| propeller | `Plane_16`, `Plane.011` | +X | 3.0 |
| cowling | `Plane.006` | +X | 1.6 |
| windows | `Plane.016` | +Z | 1.6 |
| door_L / door_R | `Plane.013` / `Plane.014` | ±Y | 2.5 |
| interior | seats, panel, yokes, floor | −Z | 2.5 |
| main_gear | `Cube.002`, `Cube.001`, `Circle_6` | −Z | 2.0 |
| nose_gear | `Cube.003`, `Cube.009`, `Plane.007`, `Plane.017` | −Z | 2.0 |
| tail | `Plane.004`, `Plane.009`, `Plane.003` + child node `elevator` (`Plane.010`) | −X | 3.0 |

Final grouping is confirmed from a coloured explode preview in Blender.
Normalised like the F-16 (longest side 10 units) for the viewer; Fly scales it
by 0.73 so relative size matches reality (span 11 m vs F-16 length 15 m).

## Page changes
- Hash routes: `#airframe`, `#airframe/c172`, `#fly`, `#fly/c172`; anything
  else keeps today's behaviour. `#cockpit` unchanged.
- Aircraft switch (F-16A · C172) under the title in Airframe and Fly modes;
  title, subtitle, credit, sections count follow the aircraft.
- `public/cessna.glb` loads only when C172 is first chosen; the airframe
  viewer reuses the existing explode code (GLB extras contract unchanged).
- Fly: `flight.js` gains aircraft profiles; `stepFlight(state, input, dt, profile)`
  (default F-16 profile keeps all existing tests valid). C172: cruise 32 u/s,
  full throttle 44 u/s (Space), turn 1.0, pitch rate 0.8, bank max 45°;
  course scaled ×0.5 (`makeCourse(scale)`); ring radius scaled ×0.7.
- Fly effects per aircraft: F-16 keeps afterburner; C172 gets a propeller that
  spins with throttle plus a translucent prop disc, an elevator that deflects
  with pitch input, lighter vapour trails, camera 16 u behind.
- Best times stored per aircraft (`f16-ring-best`, `c172-ring-best`).

## Testing
- `tests/check_glb.py <file> [f16|c172]` validates each aircraft's parts.
- `tests/flight.test.mjs`: C172 profile cruise/throttle speeds, gentler turn,
  bank limit; `makeCourse(0.5)` rings above terrain with scaled radius;
  default profile unchanged.
- Playwright: switch + routes; C172 explode/reassemble; C172 lap via test hook
  with its own best key; prop spins faster at full throttle; elevator deflects;
  F-16 airframe, cockpit, F-16 fly regression; mobile; zero console errors.

## Out of scope
Cessna cockpit view, ailerons/rudder animation (fused meshes), engine sound,
door-opening animation (the model ships one; not used).
