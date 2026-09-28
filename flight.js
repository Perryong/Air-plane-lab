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
    pts.push({ x, z, y: Math.max(terrainHeight(x, z), 0) + 55 + 15 * Math.sin(3 * a) });
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
