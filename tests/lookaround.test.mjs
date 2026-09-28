import { test } from "node:test";
import assert from "node:assert/strict";
import { YAW_MAX, PITCH_MIN, PITCH_MAX, START, clampLook, headingDeg, stepLook, dragToLook } from "../lookaround.js";

const deg = (d) => (d * Math.PI) / 180;
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("limits match spec", () => {
  assert.ok(close(YAW_MAX, deg(150)));
  assert.ok(close(PITCH_MIN, deg(-50)));
  assert.ok(close(PITCH_MAX, deg(35)));
  assert.ok(close(START[1], deg(-7)));
});

test("clampLook holds yaw and pitch inside limits", () => {
  assert.deepEqual(clampLook([deg(200), deg(80)]), [YAW_MAX, PITCH_MAX]);
  assert.deepEqual(clampLook([deg(-200), deg(-80)]), [-YAW_MAX, PITCH_MIN]);
  assert.deepEqual(clampLook([0.1, -0.2]), [0.1, -0.2]);
});

test("headingDeg: 0 ahead, right turn increases, wraps to 0..359", () => {
  assert.equal(headingDeg(0), 0);
  assert.equal(headingDeg(deg(-90)), 90);
  assert.equal(headingDeg(deg(90)), 270);
  assert.equal(headingDeg(deg(-0.4)), 0);
  assert.equal(headingDeg(deg(0.4)), 0); // never 360
});

test("stepLook settles within 120 ms", () => {
  let c = [0, 0];
  for (let i = 0; i < 12; i++) c = stepLook(c, [1, -0.5], 0.01);
  assert.ok(Math.abs(c[0] - 1) < 0.06 && Math.abs(c[1] + 0.5) < 0.06); // e^-3 ≈ 5% left
});

test("stepLook: dt 0 is a no-op, reduced motion jumps", () => {
  assert.deepEqual(stepLook([0.2, 0.1], [1, 1], 0), [0.2, 0.1]);
  assert.deepEqual(stepLook([0.2, 0.1], [1, 1], 0.016, { reduced: true }), [1, 1]);
});

test("dragToLook: drag right looks left, full width ≈ 126°, clamped", () => {
  const [y] = dragToLook([0, 0], 1000, 0, 1000);
  assert.ok(close(y, 2.2));
  const [, p] = dragToLook([0, 0], 0, 500, 1000); // drag down looks up
  assert.ok(p > 0);
  assert.deepEqual(dragToLook([0, 0], 1e6, 1e6, 1000), [YAW_MAX, PITCH_MAX]);
});

test("dragToLook guards zero width", () => {
  assert.deepEqual(dragToLook([0.3, 0.1], 50, 50, 0), [0.3, 0.1]);
});
