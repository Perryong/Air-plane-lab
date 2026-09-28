# F-16 Ring Course Game — Design (Phase 3)

## Intent
A third mode, **Fly** (`#fly`), on the existing site: pilot the same F-16A
(`public/f16.glb`, assembled) through a timed course of rings over generated
terrain, with convincing flight effects. Same HUD visual world (`DESIGN.md`).

## Decisions (confirmed with user, 2026-09-29)
- Genre: **ring course** — fly through 12 rings in order; beat your best time.
- Effects (all four): **afterburner + exhaust**, **wingtip vapour trails**,
  **speed & camera feel**, **banking & visible attitude** with scenery rushing past.
- Controls: **keyboard + on-screen touch**.
- Placement: **third mode** on the same page, header link "Fly".
- User pre-authorised proceeding from spec → plan → implementation without
  further approval stops.

## Success criteria
- `#fly` loads the game; Airframe and Cockpit behave exactly as before (all
  phase-1/2 checks still pass); `fly.js` loads only when Fly is first chosen.
- A player can start, steer through all 12 rings, and see a finish time; best
  time persists per browser (localStorage, failure-tolerant).
- Hitting terrain resets the jet at the last ring passed (timer keeps running).
- Visible effects: flame/glow scaling with throttle and afterburner; wingtip
  trails when pulling hard; chase camera lag, FOV widening and light shake at
  speed; speed streaks; the jet banks and pitches with input.
- Keyboard and touch both complete the course. Reduced motion: no shake, no
  speed streaks, trails/flame kept (they are information, not decoration).
- 60 fps target on a laptop; zero console errors; 1440×900 and 375×812.

## Architecture
- **`flight.js` (pure, Node-tested)** — arcade flight model and course rules,
  no Three.js:
  - State `{x, y, z, yaw, pitch, bank, speed, burner}` in world units (y up;
    1 unit ≈ 1.5 m; the model is 10 units long). Heading/pitch/bank angles, not
    quaternions: pitch clamped to ±75° (arcade, no loops) so there is no gimbal
    lock and the math stays testable.
  - `stepFlight(state, input, dt)`: `input = {pitch, roll, burner}` in −1…1 /
    bool. Bank chases `roll × 70°`; pitch rate 1.1 rad/s; turn rate from bank
    (`yawRate = 1.4·sin(bank)`), speed eases to 70 u/s cruise or 130 u/s with
    burner, climbing costs a little speed. Returns a new state.
  - `forward(yaw, pitch)` unit vector (nose +X at yaw 0, matching the GLB).
  - `terrainHeight(x, z)`: deterministic sum of sines (hills ≤ 60 u, valleys to
    −10), used by both the terrain mesh and collision.
  - `makeCourse()`: 12 rings along a deterministic loop; each ring
    `{x, y, z, yaw, radius: 14}` at ≥ 35 u above terrain.
  - `throughRing(prev, next, ring)`: the segment prev→next crosses the ring's
    plane within its radius.
  - `hitGround(state)`: `y < terrainHeight(x, z) + 2`.
  - `advanceRace(race, prev, next, dt)`: timer, next-ring index, finished flag.
- **`fly.js` (browser)** — lazy-loaded module exporting
  `createFly({ renderer, f16, env })` → `{ frame(dt), resize(aspect), start(), reset(), state }`:
  - Own `Scene`: sky fog, sun + hemisphere light, terrain mesh from
    `terrainHeight` (vertex-coloured by height), scattered soft cloud sprites,
    ring tori (HUD green emissive; next ring bright, others dim, passed hidden).
  - Jet: a `clone()` of the airframe's assembled F-16 root, rotation order
    `YZX` from yaw/pitch/bank.
  - Effects: afterburner (additive cone + inner core + orange point light,
    flicker, length ∝ throttle/burner) at the nozzle; wingtip vapour ribbons
    (2 × 48-point fading line strips, opacity ∝ pull = |pitch input| + |bank rate|,
    only above 60 u/s); chase camera (critically damped follow behind/above,
    FOV 60 → 78 with speed, shake ∝ burner, off under reduced motion); speed
    streaks (instanced line segments around the camera, visible > 100 u/s,
    off under reduced motion).
  - Input: keyboard (W/↑ climb, S/↓ dive, A/← roll left, D/→ roll right,
    Space hold = afterburner, R restart, P/Esc pause); touch: left virtual stick
    (pitch/roll), right "AB" hold button, tap to start.
- **`main.js`** — third mode: `#fly` routing, header link, title
  "F-16A · Ring course", dynamic `import("./fly.js?v=N")` on first entry,
  hands it the assembled F-16 once `ready` resolves; render loop delegates
  to `fly.frame(dt)` in Fly mode; OrbitControls and airframe/cockpit input
  inactive in Fly. `window.__viewer.fly` exposes the game for Playwright.
- **HUD (Fly mode)**, inherited world: speed (`SPD`), altitude (`ALT`), ring
  `03/12`, timer, best; burner caret on a throttle tape at the left; start
  overlay "Press Space or tap to fly", finish overlay with time/best and
  "Fly again", brief "Terrain — back to ring N" flash on crash.

## Testing
- `tests/flight.test.mjs` (node:test): cruise/burner speed convergence; bank
  produces a turn; pitch clamp; `terrainHeight` determinism and range; course
  has 12 rings all ≥ 35 u above terrain; `throughRing` true through centre,
  false outside radius and false when not crossing; `hitGround`; `advanceRace`
  ordering (can't skip rings), finish time, timer frozen after finish.
- Playwright: Fly loads lazily; start with Space; holding ← banks left and
  heading changes; holding Space raises speed and flame length; a test hook
  flies the jet through each ring → finish overlay with time and stored best;
  forcing low altitude → crash reset to last ring; touch stick moves the jet;
  mobile layout; reduced motion disables shake/streaks; Airframe + Cockpit
  regression; no console errors.

## Out of scope
Weapons, enemies, sound, multiple courses, leaderboards, landing/take-off,
heat-shimmer post-processing (needs a render pass; flame glow stands in),
moving control surfaces (the model's surfaces are fused into the wing meshes).
