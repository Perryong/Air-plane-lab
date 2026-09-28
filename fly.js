// Fly mode: F-16 ring course. Pure rules live in flight.js; this file is the
// Three.js scene, flight effects, input and the Fly HUD.
import * as THREE from "three";
import {
  CRUISE, forward, stepFlight, terrainHeight, makeCourse, hitGround,
  startState, respawnState, newRace, advanceRace, combineInput,
} from "./flight.js?v=8";

const $ = (id) => document.getElementById(id);
const BEST_KEY = "f16-ring-best";
const readBest = () => { try { const v = parseFloat(localStorage.getItem(BEST_KEY)); return v > 0 ? v : null; } catch { return null; } };
const writeBest = (v) => { try { localStorage.setItem(BEST_KEY, String(v)); } catch {} };
const fmt = (s) => (s == null ? "--:--.-" : `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function createFly({ renderer, f16, env, reduced }) {
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.6;
  scene.fog = new THREE.Fog(0x16212b, 400, 2600);
  scene.add(new THREE.HemisphereLight(0xa9bfd4, 0x2a2118, 1.1));
  const sun = new THREE.DirectionalLight(0xffc9a0, 2.2);
  sun.position.set(-400, 300, 200);
  scene.add(sun);

  // ---- terrain + water --------------------------------------------------
  const tg = new THREE.PlaneGeometry(6000, 6000, 240, 240);
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position, cols = new Float32Array(pos.count * 3);
  const low = new THREE.Color(0x2c4a4a), high = new THREE.Color(0x9c8a66), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = terrainHeight(pos.getX(i), pos.getZ(i));
    pos.setY(i, h);
    c.copy(low).lerp(high, clamp((h + 20) / 70, 0, 1)).toArray(cols, i * 3);
  }
  tg.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  tg.computeVertexNormals();
  scene.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true })));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x1b3140 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -4;
  scene.add(water);

  // ---- clouds: soft sprites for a sense of speed --------------------------
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d"), grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const cloudMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.55, depthWrite: false });
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Sprite(cloudMat);
    const a = rnd() * Math.PI * 2, r = 300 + rnd() * 1500;
    s.position.set(Math.cos(a) * r, 120 + rnd() * 140, Math.sin(a) * r);
    s.scale.setScalar(60 + rnd() * 90);
    scene.add(s);
  }

  // ---- rings --------------------------------------------------------------
  const course = makeCourse();
  const ringGeo = new THREE.TorusGeometry(course[0].radius, 0.9, 12, 48);
  const rings = course.map((r) => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x6cff8f, transparent: true, opacity: 0.35, fog: false }));
    m.position.set(r.x, r.y, r.z);
    m.rotation.y = r.yaw + Math.PI / 2; // torus faces +Z; turn its axis onto the ring's heading
    scene.add(m);
    return m;
  });

  // ---- jet: yaw > pitch > bank groups ------------------------------------
  const yawG = new THREE.Group(), pitchG = new THREE.Group(), bankG = new THREE.Group();
  yawG.add(pitchG); pitchG.add(bankG); scene.add(yawG);
  const model = f16.clone(true);
  model.traverse((o) => { if (o.userData.rest) o.position.copy(o.userData.rest); });
  bankG.add(model);
  const partBox = (name) => new THREE.Box3().setFromObject(model.getObjectByName(name));
  const nozzle = partBox("engine_nozzle"), wl = partBox("wing_L"), wr = partBox("wing_R");
  const tipL = new THREE.Vector3(wl.getCenter(new THREE.Vector3()).x, wl.max.y, wl.min.z); // left = -Z
  const tipR = new THREE.Vector3(wr.getCenter(new THREE.Vector3()).x, wr.max.y, wr.max.z);

  // afterburner: additive outer flame, hot core, orange light
  const burnerG = new THREE.Group();
  burnerG.position.set(nozzle.min.x + 0.2, (nozzle.min.y + nozzle.max.y) / 2, (nozzle.min.z + nozzle.max.z) / 2);
  const nozR = (nozzle.max.z - nozzle.min.z) * 0.38;
  const flameMesh = (r, color) => {
    const geo = new THREE.ConeGeometry(r, 1, 24, 1, true).translate(0, 0.5, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.rotation.z = Math.PI / 2; // cone apex +Y -> -X (behind the nozzle)
    burnerG.add(m);
    return m;
  };
  const flame = flameMesh(nozR, 0xff8a3d), core = flameMesh(nozR * 0.55, 0xcfe6ff);
  const glow = new THREE.PointLight(0xff7a2a, 0, 40, 2);
  burnerG.add(glow);
  bankG.add(burnerG);

  // wingtip vapour trails: fading line strips
  const N = 48;
  const makeTrail = () => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const col = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) col.set([1, 1, 1, 1 - i / (N - 1)], i * 4);
    geo.setAttribute("color", new THREE.BufferAttribute(col, 4));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false }));
    line.frustumCulled = false;
    scene.add(line);
    return line;
  };
  const trails = [makeTrail(), makeTrail()];

  // ---- camera + speed streaks ----------------------------------------------
  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 3200);
  scene.add(camera);
  const S = 120, streakPos = new Float32Array(S * 6), streakSeed = [];
  for (let i = 0; i < S; i++) streakSeed.push([(rnd() - 0.5) * 60, (rnd() - 0.5) * 36, -20 - rnd() * 140]);
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute("position", new THREE.BufferAttribute(streakPos, 3));
  const streaks = new THREE.LineSegments(streakGeo, new THREE.LineBasicMaterial({ color: 0xdfe9f2, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  streaks.frustumCulled = false;
  camera.add(streaks);

  // ---- state ----------------------------------------------------------------
  let jet = startState(course), race = newRace(), best = readBest();
  let paused = false, active = false, crashT = 0, bankRate = 0, trailOp = 0, flameLen = 0, t = 0;
  const keys = new Set();
  let touch = { pitch: 0, roll: 0, burner: false };
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();

  function placeCamera(snap) {
    const [fx, fy, fz] = forward(jet.yaw, jet.pitch);
    const want = tmp.set(jet.x - fx * 26, jet.y - fy * 26 + 7, jet.z - fz * 26);
    if (snap) camPos.copy(want); else camPos.lerp(want, 1 - Math.exp(-lastDt * 5));
    camera.position.copy(camPos);
    look.set(jet.x + fx * 30, jet.y + fy * 30 + 2, jet.z + fz * 30);
    camera.lookAt(look);
  }
  let lastDt = 1 / 60;

  const input = () => combineInput({
    pitch: (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0),
    roll: (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0),
    burner: keys.has(" "),
  }, touch);

  function start() { if (!race.started) race = { ...race, started: true }; paused = false; hud(); }
  function restart() {
    jet = startState(course); race = newRace(); crashT = 0; paused = false;
    placeCamera(true); hud();
  }

  // ---- HUD (Fly mode DOM) ---------------------------------------------------
  const el = { spd: $("spd"), alt: $("alt"), ring: $("ring"), time: $("ftime"), best: $("fbest"), burner: $("burner"), start: $("flystart"), end: $("flyend"), endTime: $("fendtime"), endBest: $("fendbest"), crash: $("flycrash"), pause: $("flypause") };
  function hud() {
    el.spd.textContent = String(Math.round(jet.speed * 5.4)).padStart(3, "0"); // u/s → kt (1 u ≈ 1.5 m)
    el.alt.textContent = String(Math.max(0, Math.round((jet.y - terrainHeight(jet.x, jet.z)) * 4.9))).padStart(4, "0"); // ft AGL
    el.ring.textContent = `${String(Math.min(race.next + 1, course.length)).padStart(2, "0")}/${course.length}`;
    el.time.textContent = fmt(race.time);
    el.best.textContent = fmt(best);
    el.burner.style.setProperty("--b", jet.burner.toFixed(3));
    el.start.hidden = race.started;
    el.end.hidden = !race.finished;
    el.pause.hidden = !(paused && race.started && !race.finished);
    el.crash.hidden = crashT <= 0;
  }

  // ---- input wiring ---------------------------------------------------------
  const GAME_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "]);
  addEventListener("keydown", (e) => {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (GAME_KEYS.has(k)) { e.preventDefault(); keys.add(k); }
    if (k === " " && !race.started) start();
    if (k === "r") restart();
    if ((k === "p" || k === "escape") && race.started && !race.finished) { paused = !paused; hud(); }
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  addEventListener("blur", () => clearInput());
  $("flyagain").addEventListener("click", () => { restart(); start(); });
  el.start.addEventListener("click", start);

  // touch: left stick (pitch/roll), right AB hold
  const stick = $("stick"), knob = stick.querySelector(".knob"), ab = $("ab");
  let stickId = null;
  const stickMove = (e) => {
    const r = stick.getBoundingClientRect(), R = r.width / 2;
    const dx = clamp((e.clientX - r.left - R) / R, -1, 1), dy = clamp((e.clientY - r.top - R) / R, -1, 1);
    touch = { ...touch, roll: dx, pitch: -dy };
    knob.style.translate = `${dx * R * 0.6}px ${dy * R * 0.6}px`;
  };
  stick.addEventListener("pointerdown", (e) => {
    if (stickId !== null) return;
    stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); start();
  });
  stick.addEventListener("pointermove", (e) => { if (e.pointerId === stickId) stickMove(e); });
  const stickEnd = (e) => { if (e.pointerId !== stickId) return; stickId = null; touch = { ...touch, roll: 0, pitch: 0 }; knob.style.translate = "0 0"; };
  stick.addEventListener("pointerup", stickEnd);
  stick.addEventListener("pointercancel", stickEnd);
  ab.addEventListener("pointerdown", (e) => { ab.setPointerCapture(e.pointerId); touch = { ...touch, burner: true }; start(); });
  const abEnd = () => (touch = { ...touch, burner: false });
  ab.addEventListener("pointerup", abEnd);
  ab.addEventListener("pointercancel", abEnd);

  function clearInput() {
    keys.clear(); touch = { pitch: 0, roll: 0, burner: false }; stickId = null; knob.style.translate = "0 0";
  }

  // ---- frame ------------------------------------------------------------------
  const wTmp = new THREE.Vector3();
  function pushTrail(line, local) {
    const p = line.geometry.attributes.position;
    p.array.copyWithin(3, 0, (N - 1) * 3);
    bankG.localToWorld(wTmp.copy(local)).toArray(p.array, 0);
    p.needsUpdate = true;
  }

  function frame(dtIn) {
    const dt = Math.min(dtIn, 0.05);
    lastDt = dt || 1 / 60;
    t += dt;
    const inp = input();
    const flying = race.started && !paused;
    if (flying) {
      const prev = jet;
      jet = stepFlight(jet, race.finished ? {} : inp, dt);
      bankRate = (jet.bank - prev.bank) / dt;
      if (!race.finished) {
        const was = race.finished;
        race = advanceRace(race, prev, jet, dt, course);
        if (race.finished && !was && (best == null || race.time < best)) { best = race.time; writeBest(best); }
        if (hitGround(jet)) { jet = respawnState(course, race.next); crashT = 1.6; placeCamera(true); }
      } else if (hitGround(jet)) jet = { ...jet, pitch: Math.abs(jet.pitch) }; // after the finish, don't fly into the ground
    }
    crashT = Math.max(0, crashT - dt);

    // jet attitude
    yawG.position.set(jet.x, jet.y, jet.z);
    yawG.rotation.y = jet.yaw;
    pitchG.rotation.z = jet.pitch;
    bankG.rotation.x = jet.bank;

    // rings: next bright + pulsing, upcoming dim, passed hidden
    rings.forEach((m, i) => {
      m.visible = i >= race.next;
      m.material.opacity = i === race.next ? 1 : 0.3;
      m.scale.setScalar(i === race.next && !reduced ? 1 + 0.05 * Math.sin(t * 5) : 1);
    });

    // afterburner
    const flicker = reduced ? 0 : Math.sin(t * 47) * 0.5 + Math.sin(t * 31) * 0.5;
    flameLen = 1.5 + 7 * jet.burner + (flying ? 1.2 : 0.4) + 0.8 * flicker * (0.3 + jet.burner);
    flame.scale.set(1, flameLen, 1);
    core.scale.set(1, flameLen * 0.55, 1);
    flame.material.opacity = 0.25 + 0.6 * jet.burner;
    core.material.opacity = 0.4 + 0.5 * jet.burner;
    glow.intensity = 30 + 220 * jet.burner;

    // vapour trails
    const pull = (Math.abs(inp.pitch) + Math.abs(bankRate) * 0.6) * clamp((jet.speed - 60) / 60, 0, 1);
    trailOp += (clamp(pull, 0, 1) - trailOp) * (1 - Math.exp(-dt * 6));
    pushTrail(trails[0], tipL); pushTrail(trails[1], tipR);
    for (const tr of trails) tr.material.opacity = flying ? trailOp * 0.8 : 0;

    // camera: follow, FOV with speed, burner shake
    placeCamera(false);
    camera.fov = 60 + 18 * clamp((jet.speed - CRUISE) / 60, 0, 1);
    if (!reduced && flying) camera.position.addScaledVector(camera.up, Math.sin(t * 61) * 0.18 * jet.burner).x += Math.sin(t * 53) * 0.18 * jet.burner;
    camera.updateProjectionMatrix();

    // speed streaks
    const sOp = reduced || !flying ? 0 : clamp((jet.speed - 100) / 40, 0, 1) * 0.5;
    streaks.material.opacity = sOp;
    if (sOp > 0) {
      const len = jet.speed * 0.05;
      streakSeed.forEach((s, i) => {
        s[2] += jet.speed * dt;
        if (s[2] > -5) s[2] -= 150;
        streakPos.set([s[0], s[1], s[2], s[0], s[1], s[2] - len], i * 6);
      });
      streakGeo.attributes.position.needsUpdate = true;
    }

    hud();
    renderer.render(scene, camera);
  }

  function resize(aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); }
  function setActive(on) { active = on; if (!on) { paused = race.started && !race.finished ? true : paused; clearInput(); hud(); } }

  placeCamera(true);
  hud();

  return {
    frame, resize, start, restart, clearInput, setActive,
    setPaused(v) { paused = v; hud(); },
    debug: {
      get jet() { return jet; }, get race() { return race; }, get course() { return course; },
      get paused() { return paused; }, get flame() { return flameLen; }, get trail() { return trailOp; },
      get streaks() { return streaks.material.opacity; }, get camera() { return camera; },
      setJet(s) { jet = { ...jet, ...s }; placeCamera(true); },
    },
  };
}
