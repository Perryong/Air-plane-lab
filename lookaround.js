// Pure seated look-around math; no Three.js so Node can test it.
const deg = (d) => (d * Math.PI) / 180;
export const YAW_MAX = deg(150);
export const PITCH_MIN = deg(-50);
export const PITCH_MAX = deg(35);
export const START = [0, deg(-7)];
const TAU = 0.04;     // s; ~3τ ≈ 120 ms to settle
const DRAG_RAD = 2.2; // radians per full viewport width (≈126°)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const clampLook = ([yaw, pitch]) => [clamp(yaw, -YAW_MAX, YAW_MAX), clamp(pitch, PITCH_MIN, PITCH_MAX)];

export function headingDeg(yaw) {
  const h = Math.round((-yaw * 180) / Math.PI) % 360;
  return (h + 360) % 360;
}

export function stepLook(cur, target, dt, { reduced = false } = {}) {
  if (reduced) return [target[0], target[1]];
  const a = 1 - Math.exp(-dt / TAU);
  return [cur[0] + (target[0] - cur[0]) * a, cur[1] + (target[1] - cur[1]) * a];
}

export function dragToLook([yaw, pitch], dx, dy, width) {
  if (!(width > 0)) return [yaw, pitch];
  const k = DRAG_RAD / width;
  return clampLook([yaw + dx * k, pitch + dy * k]);
}
