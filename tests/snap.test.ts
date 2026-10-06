// Smart guides, grid snapping, align and distribute (src/snap.ts).

import { describe, expect, it } from 'vitest';
import { computeSnap, alignFrames, distributeFrames, boundsOf } from '../src/snap';
import type { Frame } from '../src/types';

const bounds = { width: 400, height: 800 };
const base = { threshold: 6, bounds };
const f = (x: number, y: number, width: number, height: number): Frame => ({ x, y, width, height });

describe('computeSnap', () => {
  it('snaps vertical center to another frame center', () => {
    const a = f(300, 500, 60, 60); // center y = 530
    expect(computeSnap(f(100, 600, 20, 20), [a], base).dy, 'far away: no snap').toBe(0);
    const snap = computeSnap(f(100, 516, 20, 20), [a], base); // center 526 -> 530
    expect(snap.dy).toBe(4);
    const guide = snap.guides.find((g) => g.axis === 'y')!;
    expect(guide.pos).toBe(530);
    expect(guide.from <= 100 && guide.to >= 360, 'guide spans both frames').toBe(true);
  });

  it('snaps left edge to right edge of another frame', () => {
    const a = f(50, 50, 100, 40); // right = 150
    expect(computeSnap(f(153, 300, 40, 40), [a], base).dx).toBe(-3);
  });

  it('snaps to canvas center line with full-height guide', () => {
    const snap = computeSnap(f(178, 600, 40, 40), [], base); // center x 198 -> 200
    expect(snap.dx).toBe(2);
    const guide = snap.guides.find((g) => g.axis === 'x')!;
    expect([guide.from, guide.to]).toEqual([0, 800]);
  });

  it('prefers a guide over the grid and uses the grid when no guide matches', () => {
    const a = f(0, 0, 10, 10);
    const withGuide = computeSnap(f(13, 300, 20, 20), [a], { ...base, grid: 8 }); // left 13 vs a.right 10 -> -3
    expect(withGuide.dx).toBe(-3);
    const gridOnly = computeSnap(f(45, 300, 21, 21), [], { ...base, grid: 8, guides: false });
    expect(gridOnly.dx).toBe(3); // 45 -> 48
    expect(gridOnly.dy).toBe(4); // 300 -> 304
  });

  it('only snaps right/bottom edges in resize mode', () => {
    const a = f(200, 100, 50, 50); // left 200
    const snap = computeSnap(f(100, 100, 97, 30), [a], { ...base, edges: 'resize' }); // right 197 -> 200
    expect(snap.dx).toBe(3);
  });
});

describe('align and distribute', () => {
  it('aligns, distributes and measures the bounds', () => {
    const frames = [f(10, 10, 20, 20), f(100, 40, 40, 40), f(300, 25, 20, 30)];
    alignFrames(frames, 'top');
    expect(frames.map((x) => x.y)).toEqual([10, 10, 10]);
    alignFrames(frames, 'vcenter');
    expect(frames.map((x) => x.y)).toEqual([20, 10, 15]);
    distributeFrames(frames, 'x');
    // span 10..320 = 310, widths 80, gap (310-80)/2 = 115 -> middle at 30+115 = 145
    expect(frames.map((x) => x.x)).toEqual([10, 145, 300]);
    expect(boundsOf(frames)).toEqual(f(10, 10, 310, 40));
  });

  it('keeps working on repeated align clicks with a fixed reference', () => {
    const frames = [f(304, 514, 60, 60), f(233, 517, 60, 60)];
    const ref = boundsOf(frames);
    alignFrames(frames, 'left', ref);
    expect(frames.map((x) => x.x)).toEqual([233, 233]);
    alignFrames(frames, 'right', ref);
    expect(frames.map((x) => x.x)).toEqual([304, 304]);
    alignFrames(frames, 'hcenter', ref);
    expect(frames.map((x) => x.x)).toEqual([269, 269]);
    alignFrames(frames, 'bottom', ref);
    expect(frames.map((x) => x.y)).toEqual([517, 517]);
  });
});
