# F-16 Exploded-View Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web page that shows the Sketchfab F-16A and animates it between assembled and exploded states.

**Architecture:** Blender (driven through Blender MCP `execute_blender_code`) imports the Sketchfab model, groups it into ~10 named parts carrying explode metadata as custom properties, and exports `public/f16.glb`. A no-build Three.js page loads the GLB and moves each part along its stored direction by a pure, unit-tested function of a single scalar `t`. impeccable drives the UI design; Playwright MCP verifies behaviour in a real browser.

**Tech Stack:** Blender 5.2.1 + Blender MCP, glTF 2.0 binary, Three.js (import map from cdn.jsdelivr.net), vanilla JS/CSS, Node `node:test` for pure logic, Python stdlib for GLB checks, Playwright MCP.

**Spec:** `docs/superpowers/specs/2026-09-28-f16-explode-viewer-design.md`

## Global Constraints

- Model: Sketchfab uid `8e318343bf174e8f955707df54cb1fa6`; credit author on page if license requires attribution.
- Normalised model: nose +X, up +Z in Blender (exported Y-up), longest dimension ≈ 10 units, centred at origin.
- Part names: `fuselage`, `nose_cone`, `canopy`, `wing_L`, `wing_R`, `tail_fin`, `stabilizer_L`, `stabilizer_R`, `engine_nozzle`, `stores`. Unlisted geometry merges into `fuselage`.
- Per-part custom props (→ glTF extras → Three `userData`): `explode_dir` [x,y,z] unit, `explode_dist` float, `order` int, `label` string.
- Output: `public/f16.glb`, textures embedded.
- No build step; serve repo root with `python3 -m http.server 8000`.
- Explode animation full sweep ≈ 1.8 s.
- `window.__viewer = { setT, parts }` exposed for Playwright.
- Header reserves a mode-switch slot (phase 2 cockpit); only F-16 mode active.
- Playwright pass: zero console errors; exploded parts moved > 0.5·dist; assembled parts within 1e-3 of rest; screenshots at 1440x900 and 375x812.

## Review Focus

1. **Toggle pressed again mid-animation** → animation reverses smoothly from current `t`, no jump. (Task 2 test `retarget mid-flight`.)
2. **Slider dragged while animating** → slider wins, animation stops at dragged `t`. (Task 2 test `scrub overrides animation`.)
3. **GLB fails to load (404/offline)** → visible error message, no uncaught exception. (Task 4 Playwright check with GLB route blocked.)
4. **Phone viewport / resize** → canvas fills viewport, controls reachable, no horizontal scroll. (Task 4 mobile screenshot + `scrollWidth` check.)
5. **`prefers-reduced-motion`** → no idle auto-rotate; toggle jumps to end state. (Task 2 test on `stepT` with `reduced`; Task 4 emulated media check.)

## File Structure

```
plane-labs/
  blender/build_f16.py     # Blender script: import → normalise → group → props → export
  tests/check_glb.py       # stdlib GLB validator (part names + extras)
  explode.js               # pure math: stagger, easing, offsets, stepT (no Three.js)
  tests/explode.test.mjs   # node:test for explode.js
  main.js                  # Three.js scene, loading, input, render loop
  index.html  style.css    # page shell + UI (impeccable)
  public/f16.glb           # generated
```

---

### Task 1: Blender pipeline → `public/f16.glb`

**Files:**
- Create: `blender/build_f16.py`, `tests/check_glb.py`
- Create (generated): `public/f16.glb`

**Interfaces:**
- Produces: `public/f16.glb` whose top-level nodes are exactly the 10 part names, each with `extras` `{explode_dir:[3 floats], explode_dist:float, order:int, label:str}`.

- [ ] **Step 1: Write the failing GLB check**

```python
# tests/check_glb.py — usage: python3 tests/check_glb.py public/f16.glb
import json, struct, sys, math

PARTS = {"fuselage","nose_cone","canopy","wing_L","wing_R","tail_fin",
         "stabilizer_L","stabilizer_R","engine_nozzle","stores"}

def load(path):
    b = open(path, "rb").read()
    magic, _, _ = struct.unpack_from("<4sII", b, 0)
    assert magic == b"glTF", "not a GLB"
    n, kind = struct.unpack_from("<I4s", b, 12)
    assert kind == b"JSON"
    return json.loads(b[20:20+n])

def check(g):
    scene = g["scenes"][g.get("scene", 0)]
    nodes = {g["nodes"][i]["name"]: g["nodes"][i] for i in scene["nodes"]}
    assert set(nodes) == PARTS, f"parts mismatch: {sorted(set(nodes) ^ PARTS)}"
    orders = []
    for name, nd in nodes.items():
        ex = nd.get("extras", {})
        d = ex["explode_dir"]
        assert len(d) == 3 and abs(math.hypot(*d) - 1) < 1e-3, f"{name} dir not unit"
        assert ex["explode_dist"] > 0, name
        assert ex["label"], name
        orders.append(ex["order"])
    assert sorted(orders) == list(range(len(PARTS))), "order must be 0..n-1"
    assert g.get("images"), "textures not embedded"

if __name__ == "__main__":
    check(load(sys.argv[1])); print("GLB OK")
```

