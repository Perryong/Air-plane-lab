import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { partOffset, stepT, framePull } from "./explode.js?v=9";
import { START, clampLook, headingDeg, stepLook, dragToLook } from "./lookaround.js?v=9";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
// lit digits padded with figure spaces so they sit over their ghost cells
const setNum = (el, n) => (el.textContent = String(n).padStart(el.dataset.ghost.length, " "));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $("stage"), antialias: true, alpha: true });
} catch (err) {
  window.__loadFail();
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
const BASE_POS = new THREE.Vector3(12, 5.5, 13);
camera.position.copy(BASE_POS);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 8;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.62;
controls.autoRotate = !reduced;
controls.autoRotateSpeed = 0.35;
controls.addEventListener("start", () => (controls.autoRotate = false));

// dusk: cool sky fill, low warm sun from the horizon
scene.add(new THREE.HemisphereLight(0x9fb4c8, 0x1a1512, 0.9));
const sun = new THREE.DirectionalLight(0xffc9a0, 2.4);
sun.position.set(-10, 7, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
scene.add(sun);
const rim = new THREE.DirectionalLight(0x8fb7ff, 1.1);
rim.position.set(8, 4, -10);
scene.add(rim);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.32 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -3.4;
floor.receiveShadow = true;
scene.add(floor);

let parts = [], t = 0, target = 0, hovered = null, airframeRoot = null;
const tmp = new THREE.Vector3();

function apply() {
  for (const p of parts) {
    const u = p.userData;
    p.position.copy(u.rest).add(tmp.set(...partOffset(t, u.order, parts.length, u.explode_dir, u.explode_dist)));
  }
  $("explode").value = Math.round(t * 1000);
  $("explode").setAttribute("aria-valuetext", `${Math.round(t * 100)}% separated`);
  setNum($("sep"), Math.round(t * 100));
}

function setTarget(v) {
  target = v;
  const out = v >= 0.5;
  $("toggle").setAttribute("aria-pressed", String(out));
  $("toggle").textContent = out ? "Assemble" : "Disassemble";
}

const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/");
const loader = new GLTFLoader().setDRACOLoader(draco);
const pct = $("status").querySelector(".num");

const ready = loader
  .loadAsync("public/f16.glb", (e) => e.total && setNum(pct, Math.round((e.loaded / e.total) * 100)))
  .then((gltf) => {
    const root = gltf.scene;
    parts = root.children.filter((c) => Array.isArray(c.userData.explode_dir));
    for (const p of parts) {
      p.userData.rest = p.position.clone();
      p.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    }
    scene.add(root);
    airframeRoot = root;
    $("status").hidden = true;
    $("toggle").disabled = $("explode").disabled = false;
    apply();
  })
  .catch((err) => {
    $("status").classList.add("error");
    $("status").textContent = "Couldn't load the aircraft model. Check your connection and reload the page.";
    console.warn("f16.glb failed to load", err);
  });

$("toggle").addEventListener("click", () => setTarget(target >= 0.5 ? 0 : 1));
$("explode").addEventListener("input", (e) => {
  t = e.target.value / 1000;
  setTarget(t >= 0.5 ? 1 : 0);
  target = t; // scrub wins: animation stops where the user holds it
  apply();
});

// hover (mouse) or tap (touch): designation bracket locks onto the part's screen-space bounds
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), box = new THREE.Box3();
function pick(x, y) {
  if (mode !== "airframe") { hovered = null; return; }
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  let o = ray.intersectObjects(parts, true)[0]?.object;
  while (o && !parts.includes(o)) o = o.parent;
  hovered = o ?? null;
  $("tip").textContent = hovered ? hovered.userData.label : "";
}
let down = null;
renderer.domElement.addEventListener("pointermove", (e) => { if (e.pointerType !== "touch") pick(e.clientX, e.clientY); });
renderer.domElement.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
renderer.domElement.addEventListener("pointerup", (e) => {
  // a tap (not an orbit drag) selects on touch screens
  if (e.pointerType === "touch" && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 8) pick(e.clientX, e.clientY);
});
renderer.domElement.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hovered = null; });

