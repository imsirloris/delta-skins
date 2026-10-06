// Alignment helpers for the editor: smart guides, grid snapping, align and distribute.
// Pure functions over frames ({x, y, width, height} in points) so Node scripts can test them.

import type { Frame, Size } from './types';

export type Axis = 'x' | 'y';
export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export interface Guide {
  axis: Axis;
  pos: number;
  from: number;
  to: number;
}

export interface SnapOptions {
  threshold: number;
  bounds: Size;
  grid?: number; // 0 = off
  guides?: boolean;
  edges?: 'move' | 'resize';
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

interface AxisKeys {
  pos: 'x' | 'y';
  size: 'width' | 'height';
  cross: 'x' | 'y';
  crossSize: 'width' | 'height';
}

const AXES: Record<Axis, AxisKeys> = {
  x: { pos: 'x', size: 'width', cross: 'y', crossSize: 'height' },
  y: { pos: 'y', size: 'height', cross: 'x', crossSize: 'width' },
};

// Start / center / end lines of a frame along one axis.
function lines(f: Frame, axis: Axis): number[] {
  const { pos, size } = AXES[axis];
  return [f[pos], f[pos] + f[size] / 2, f[pos] + f[size]];
}

function boundsOf(frames: Frame[]): Frame {
  const x = Math.min(...frames.map((f) => f.x));
  const y = Math.min(...frames.map((f) => f.y));
  const right = Math.max(...frames.map((f) => f.x + f.width));
  const bottom = Math.max(...frames.map((f) => f.y + f.height));
  return { x, y, width: right - x, height: bottom - y };
}

// Snap one axis. Returns { delta, guide } where guide is null when nothing matched.
function snapAxis(rect: Frame, targets: Frame[], axis: Axis, opts: Required<SnapOptions>): { delta: number; guide: Guide | null } {
  const moving = lines(rect, axis);
  const candidates = opts.edges === 'resize' ? [moving[2]] : moving;
  let best: { delta: number; at: number } | null = null;

  if (opts.guides !== false) {
    const canvasSize = axis === 'x' ? opts.bounds.width : opts.bounds.height;
    const targetLines: { v: number; frame: Frame | null }[] = [];
    for (const t of targets) for (const v of lines(t, axis)) targetLines.push({ v, frame: t });
    for (const v of [0, canvasSize / 2, canvasSize]) targetLines.push({ v, frame: null });

    for (const m of candidates) {
      for (const t of targetLines) {
        const d = t.v - m;
        if (Math.abs(d) <= opts.threshold && (!best || Math.abs(d) < Math.abs(best.delta))) {
          best = { delta: d, at: t.v };
        }
      }
    }
  }

  if (best) {
    // Every target touching the snapped line contributes to the guide's extent.
    const { at } = best;
    const { pos, cross, crossSize } = AXES[axis];
    const snapped = { ...rect, [pos]: rect[pos] + best.delta };
    let from = snapped[cross];
    let to = snapped[cross] + snapped[crossSize];
    for (const t of targets) {
      if (lines(t, axis).some((v) => Math.abs(v - at) < 0.5)) {
        from = Math.min(from, t[cross]);
        to = Math.max(to, t[cross] + t[crossSize]);
      }
    }
    const canvasSize = axis === 'x' ? opts.bounds.width : opts.bounds.height;
    const canvasCross = axis === 'x' ? opts.bounds.height : opts.bounds.width;
    if ([0, canvasSize / 2, canvasSize].some((v) => Math.abs(v - at) < 0.5)) {
      from = 0;
      to = canvasCross;
    }
    return { delta: best.delta, guide: { axis, pos: at, from, to } };
  }

  if (opts.grid > 0) {
    const edge = candidates[0];
    return { delta: Math.round(edge / opts.grid) * opts.grid - edge, guide: null };
  }
  return { delta: 0, guide: null };
}

// rect: frame being moved/resized. targets: frames to align against.
function computeSnap(rect: Frame, targets: Frame[], opts: SnapOptions): SnapResult {
  const o: Required<SnapOptions> = { edges: 'move', grid: 0, guides: true, ...opts };
  const x = snapAxis(rect, targets, 'x', o);
  const y = snapAxis(rect, targets, 'y', o);
  return { dx: x.delta, dy: y.delta, guides: [x.guide, y.guide].filter((g) => g !== null) };
}

// Mutates frames so they share an edge or center with `reference` (default: the selection's
// bounding box). Pass the box from before the first align so repeated clicks keep working
// once same-sized frames are stacked.
function alignFrames(frames: Frame[], mode: AlignMode, reference?: Frame | null): void {
  const b = reference || boundsOf(frames);
  for (const f of frames) {
    if (mode === 'left') f.x = b.x;
    else if (mode === 'hcenter') f.x = Math.round(b.x + (b.width - f.width) / 2);
    else if (mode === 'right') f.x = b.x + b.width - f.width;
    else if (mode === 'top') f.y = b.y;
    else if (mode === 'vcenter') f.y = Math.round(b.y + (b.height - f.height) / 2);
    else if (mode === 'bottom') f.y = b.y + b.height - f.height;
  }
}

// Equal gaps between frames along an axis; the first and last frames stay put.
function distributeFrames(frames: Frame[], axis: Axis): void {
  if (frames.length < 3) return;
  const { pos, size } = AXES[axis];
  const sorted = [...frames].sort((a, b) => a[pos] - b[pos]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last[pos] + last[size] - first[pos];
  const used = sorted.reduce((sum, f) => sum + f[size], 0);
  const gap = (span - used) / (sorted.length - 1);
  let cursor = first[pos] + first[size] + gap;
  for (const f of sorted.slice(1, -1)) {
    f[pos] = Math.round(cursor);
    cursor += f[size] + gap;
  }
}

export { computeSnap, alignFrames, distributeFrames, boundsOf };