- [ ] **Step 2: Run it — expect failure (file missing)**

Run: `python3 tests/check_glb.py public/f16.glb`
Expected: `FileNotFoundError`.

- [ ] **Step 3: Download and inspect the model**

Call `mcp__blender__get_scene_info`; if the default cube/camera/light exist, delete them. Call `mcp__blender__download_sketchfab_model(uid="8e318343bf174e8f955707df54cb1fa6", target_size=10)`. Record the license/author it returns. Then run via `execute_blender_code`:

```python
import bpy
for o in bpy.context.scene.objects:
    if o.type == "MESH":
        print(o.name, [s.material.name if s.material else None for s in o.material_slots],
              tuple(round(v,2) for v in o.dimensions), len(o.data.polygons))
```

Take `get_viewport_screenshot`. Note which axis the nose points along.

- [ ] **Step 4: Write `blender/build_f16.py`**

`PART_MAP` is filled from Step 3's printout: each key is a part name, each value a list of substrings matched against object **or** material names. The rest of the script is fixed:

```python
import bpy, bmesh, math
from mathutils import Vector

NOSE_AXIS_ROT_Z = 0.0          # radians; set from Step 3 so nose ends on +X
PART_MAP = {                   # substrings from Step 3 printout
    "nose_cone": [], "canopy": [], "wing_L": [], "wing_R": [], "tail_fin": [],
    "stabilizer_L": [], "stabilizer_R": [], "engine_nozzle": [], "stores": [],
}
LABELS = {"fuselage":"Fuselage","nose_cone":"Nose cone / radome","canopy":"Canopy",
    "wing_L":"Left wing","wing_R":"Right wing","tail_fin":"Vertical tail",
    "stabilizer_L":"Left stabilator","stabilizer_R":"Right stabilator",
    "engine_nozzle":"Engine nozzle","stores":"Missiles & stores"}
ORDER = ["stores","canopy","nose_cone","engine_nozzle","tail_fin",
         "stabilizer_L","stabilizer_R","wing_L","wing_R","fuselage"]
DIST = 4.0

def meshes(): return [o for o in bpy.context.scene.objects if o.type == "MESH"]

# 1. flatten hierarchy, apply transforms, orient
for o in meshes():
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in list(bpy.context.scene.objects):
    if o.type != "MESH": bpy.data.objects.remove(o)
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = meshes()[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 2. split multi-material objects so materials can map to parts
for o in meshes():
    if len(o.material_slots) > 1:
        bpy.ops.object.select_all(action="DESELECT"); o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.separate(type="MATERIAL")
        bpy.ops.object.mode_set(mode="OBJECT")

# 3. assign each mesh to a part (L/R split by world Y sign when a key has _L/_R twin)
def part_of(o):
    names = [o.name.lower()] + [s.material.name.lower() for s in o.material_slots if s.material]
    for part, keys in PARTS_ITER:
        if any(k.lower() in n for k in keys for n in names):
            if part.endswith(("_L", "_R")):
                c = sum((o.matrix_world @ Vector(v) for v in o.bound_box), Vector()) / 8
                return part[:-2] + ("_L" if c.y > 0 else "_R")
            return part
    return "fuselage"
PARTS_ITER = list(PART_MAP.items())

groups = {}
for o in meshes(): groups.setdefault(part_of(o), []).append(o)
missing = set(LABELS) - set(groups)
assert not missing, f"no geometry for {missing}; extend PART_MAP or bisect"

# 4. join, orient, normalise
for part, objs in groups.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    bpy.context.view_layer.objects.active.name = part

allobj = meshes()
for o in allobj: o.rotation_euler.z += NOSE_AXIS_ROT_Z
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.transform_apply(rotation=True)
pts = [o.matrix_world @ Vector(c) for o in allobj for c in o.bound_box]
lo = Vector(map(min, zip(*pts))); hi = Vector(map(max, zip(*pts)))
centre, size = (lo + hi) / 2, max(hi - lo)
for o in allobj:
    o.location = (o.location - centre) * (10 / size)
    o.scale *= 10 / size
bpy.ops.object.transform_apply(location=True, scale=True)

# 5. origins + explode props
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
for o in allobj:
    d = o.location.copy()
    if o.name == "fuselage" or d.length < 1e-4: d = Vector((0, 0, -1))
    d.z += 0.35 * d.length          # bias upward for a readable explode
    d.normalize()
    o["explode_dir"] = [round(v, 5) for v in d]
    o["explode_dist"] = DIST * (0.4 if o.name == "fuselage" else 1.0)
    o["order"] = ORDER.index(o.name)
    o["label"] = LABELS[o.name]

# 6. export
import os
out = os.path.join(bpy.path.abspath("//") or "/Users/perry/Documents/Code/game/plane-labs", "")
bpy.ops.export_scene.gltf(
    filepath="/Users/perry/Documents/Code/game/plane-labs/public/f16.glb",
    export_format="GLB", export_extras=True, export_yup=True, export_apply=True)
print("exported", sorted(o.name for o in meshes()))
```