function drawLock() {
  const lock = $("lock");
  if (!hovered) { lock.hidden = true; return; }
  box.setFromObject(hovered);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    tmp.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
    const sx = (tmp.x + 1) / 2 * innerWidth, sy = (1 - tmp.y) / 2 * innerHeight;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  lock.hidden = false;
  lock.style.translate = `${x0 - 6}px ${y0 - 6}px`;
  lock.style.width = `${x1 - x0 + 12}px`;
  lock.style.height = `${y1 - y0 + 12}px`;
}

// ---- cockpit mode: seated look-around from the captain's eye point -------
const cockCam = new THREE.PerspectiveCamera(68, 1, 0.02, 200);
cockCam.rotation.order = "YXZ";
const cockpit = { scene: null, ready: null, look: [...START], target: [...START], dragging: null };
let mode = "airframe";

function loadCockpit() {
  const s = $("cstatus");
  s.hidden = false; s.classList.remove("error");
  s.innerHTML = 'Acquiring flight deck <span class="num" data-ghost="888">0</span>%';
  const num = s.querySelector(".num");
  cockpit.ready = loader
    .loadAsync("public/cockpit.glb", (e) => e.total && setNum(num, Math.round((e.loaded / e.total) * 100)))
    .then((gltf) => {
      const sc = new THREE.Scene();
      // no background: the page's dusk sky shows through the windscreen
      sc.environment = scene.environment;
      sc.environmentIntensity = 0.8;
      sc.add(new THREE.HemisphereLight(0xcfdcec, 0x2a2420, 1.4));
      sc.add(gltf.scene);
      const eye = gltf.scene.getObjectByName("eye_captain");
      if (!eye) throw new Error("cockpit.glb has no eye_captain");
      gltf.scene.updateMatrixWorld(true);
      eye.getWorldPosition(cockCam.position);
      cockpit.scene = sc;
      s.hidden = true;
    })
    .catch((err) => {
      cockpit.ready = null; // allow a retry on next entry
      console.warn("cockpit.glb failed to load", err);
      s.classList.add("error");
      s.innerHTML = 'Couldn\'t load the flight deck. <a href="#airframe">Back to the airframe</a>';
    });
  return cockpit.ready;
}

const TITLES = {
  airframe: ["F-16A", "Airframe · exploded view"],
  cockpit: ["757-200", "Flight deck"],
  fly: ["F-16A", "Ring course"],
};

