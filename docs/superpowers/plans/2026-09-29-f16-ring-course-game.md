# F-16 Ring Course Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Fly" mode (`#fly`): fly the F-16 through a 12-ring timed course over terrain, with afterburner, vapour trails, speed/camera feel and banking.

**Architecture:** Pure `flight.js` (flight model + course rules, Node-tested) drives a lazy-loaded `fly.js` (Three.js scene, effects, input, HUD glue). `main.js` routes `#fly`, clones the assembled F-16 for the game and delegates rendering.

**Tech Stack:** Three.js 0.170 (CDN import map), vanilla JS/CSS, `node:test`, Playwright MCP.

**Spec:** `docs/superpowers/specs/2026-09-29-f16-ring-course-game-design.md`

## Global Constraints
- World units: y up, nose +X at yaw 0 (matches `public/f16.glb`); 1 u ≈ 1.5 m; jet 10 u long.
- Cruise 70 u/s, burner 130 u/s, speed clamp 40–160; bank max 70°; pitch clamp ±75°.
- 12 rings, radius 14, ≥ 35 u above terrain.
- Controls: W/↑ climb, S/↓ dive, A/← roll left, D/→ roll right, Space hold = afterburner, R restart, P/Esc pause; touch stick + AB button.
- `fly.js` must not load until Fly mode is entered; Airframe/Cockpit unchanged.
- Local asset refs carry `?v=8` (bump from 7).
- Best time: `localStorage["f16-ring-best"]`, every access in try/catch.
- Reduced motion: no camera shake, no speed streaks.

## Review Focus
1. **Leaving Fly mid-flight and returning** → game paused while away, resumes paused (no time accrues in background).
2. **Keys held while switching modes** → no stuck input in the next mode (keys cleared on mode change / blur).
3. **Crash on the very first leg** (no ring passed yet) → respawn at the start position, not NaN/undefined ring.
4. **Tab hidden / huge dt** → `dt` clamped (≤ 0.05) so the jet doesn't tunnel through rings or terrain.
5. **Touch + keyboard together** → inputs sum and clamp to −1…1.

## File Structure
```
flight.js              # pure flight model + course rules
tests/flight.test.mjs  # node:test
fly.js                 # Three.js game scene, effects, input
main.js index.html style.css   # #fly mode, HUD, lazy load
DESIGN.md              # Fly HUD components
```

---

### Task 1: Pure flight model and course (`flight.js`)

**Files:** Create `flight.js`, `tests/flight.test.mjs`

**Interfaces — Produces:**
`CRUISE, BURNER, RING_COUNT, RING_RADIUS`, `forward(yaw, pitch) -> [x,y,z]`,
`stepFlight(state, {pitch, roll, burner}, dt) -> state`, `terrainHeight(x, z) -> number`,
`makeCourse() -> ring[]` (`{x,y,z,yaw,radius}`), `throughRing(prev, next, ring) -> bool` (`prev/next` = `{x,y,z}`),
`hitGround(state) -> bool`, `startState(course) -> state`, `respawnState(course, passed) -> state`,
`newRace() -> race`, `advanceRace(race, prev, next, dt, course) -> race`
(`race = {started, finished, time, next}`), `combineInput(a, b) -> input` (sums, clamps −1…1, ORs burner).

- [ ] **Step 1: Write failing tests**