- [ ] **Step 5: Run it in Blender**

`mkdir -p public`, then `execute_blender_code` with the file contents. If the assert reports missing parts, either widen `PART_MAP` from the Step 3 printout, or for a fused part add a `bpy.ops.mesh.bisect` cut on the `fuselage` object (plane at the part's boundary, `use_fill=True`) followed by `separate(type="LOOSE")` and rename, then re-run from step 3 of the script. `get_viewport_screenshot` to confirm orientation (nose +X).

- [ ] **Step 6: Visual explode check in Blender**

```python
import bpy
from mathutils import Vector
for o in bpy.context.scene.objects:
    if "explode_dir" in o: o.location += Vector(o["explode_dir"]) * o["explode_dist"]
```
`get_viewport_screenshot` → parts clearly separated, none flying through each other. Then undo by subtracting the same vector (re-export not needed if export happened before this step).

- [ ] **Step 7: Run check — expect pass**

Run: `python3 tests/check_glb.py public/f16.glb`
Expected: `GLB OK`.

- [ ] **Step 8: Commit** (if repo initialised)

```bash
git add blender/build_f16.py tests/check_glb.py public/f16.glb
git commit -m "feat: F-16 parts GLB with explode metadata"
```

---

### Task 2: Pure explode logic (`explode.js`)

**Files:**
- Create: `explode.js`, `tests/explode.test.mjs`

**Interfaces:**
- Produces:
  - `easeInOutCubic(x: number): number`
  - `partProgress(t: number, order: number, n: number): number` — 0..1, staggered; 0 at t=0, 1 at t=1 for every order.
  - `partOffset(t, order, n, dir: [x,y,z], dist): [x,y,z]`
  - `stepT(t: number, target: 0|1, dt: number, {duration=1.8, reduced=false}): number` — moves `t` toward `target` at `1/duration` per second, clamped; `reduced` → returns `target`.

- [ ] **Step 1: Write failing tests**

```js
// tests/explode.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { easeInOutCubic, partProgress, partOffset, stepT } from "../explode.js";

test("ease endpoints", () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
});

test("every part at rest at t=0 and fully out at t=1", () => {
  for (let o = 0; o < 10; o++) {
    assert.equal(partProgress(0, o, 10), 0);
    assert.equal(partProgress(1, o, 10), 1);
  }
});

test("stagger: lower order leads", () => {
  assert.ok(partProgress(0.3, 0, 10) > partProgress(0.3, 9, 10));
});

test("offset follows dir*dist", () => {
  assert.deepEqual(partOffset(1, 0, 10, [0, 1, 0], 4), [0, 4, 0]);
  assert.deepEqual(partOffset(0, 0, 10, [0, 1, 0], 4), [0, 0, 0]);
});

test("stepT full sweep takes duration", () => {
  let t = 0;
  for (let i = 0; i < 18; i++) t = stepT(t, 1, 0.1);
  assert.ok(Math.abs(t - 1) < 1e-9);
});

test("retarget mid-flight reverses from current t, no jump", () => {
  let t = 0;
  for (let i = 0; i < 9; i++) t = stepT(t, 1, 0.1);   // ~0.5
  const mid = t;
  const back = stepT(t, 0, 0.1);
  assert.ok(back < mid && mid - back < 0.06);
});

test("scrub overrides animation: stepT toward same t is a no-op", () => {
  assert.equal(stepT(0.42, 0.42, 0.1), 0.42);
});

test("reduced motion jumps to target", () => {
  assert.equal(stepT(0.2, 1, 0.016, { reduced: true }), 1);
});

test("clamps", () => {
  assert.equal(stepT(0.99, 1, 1), 1);
  assert.equal(stepT(0.01, 0, 1), 0);
});
```

- [ ] **Step 2: Run — expect failure**

Run: `node --test tests/`
Expected: FAIL, cannot find module `explode.js`.

- [ ] **Step 3: Implement**

```js
// explode.js — pure; no Three.js so it can be unit-tested in Node.
const WINDOW = 0.5; // each part animates over half the timeline, starts staggered

export const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

export function partProgress(t, order, n) {
  const start = n > 1 ? (order / (n - 1)) * (1 - WINDOW) : 0;
  const p = Math.min(1, Math.max(0, (t - start) / WINDOW));
  return easeInOutCubic(p);
}

export function partOffset(t, order, n, dir, dist) {
  const k = partProgress(t, order, n) * dist;
  return dir.map((v) => v * k + 0); // +0 normalises -0
}

export function stepT(t, target, dt, { duration = 1.8, reduced = false } = {}) {
  if (reduced) return target;
  const step = dt / duration;
  return target > t ? Math.min(target, t + step) : Math.max(target, t - step);
}
```

- [ ] **Step 4: Run — expect pass**

Run: `node --test tests/`
Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add explode.js tests/explode.test.mjs
git commit -m "feat: staggered explode math"
```

---

### Task 3: Viewer page (`index.html`, `main.js`, `style.css`) with impeccable

**Files:**
- Create: `index.html`, `main.js`, `style.css`

**Interfaces:**
- Consumes: `public/f16.glb` (Task 1 contract); `partOffset`, `stepT` from `explode.js`.
- Produces: DOM ids `#toggle` (button, `aria-pressed`), `#explode` (range 0..1000), `#status` (loading/error text), `#tip` (hover label), `#credit`; `window.__viewer = { setT(t:number):void, parts: THREE.Object3D[], ready: Promise<void> }`; each part keeps `userData.rest: THREE.Vector3`.

- [ ] **Step 1: Load impeccable guidance**

Invoke skill `impeccable` with args `shape` for: "Dark hangar-style showcase page for an interactive exploded F-16 3D model. Full-bleed canvas; minimal overlay: title, Assemble/Disassemble toggle, explode slider, hover part label, model credit, reserved header slot for a future 'Cockpit' mode switch." Follow its typography, colour, spacing and motion guidance in steps 2–3.

- [ ] **Step 2: Write `index.html` + `style.css`**

Structure (styling per impeccable output; must keep these ids and semantics):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>F-16 Exploded View</title>
  <link rel="stylesheet" href="style.css" />
  <script type="importmap">
  { "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
  } }
  </script>
