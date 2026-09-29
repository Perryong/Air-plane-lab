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

// ---- aircraft profiles -------------------------------------------------------
const flyP = (s, input, secs, p, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) s = F.stepFlight(s, input, dt, p); return s; };
const C = () => F.PROFILES.c172;

test("C172: cruise ≈32 u/s, full throttle ≈44 u/s", () => {
  const s0 = { ...base(), speed: 32 };
  assert.ok(Math.abs(flyP(s0, {}, 8, C()).speed - 32) < 1.5);
  assert.ok(Math.abs(flyP(s0, { burner: true }, 12, C()).speed - 44) < 1.5);
});

test("C172: bank limited to 45° and turns gentler than the F-16", () => {
  const c = flyP({ ...base(), speed: 32 }, { roll: 1 }, 2, C());
  assert.ok(c.bank <= (45 * Math.PI) / 180 + 1e-9 && c.bank > 0.6);
  const f = flyP(base(), { roll: 1 }, 2, F.PROFILES.f16);
  assert.ok(Math.abs(c.yaw) < Math.abs(f.yaw));
});

test("default profile is the F-16 (existing behaviour unchanged)", () => {
  assert.deepEqual(F.stepFlight(base(), { roll: 0.3 }, 0.1), F.stepFlight(base(), { roll: 0.3 }, 0.1, F.PROFILES.f16));
});

test("scaled course for the C172: 12 rings, above terrain, smaller rings", () => {
  const c = F.makeCourse(0.5, 0.7);
  assert.equal(c.length, F.RING_COUNT);
  for (const r of c) assert.ok(r.y - F.terrainHeight(r.x, r.z) >= 35 && Math.abs(r.radius - F.RING_RADIUS * 0.7) < 1e-9);
  const full = F.makeCourse();
  assert.ok(Math.hypot(c[3].x, c[3].z) < Math.hypot(full[3].x, full[3].z) * 0.6);
});

test("start/respawn use the profile's cruise speed", () => {
  const c = F.makeCourse(0.5, 0.7);
  assert.equal(F.startState(c, C()).speed, 32);
  assert.equal(F.respawnState(c, 2, C()).speed, 32);
  assert.equal(F.startState(c).speed, F.CRUISE);
});
