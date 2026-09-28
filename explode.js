// Pure explode math; no Three.js so it can be unit-tested in Node.
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

// Camera pull-back so the exploded airframe fits portrait screens. A hidden or
// zero-size window gives NaN/Infinity aspects; fall back to 1 so the camera
// position is never multiplied into NaN.
export function framePull(aspect) {
  return Number.isFinite(aspect) && aspect > 0 ? Math.max(1, 1.6 / aspect) : 1;
}