</head>
<body>
  <canvas id="stage" aria-label="3D model of an F-16A"></canvas>
  <header class="bar">
    <h1>F-16A <span>Exploded view</span></h1>
    <nav class="modes" aria-label="Mode"><button aria-current="page">Airframe</button></nav>
  </header>
  <p id="status" role="status">Loading model…</p>
  <div id="tip" hidden></div>
  <section class="controls">
    <button id="toggle" aria-pressed="false">Disassemble</button>
    <label>Explode <input id="explode" type="range" min="0" max="1000" value="0" /></label>
  </section>
  <footer id="credit"></footer>
  <script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `main.js`**

```js
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { partOffset, stepT } from "./explode.js";

const CREDIT = ""; // filled in Task 1 Step 3 from Sketchfab license info
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

const renderer = new THREE.WebGLRenderer({ canvas: $("stage"), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment()).texture;
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
camera.position.set(14, 7, 14);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = !reduced;
controls.autoRotateSpeed = 0.4;
controls.addEventListener("start", () => (controls.autoRotate = false));

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(8, 14, 6); key.castShadow = true;
scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.35 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -3; floor.receiveShadow = true;
scene.add(floor);

let parts = [], t = 0, target = 0;
const tmp = new THREE.Vector3();

function apply() {
  for (const p of parts) {
    const u = p.userData;
    const o = partOffset(t, u.order, parts.length, u.explode_dir, u.explode_dist);
    p.position.copy(u.rest).add(tmp.set(...o));
  }
  $("explode").value = Math.round(t * 1000);
}

function setTarget(v) {
  target = v;
  $("toggle").setAttribute("aria-pressed", String(v === 1));
  $("toggle").textContent = v === 1 ? "Assemble" : "Disassemble";
}

const ready = new GLTFLoader().loadAsync("public/f16.glb").then((gltf) => {
  const root = gltf.scene;
  parts = root.children.filter((c) => Array.isArray(c.userData.explode_dir));
  for (const p of parts) {
    p.userData.rest = p.position.clone();
    p.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  }
  scene.add(root);
  $("status").hidden = true;
  $("credit").textContent = CREDIT;
  apply();
}).catch((err) => {
  $("status").textContent = "Couldn't load the model. Check your connection and reload.";
  console.warn(err);
});

$("toggle").addEventListener("click", () => setTarget(target === 1 ? 0 : 1));
$("explode").addEventListener("input", (e) => {
  t = target = e.target.value / 1000;
  setTarget(target); target = t; apply();
});

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
renderer.domElement.addEventListener("pointermove", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(parts, true)[0];
  let part = hit?.object; while (part && !parts.includes(part)) part = part.parent;
  const tip = $("tip");
  tip.hidden = !part;
  if (part) { tip.textContent = part.userData.label; tip.style.translate = `${e.clientX + 14}px ${e.clientY + 14}px`; }
});

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.8 ? 55 : 35; // fit plane on portrait phones
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (t !== target) { t = stepT(t, target, dt, { reduced }); apply(); }
  controls.update();
  renderer.render(scene, camera);
});

window.__viewer = { ready, get parts() { return parts; }, setT(v) { t = target = v; apply(); } };
```