```js
// tests/flight.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as F from "../flight.js";

const fly = (s, input, secs, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) s = F.stepFlight(s, input, dt); return s; };
const base = () => ({ x: 0, y: 200, z: 0, yaw: 0, pitch: 0, bank: 0, speed: F.CRUISE, burner: 0 });

test("forward: yaw 0 is +X, yaw 90° is -Z, pitch up is +Y", () => {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(F.forward(0, 0), [1, 0, 0]));
  assert.ok(near(F.forward(Math.PI / 2, 0), [0, 0, -1]));
  assert.ok(near(F.forward(0, Math.PI / 2), [0, 1, 0]));
});

test("cruise holds cruise speed; burner converges toward burner speed", () => {
  assert.ok(Math.abs(fly(base(), {}, 5).speed - F.CRUISE) < 1);
  const s = fly(base(), { burner: true }, 8);
  assert.ok(s.speed > 120 && s.speed <= F.BURNER + 1);
  assert.ok(s.burner > 0.9);
});

test("rolling right banks right and turns right (yaw decreases)", () => {
  const s = fly(base(), { roll: 1 }, 2);
  assert.ok(s.bank > 0.9);
  assert.ok(s.yaw < -0.5);
});

test("pitch is clamped to ±75°", () => {
  assert.ok(Math.abs(fly(base(), { pitch: 1 }, 5).pitch - (75 * Math.PI) / 180) < 1e-9);
  assert.ok(Math.abs(fly(base(), { pitch: -1 }, 5).pitch + (75 * Math.PI) / 180) < 1e-9);
});

test("jet moves along its nose", () => {
  const s = fly(base(), {}, 1);
  assert.ok(s.x > 60 && Math.abs(s.z) < 1e-6);
});

test("terrainHeight is deterministic and bounded", () => {
  assert.equal(F.terrainHeight(123, -456), F.terrainHeight(123, -456));
  for (let i = -3000; i <= 3000; i += 97) for (let j = -3000; j <= 3000; j += 89) {
    const h = F.terrainHeight(i, j);
    assert.ok(h <= 60 && h >= -60);
  }
});

test("course: 12 rings, all well above terrain", () => {
  const c = F.makeCourse();
  assert.equal(c.length, F.RING_COUNT);
  for (const r of c) assert.ok(r.y - F.terrainHeight(r.x, r.z) >= 35 && r.radius === F.RING_RADIUS);
});

test("throughRing: centre pass yes; outside radius no; not crossing no; backwards no", () => {
  const ring = { x: 0, y: 100, z: 0, yaw: 0, radius: 14 };
  assert.ok(F.throughRing({ x: -5, y: 100, z: 0 }, { x: 5, y: 100, z: 0 }, ring));
  assert.ok(!F.throughRing({ x: -5, y: 130, z: 0 }, { x: 5, y: 130, z: 0 }, ring));
  assert.ok(!F.throughRing({ x: -9, y: 100, z: 0 }, { x: -2, y: 100, z: 0 }, ring));
  assert.ok(!F.throughRing({ x: 5, y: 100, z: 0 }, { x: -5, y: 100, z: 0 }, ring));
});

test("hitGround below terrain + 2", () => {
  const h = F.terrainHeight(10, 20);
  assert.ok(F.hitGround({ x: 10, y: h + 1, z: 20 }));
  assert.ok(!F.hitGround({ x: 10, y: h + 3, z: 20 }));
});

test("start and first-leg respawn sit behind ring 0 facing it", () => {
  const c = F.makeCourse();
  for (const s of [F.startState(c), F.respawnState(c, 0)]) {
    assert.ok(Number.isFinite(s.x + s.y + s.z + s.yaw));
    assert.equal(s.yaw, c[0].yaw);
  }
  const r = F.respawnState(c, 3);
  assert.equal(r.x, c[2].x); assert.equal(r.yaw, c[2].yaw);
});

test("advanceRace: timer runs only while racing; rings in order; finish freezes time", () => {
  const c = F.makeCourse();
  let race = F.newRace();
  race = F.advanceRace(race, c[0], c[0], 1, c);
  assert.equal(race.time, 0); // not started
  race = { ...race, started: true };
  const through = (r) => { const n = F.forward(r.yaw, 0); return [{ x: r.x - n[0], y: r.y, z: r.z - n[2] }, { x: r.x + n[0], y: r.y, z: r.z + n[2] }]; };
  const [a1, b1] = through(c[1]);
  race = F.advanceRace(race, a1, b1, 0.5, c); // ring 1 before ring 0: must not count
  assert.equal(race.next, 0);
  for (let i = 0; i < c.length; i++) { const [a, b] = through(c[i]); race = F.advanceRace(race, a, b, 0.5, c); }
  assert.ok(race.finished);
  const t = race.time;
  race = F.advanceRace(race, a1, b1, 5, c);
  assert.equal(race.time, t);
});

test("combineInput sums and clamps; burner ORs", () => {
  assert.deepEqual(F.combineInput({ pitch: 1, roll: -0.4 }, { pitch: 0.7, roll: -0.8, burner: true }), { pitch: 1, roll: -1, burner: true });
});
```

- [ ] **Step 2: Run — expect failure** (`node --test tests/*.test.mjs` → cannot find `flight.js`).

- [ ] **Step 3: Implement `flight.js`**

