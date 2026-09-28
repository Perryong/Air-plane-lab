import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { partOffset, stepT, framePull } from "./explode.js";

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

let parts = [], t = 0, target = 0, hovered = null;
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
}
addEventListener("resize", resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (t !== target) { t = stepT(t, target, dt, { reduced }); apply(); }
  controls.update();
  renderer.render(scene, camera);
  drawLock();
});

window.__viewer = { ready, camera, get parts() { return parts; }, setT(v) { setTarget(v); t = v; apply(); } };
