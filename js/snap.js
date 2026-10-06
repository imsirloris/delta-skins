// Alignment helpers for the editor: smart guides, grid snapping, align and distribute.
// Pure functions over frames ({x, y, width, height} in points) so Node scripts can test them.
(function (root) {
  'use strict';

  const AXES = {
    x: { pos: 'x', size: 'width', cross: 'y', crossSize: 'height' },
    y: { pos: 'y', size: 'height', cross: 'x', crossSize: 'width' },
  };

  // Start / center / end lines of a frame along one axis.
  function lines(f, axis) {
    const { pos, size } = AXES[axis];
    return [f[pos], f[pos] + f[size] / 2, f[pos] + f[size]];
  }

  function boundsOf(frames) {
    const x = Math.min(...frames.map((f) => f.x));
    const y = Math.min(...frames.map((f) => f.y));
    const right = Math.max(...frames.map((f) => f.x + f.width));
    const bottom = Math.max(...frames.map((f) => f.y + f.height));
    return { x, y, width: right - x, height: bottom - y };
  }

  // Snap one axis. Returns { delta, guide } where guide is null when nothing matched.
  function snapAxis(rect, targets, axis, opts) {
    const moving = lines(rect, axis);
    const candidates = opts.edges === 'resize' ? [moving[2]] : moving;
    let best = null;

    if (opts.guides !== false) {
      const canvasSize = axis === 'x' ? opts.bounds.width : opts.bounds.height;
      const targetLines = [];
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
      const { cross, crossSize } = AXES[axis];
      const snapped = { ...rect, [AXES[axis].pos]: rect[AXES[axis].pos] + best.delta };
      let from = snapped[cross];
      let to = snapped[cross] + snapped[crossSize];
      for (const t of targets) {
        if (lines(t, axis).some((v) => Math.abs(v - best.at) < 0.5)) {
          from = Math.min(from, t[cross]);
          to = Math.max(to, t[cross] + t[crossSize]);
        }
      }
      const canvasSize = axis === 'x' ? opts.bounds.width : opts.bounds.height;
      const canvasCross = axis === 'x' ? opts.bounds.height : opts.bounds.width;
      if ([0, canvasSize / 2, canvasSize].some((v) => Math.abs(v - best.at) < 0.5)) {
        from = 0;
        to = canvasCross;
      }
      return { delta: best.delta, guide: { axis, pos: best.at, from, to } };
    }

    if (opts.grid > 0) {
      const edge = candidates[0];
      return { delta: Math.round(edge / opts.grid) * opts.grid - edge, guide: null };
    }
    return { delta: 0, guide: null };
  }

  // rect: frame being moved/resized. targets: frames to align against.
  // opts: { threshold, bounds: {width, height}, grid (0 = off), guides (bool), edges: 'move' | 'resize' }
  function computeSnap(rect, targets, opts) {
    const o = { edges: 'move', grid: 0, guides: true, ...opts };
    const x = snapAxis(rect, targets, 'x', o);
    const y = snapAxis(rect, targets, 'y', o);
    return { dx: x.delta, dy: y.delta, guides: [x.guide, y.guide].filter(Boolean) };
  }

  // Mutates frames so they share an edge or center with `reference` (default: the selection's
  // bounding box). Pass the box from before the first align so repeated clicks keep working
  // once same-sized frames are stacked.
  function alignFrames(frames, mode, reference) {
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
  function distributeFrames(frames, axis) {
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

  const api = { computeSnap, alignFrames, distributeFrames, boundsOf };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeltaSnap = api;
})(typeof window !== 'undefined' ? window : globalThis);