```js
// Pure arcade flight model + ring-course rules; no Three.js so Node can test it.
const deg = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const CRUISE = 70, BURNER = 130, RING_COUNT = 12, RING_RADIUS = 14;
const BANK_MAX = deg(70), PITCH_MAX = deg(75), PITCH_RATE = 1.1, TURN = 1.4;

export const forward = (yaw, pitch) => [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.sin(yaw)];

export function stepFlight(s, { pitch = 0, roll = 0, burner = false } = {}, dt) {
  const ease = (k) => 1 - Math.exp(-dt * k);
  const bank = s.bank + (roll * BANK_MAX - s.bank) * ease(3);
  const p = clamp(s.pitch + pitch * PITCH_RATE * dt, -PITCH_MAX, PITCH_MAX);
  const yaw = s.yaw - TURN * Math.sin(bank) * dt; // right bank turns right
  const b = s.burner + ((burner ? 1 : 0) - s.burner) * ease(4);
  const target = CRUISE + (BURNER - CRUISE) * b;
  const speed = clamp(s.speed + (target - s.speed) * ease(0.8) - 4.9 * Math.sin(p) * dt, 40, 160);
  const [fx, fy, fz] = forward(yaw, p);
  return { x: s.x + fx * speed * dt, y: s.y + fy * speed * dt, z: s.z + fz * speed * dt, yaw, pitch: p, bank, speed, burner: b };
}

export const terrainHeight = (x, z) =>
  28 * Math.sin(x * 0.004) * Math.cos(z * 0.005) +
  16 * Math.sin(x * 0.011 + 1.3) * Math.sin(z * 0.009) +
  8 * Math.sin((x + z) * 0.021);

export function makeCourse() {
  const R = 900, pts = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const a = (i / RING_COUNT) * Math.PI * 2;
    const r = R * (1 + 0.18 * Math.sin(2 * a));
    const x = r * Math.cos(a), z = -r * Math.sin(a);
    pts.push({ x, z, y: Math.max(terrainHeight(x, z), 0) + 45 + 20 * Math.sin(3 * a) });
  }
  return pts.map((p, i) => {
    const prev = pts[(i + RING_COUNT - 1) % RING_COUNT], next = pts[(i + 1) % RING_COUNT];
    return { ...p, yaw: Math.atan2(-(next.z - prev.z), next.x - prev.x), radius: RING_RADIUS };
  });
}

export function throughRing(a, b, ring) {
  const [nx, , nz] = forward(ring.yaw, 0);
  const d0 = (a.x - ring.x) * nx + (a.z - ring.z) * nz;
  const d1 = (b.x - ring.x) * nx + (b.z - ring.z) * nz;
  if (!(d0 < 0 && d1 >= 0)) return false; // must cross the plane front-wards
  const t = d0 / (d0 - d1);
  const px = a.x + (b.x - a.x) * t - ring.x, py = a.y + (b.y - a.y) * t - ring.y, pz = a.z + (b.z - a.z) * t - ring.z;
  return Math.hypot(px, py, pz) <= ring.radius;
}

export const hitGround = (s) => s.y < terrainHeight(s.x, s.z) + 2;

const at = (r, back) => { const [fx, , fz] = forward(r.yaw, 0); return { x: r.x - fx * back, y: r.y, z: r.z - fz * back, yaw: r.yaw, pitch: 0, bank: 0, speed: CRUISE, burner: 0 }; };
export const startState = (course) => at(course[0], 250);
export const respawnState = (course, passed) => (passed > 0 ? at(course[passed - 1], 0) : startState(course));

export const newRace = () => ({ started: false, finished: false, time: 0, next: 0 });
export function advanceRace(race, a, b, dt, course) {
  if (!race.started || race.finished) return race;
  let next = race.next;
  if (throughRing(a, b, course[next])) next++;
  return { ...race, time: race.time + dt, next, finished: next >= course.length };
}

export const combineInput = (a = {}, b = {}) => ({
  pitch: clamp((a.pitch || 0) + (b.pitch || 0), -1, 1),
  roll: clamp((a.roll || 0) + (b.roll || 0), -1, 1),
  burner: !!(a.burner || b.burner),
});
```

- [ ] **Step 4: Run — expect pass** (18 existing + 12 new = 30).
- [ ] **Step 5: Commit** `feat: pure flight model and ring course`.

---

### Task 2: Game scene and effects (`fly.js`)

**Files:** Create `fly.js`

**Interfaces:**
- Consumes: Task 1 exports; from main: `renderer`, the F-16 root (`gltf.scene`, parts at rest), `env` texture, `reduced` flag, `onHud(state)` callback.
- Produces: `export function createFly({ renderer, f16, env, reduced, onHud })` → `{ frame(dt), resize(aspect), start(), restart(), setPaused(bool), clearInput(), setTouch(input), debug }` where `debug = { get jet(), get race(), get course(), setJet(state), get flame() , get trailOpacity(), get camera() }`.

