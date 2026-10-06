#!/usr/bin/env node
// Unit checks for js/snap.js. Usage: node scripts/snap-test.js
'use strict';

const assert = require('assert');
const { computeSnap, alignFrames, distributeFrames, boundsOf } = require('../js/snap.js');

const bounds = { width: 400, height: 800 };
const base = { threshold: 6, bounds };
const f = (x, y, width, height) => ({ x, y, width, height });

const tests = {
  'snaps vertical center to another frame center'() {
    const a = f(300, 500, 60, 60); // center y = 530
    assert.strictEqual(computeSnap(f(100, 600, 20, 20), [a], base).dy, 0, 'far away: no snap');
    const snap = computeSnap(f(100, 516, 20, 20), [a], base); // center 526 -> 530
    assert.strictEqual(snap.dy, 4);
    const guide = snap.guides.find((g) => g.axis === 'y');
    assert.strictEqual(guide.pos, 530);
    assert.ok(guide.from <= 100 && guide.to >= 360, 'guide spans both frames');
  },

  'snaps left edge to right edge of another frame'() {
    const a = f(50, 50, 100, 40); // right = 150
    const snap = computeSnap(f(153, 300, 40, 40), [a], base);
    assert.strictEqual(snap.dx, -3);
  },

  'snaps to canvas center line with full-height guide'() {
    const snap = computeSnap(f(178, 600, 40, 40), [], base); // center x 198 -> 200
    assert.strictEqual(snap.dx, 2);
    const guide = snap.guides.find((g) => g.axis === 'x');
    assert.deepStrictEqual([guide.from, guide.to], [0, 800]);
  },

  'guide wins over grid; grid used when no guide matches'() {
    const a = f(0, 0, 10, 10);
    const withGuide = computeSnap(f(13, 300, 20, 20), [a], { ...base, grid: 8 }); // left 13 vs a.right 10 -> -3
    assert.strictEqual(withGuide.dx, -3);
    const gridOnly = computeSnap(f(45, 300, 21, 21), [], { ...base, grid: 8, guides: false });
    assert.strictEqual(gridOnly.dx, 3); // 45 -> 48
    assert.strictEqual(gridOnly.dy, 4); // 300 -> 304
  },

  'resize mode only snaps right/bottom edges'() {
    const a = f(200, 100, 50, 50); // left 200
    const snap = computeSnap(f(100, 100, 97, 30), [a], { ...base, edges: 'resize' }); // right 197 -> 200
    assert.strictEqual(snap.dx, 3);
  },

  'align and distribute'() {
    const frames = [f(10, 10, 20, 20), f(100, 40, 40, 40), f(300, 25, 20, 30)];
    alignFrames(frames, 'top');
    assert.deepStrictEqual(frames.map((x) => x.y), [10, 10, 10]);
    alignFrames(frames, 'vcenter');
    assert.deepStrictEqual(frames.map((x) => x.y), [20, 10, 15]);
    distributeFrames(frames, 'x');
    // span 10..320 = 310, widths 80, gap (310-80)/2 = 115 -> middle at 30+115 = 145
    assert.deepStrictEqual(frames.map((x) => x.x), [10, 145, 300]);
    assert.deepStrictEqual(boundsOf(frames), f(10, 10, 310, 40));
  },
};

tests['repeated align clicks keep working with a fixed reference'] = () => {
  const frames = [f(304, 514, 60, 60), f(233, 517, 60, 60)];
  const ref = boundsOf(frames);
  alignFrames(frames, 'left', ref);
  assert.deepStrictEqual(frames.map((x) => x.x), [233, 233]);
  alignFrames(frames, 'right', ref);
  assert.deepStrictEqual(frames.map((x) => x.x), [304, 304]);
  alignFrames(frames, 'hcenter', ref);
  assert.deepStrictEqual(frames.map((x) => x.x), [269, 269]);
  alignFrames(frames, 'bottom', ref);
  assert.deepStrictEqual(frames.map((x) => x.y), [517, 517]);
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}\n     ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
