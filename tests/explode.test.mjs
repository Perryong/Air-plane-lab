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
  for (let i = 0; i < 9; i++) t = stepT(t, 1, 0.1);
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

import { framePull } from "../explode.js";

test("framePull: portrait pulls back, landscape stays", () => {
  assert.equal(framePull(2), 1);
  assert.ok(Math.abs(framePull(0.5) - 3.2) < 1e-9);
});

test("framePull: zero-size / hidden window never poisons the camera", () => {
  assert.equal(framePull(NaN), 1);        // 0/0 when the tab starts hidden
  assert.equal(framePull(Infinity), 1);   // w/0
  assert.equal(framePull(0), 1);
});