Contents (authored during execution; verified by Task 4 Playwright):
- Scene: `Fog` (dusk sky colour), `HemisphereLight` + warm `DirectionalLight` sun; background transparent so the page sky shows.
- Terrain: `PlaneGeometry(6000, 6000, 240, 240)` rotated flat, vertex y from `terrainHeight`, vertex colours ramp (valley teal-grey → ridge sand) with flat shading off; a low water plane at y = −4.
- Clouds: ~70 soft radial-gradient `Sprite`s (one `CanvasTexture`) scattered at 120–260 u altitude.
- Rings: `TorusGeometry(14, 0.9, 12, 48)` `MeshBasicMaterial` HUD green; next ring opacity 1 and gently pulsing scale, upcoming 0.35, passed hidden; one visual state per ring.
- Jet: `f16.clone(true)` (parts share geometry/material), wrapped in a `Group`; rotation order `YZX`: `rotation.set(0, yaw, 0)` on an outer group, pitch on a middle group (z), bank on the model (x, negative for right bank). Scale 1.
- Afterburner at the nozzle (local −X tip from the model bounds): outer cone (`ConeGeometry` pointing −X, additive, orange → transparent via vertex alpha), inner white-blue core, `PointLight` orange; length = 2 + 6·burner + 1.5·flicker; opacity 0.35 + 0.65·burner.
- Wingtip trails: two 48-point `Line` strips with per-vertex alpha fading tail → head, sampled from wingtip world positions each frame; opacity target = clamp((|pitchInput| + |bankRate|·0.6) · (speed − 60)/60, 0, 1), eased.
- Chase camera: target = jet position − forward·26 + up·7; critically damped follow (ease 5/s), looks 30 u ahead; FOV = 60 + 18·(speed − 70)/60 clamped 60–78; shake = 0.25·burner (0 if reduced).
- Speed streaks: 120 `LineSegments` around the camera, recycled in front, stretched along velocity; opacity ∝ (speed − 100)/40; hidden if reduced.
- Input: keydown/keyup map (Global Constraints), `blur` clears keys; `clearInput()` clears keys + touch; keyboard + touch merged with `combineInput`.
- Loop `frame(dt)`: `dt = min(dt, 0.05)`; if not paused and started: step flight, `advanceRace`, crash → flash + `respawnState(course, race.next)`; update effects; `onHud({ speed, alt, next, total, time, best, started, finished, crashed })`; render.
- Finish: store best (try/catch localStorage), `onHud` reports `finished`.

- [ ] Steps: write `fly.js`; `node --check fly.js`; commit `feat: F-16 ring course scene and flight effects`.

---

### Task 3: Fly mode wiring + HUD (`main.js`, `index.html`, `style.css`)

**Files:** Modify `main.js`, `index.html`, `style.css`

- `index.html`: nav link `<a href="#fly" data-mode="fly">Fly</a>`; Fly HUD block `#flyhud` with `#spd`, `#alt`, `#ring`, `#ftime`, `#fbest`, burner tape `#burner`, overlays `#flystart` ("Press Space or tap to fly" + control legend), `#flyend` (time, best, "Fly again" button), `#flycrash` flash; touch controls `#stick` (knob) and `#ab` button (shown on coarse pointers); asset refs `?v=8`.
- `style.css`: per-mode visibility for `mode-fly` (hide tape, toggle, readout, heading, hint, lock, status lines; show `#flyhud`), readouts in B612 Mono, overlays as HUD symbology (no panels), touch controls as 1px bracket circles.
- `main.js`: `modeFromHash` → `"fly"` for `#fly`; `TITLES.fly = ["F-16A", "Ring course"]`; body class `mode-fly`; on first Fly entry `await ready` then `import("./fly.js?v=8")` → `createFly({...})` with `f16 = gltf.scene` of the airframe (cloned inside); render loop delegates `fly.frame(dt)` in Fly mode; mode change calls `fly.setPaused(true)` + `fly.clearInput()` when leaving; `onHud` writes the readouts; `window.__viewer.fly` getter.
- Airframe root reference: keep `airframeRoot = gltf.scene` in the airframe `.then` so Fly can clone it at rest (reset part positions to rest before cloning: clone then copy `userData.rest` into each clone part's position).

- [ ] Steps: implement; smoke run `#fly` in Playwright; `impeccable detect`; commit `feat: Fly mode — F-16 ring course game`.

---

### Task 4: Verification + docs

- Playwright (`127.0.0.1:8123`, cache disabled): `fly.js` not requested on `/`; `#fly` loads it; Space starts; hold ← 1 s → bank < −0.5 and yaw increased; hold Space 3 s → speed > 100 and flame length grew; `debug.setJet` at each ring's approach and fly forward → finish overlay, time > 0, best stored; `setJet` below terrain → crash, respawn at start (Review Focus 3); switch to Airframe mid-flight, wait 2 s, return → time unchanged and paused (Focus 1); hold D, switch mode, return → no roll input (Focus 2); touch stick drag → bank changes; mobile 375×812 no h-scroll, controls visible; reduced motion → no streaks, no shake; Airframe explode + Cockpit look regression; zero console errors; screenshots `fly-desktop.png`, `fly-burner.png`, `fly-mobile.png`.
- DESIGN.md: Fly HUD readouts, burner tape, overlays, touch stick; README: Fly mode + controls.
- Commit `docs: Fly mode in DESIGN.md and README`; final reviewer; fix pass; merge to main locally. Do NOT push: pushing redeploys the public GitHub Pages site, so ask the user first.