function applyMode(next) {
  fly.game?.setActive(next === "fly");
  mode = next;
  document.body.classList.toggle("mode-cockpit", mode === "cockpit");
  document.body.classList.toggle("mode-airframe", mode === "airframe");
  document.body.classList.toggle("mode-fly", mode === "fly");
  for (const a of document.querySelectorAll(".modes a[data-mode]")) {
    if (a.dataset.mode === mode) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  [$("title").textContent, $("subtitle").textContent] = TITLES[mode];
  controls.enabled = mode === "airframe";
  hovered = null;
  if (mode === "cockpit" && !cockpit.ready) loadCockpit();
  if (mode === "fly") loadFly();
}

const modeFromHash = () => ({ "#cockpit": "cockpit", "#fly": "fly" })[location.hash] ?? "airframe";

// ---- fly mode: lazy-loaded ring-course game ---------------------------------
const fly = { game: null, ready: null };
function loadFly() {
  if (fly.ready) return fly.ready.then(() => fly.game?.setActive(mode === "fly"));
  const s = $("fstatus");
  s.hidden = false; s.classList.remove("error"); s.textContent = "Preparing the course…";
  fly.ready = Promise.all([ready, import("./fly.js?v=9")])
    .then(([, { createFly }]) => {
      if (!airframeRoot) throw new Error("F-16 model unavailable");
      fly.game = createFly({ renderer, f16: airframeRoot, env: scene.environment, reduced });
      fly.game.resize(camera.aspect);
      fly.game.setActive(mode === "fly");
      s.hidden = true;
    })
    .catch((err) => {
      fly.ready = null;
      console.warn("fly mode failed to load", err);
      s.classList.add("error");
      s.innerHTML = 'Couldn\'t start the ring course. <a href="#airframe">Back to the airframe</a>';
    });
  return fly.ready;
}
let fadeTimer = 0;
function switchMode() {
  // a quick back-and-forth cancels the pending switch; the hash at the end of the fade wins
  clearTimeout(fadeTimer);
  const c = $("stage");
  if (modeFromHash() === mode) return c.classList.remove("fading");
  if (reduced) return applyMode(modeFromHash());
  c.classList.add("fading");
  fadeTimer = setTimeout(() => { applyMode(modeFromHash()); c.classList.remove("fading"); }, 250);
}
addEventListener("hashchange", switchMode);

// grab-the-world drag; arrow keys for keyboard users
const cv = renderer.domElement;
// one pointer drives the look; a second finger (pinch habit) is ignored instead of
// making the view jump by the distance between the fingers
cv.addEventListener("pointerdown", (e) => {
  if (mode !== "cockpit" || cockpit.dragging || e.button > 0) return;
  cockpit.dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try { cv.setPointerCapture(e.pointerId); } catch {}
});
cv.addEventListener("pointermove", (e) => {
  const d = cockpit.dragging;
  if (mode !== "cockpit" || !d || e.pointerId !== d.id) return;
  cockpit.target = dragToLook(cockpit.target, e.clientX - d.x, e.clientY - d.y, innerWidth);
  d.x = e.clientX; d.y = e.clientY;
  $("hint").classList.add("gone");
});
const endDrag = (e) => { if (cockpit.dragging?.id === e.pointerId) cockpit.dragging = null; };
cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", endDrag);
cv.addEventListener("keydown", (e) => {
  if (mode !== "cockpit") return;
  const step = 0.12;
  const k = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
  if (!k) return;
  e.preventDefault();
  cockpit.target = clampLook([cockpit.target[0] + k[0], cockpit.target[1] + k[1]]);
  $("hint").classList.add("gone");
});

let pull = 1;
function resize() {
  if (!innerWidth || !innerHeight) return; // hidden tab; next resize catches up
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  // keep the exploded airframe in frame on portrait screens; rescale distance only,
  // so the visitor's orbit angle survives resizes (mobile URL bar, rotation)
  const k = framePull(camera.aspect);
  controls.maxDistance = 40 * k; // otherwise the clamp undoes the pull-back
  camera.position.multiplyScalar(k / pull);
  pull = k;
  controls.update();
  cockCam.aspect = camera.aspect;
  cockCam.fov = camera.aspect < 0.8 ? 80 : 68;
  cockCam.updateProjectionMatrix();
  fly.game?.resize(camera.aspect);
}
addEventListener("resize", resize);
resize();

const clock = new THREE.Clock();
const ticks = document.querySelector(".heading-ticks");
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mode === "fly") return fly.game ? fly.game.frame(dt) : renderer.clear();
  if (mode === "cockpit") {
    if (!cockpit.scene) return renderer.clear();
    cockpit.look = stepLook(cockpit.look, cockpit.target, dt, { reduced });
    cockCam.rotation.set(cockpit.look[1], -Math.PI / 2 + cockpit.look[0], 0);
    const h = headingDeg(cockpit.look[0]);
    setNum($("hdg"), String(h).padStart(3, "0"));
    ticks.style.setProperty("--off", `${-h * 4}px`);
    return renderer.render(cockpit.scene, cockCam);
  }
  if (t !== target) { t = stepT(t, target, dt, { reduced }); apply(); }
  controls.update();
  renderer.render(scene, camera);
  drawLock();
});

window.__viewer = {
  ready, camera, cockCam,
  get parts() { return parts; },
  get mode() { return mode; },
  get cockpitReady() { return cockpit.ready; },
  get look() { return cockpit.look; },
  get fly() { return fly.game; },
  get flyReady() { return fly.ready; },
  setT(v) { setTarget(v); t = v; apply(); },
};

applyMode(modeFromHash());