Note on the slider handler: `setTarget` updates the button label to match the dragged state (≥0.5 counts as exploded); implement it as `setTarget(t >= 0.5 ? 1 : 0); target = t;` so animation stops at the dragged value.

- [ ] **Step 4: Smoke run**

Run: `python3 -m http.server 8000` (background) and open `http://localhost:8000/` in the built-in browser; model visible, toggle animates, slider scrubs.

- [ ] **Step 5: impeccable critique + polish**

Invoke skill `impeccable` with `critique index.html`, apply findings; then `polish index.html`, apply. Re-run `node --test tests/` (must still pass).

- [ ] **Step 6: Commit**

```bash
git add index.html main.js style.css
git commit -m "feat: F-16 explode viewer UI"
```

---

### Task 4: Playwright verification

**Files:** none created (checks run through Playwright MCP; screenshots to scratchpad).

**Interfaces:**
- Consumes: `window.__viewer` (`ready`, `parts`, `setT`), ids `#toggle`, `#status`.

- [ ] **Step 1: Load + console**

`browser_navigate http://localhost:8000/`, `browser_evaluate` `await window.__viewer.ready; window.__viewer.parts.length` → `10`. `browser_console_messages` → no errors.

- [ ] **Step 2: Explode moves parts**

`browser_click #toggle`, wait 2.5 s, then evaluate:
```js
window.__viewer.parts.every(p => p.position.distanceTo(p.userData.rest) > 0.5 * p.userData.explode_dist)
```
→ `true`. Screenshot `exploded-desktop.png` at 1440x900.

- [ ] **Step 3: Assemble returns parts**

`browser_click #toggle`, wait 2.5 s, evaluate:
```js
window.__viewer.parts.every(p => p.position.distanceTo(p.userData.rest) < 1e-3)
```
→ `true`. Screenshot `assembled-desktop.png`.

- [ ] **Step 4: Mid-flight reversal (Review Focus 1)**

Click `#toggle`, wait 0.6 s, click again, wait 2.5 s; repeat Step 3 evaluation → `true`.

- [ ] **Step 5: Mobile (Review Focus 4)**

`browser_resize 375x812`, reload, await ready, evaluate `document.documentElement.scrollWidth <= innerWidth` → `true`; `#toggle` visible in snapshot; screenshot `mobile.png`.

- [ ] **Step 6: Reduced motion (Review Focus 5)**

`browser_emulate_media` reduced motion, reload, click `#toggle`, wait 0.2 s, evaluate Step 2 check → `true`.

- [ ] **Step 7: Load failure (Review Focus 3)**

`browser_run_code_unsafe`: `await page.route('**/f16.glb', r => r.abort()); await page.reload();` wait 1 s; `#status` text contains "Couldn't load"; console has no uncaught errors (a `warn` is fine).

- [ ] **Step 8: Report**

Send the three screenshots to the user; list any failures with fixes applied.
