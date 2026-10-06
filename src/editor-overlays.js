// Editor-only drawings on top of the skin preview: checkerboard, grid, safe area, FlipPad cover,
// touch areas, selection, smart guides and the marquee. Never exported.
// All functions draw in points; `viewScale` (screen px per point) keeps strokes 1px-sharp.

import { roundRect } from './render.js';
import { boundsOf } from './snap.js';

const HANDLE_SIZE = 10; // screen pixels
const LABEL_FONT = '600 12px -apple-system, "Segoe UI", sans-serif';
const SELECTION_COLOR = '#3a8bff';
const GUIDE_COLOR = '#ff2d95';
const GRID_MAJOR_EVERY = 4;
const GRID_MIN_SCREEN_PX = 3;
// Dynamic Island hint in portrait (points).
const ISLAND = { width: 126, height: 37, top: 11 };

function drawChecker(ctx, w, h, size) {
  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b8b8b8';
  for (let y = 0; y < h; y += size) {
    for (let x = (y / size) % 2 ? size : 0; x < w; x += size * 2) ctx.fillRect(x, y, size, size);
  }
}

function drawScreenLabels(ctx, orient) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  orient.screens.forEach((s, i) => {
    const f = s.outputFrame;
    const count = (s.filters || []).length;
    const filters = count ? ` · ${count} filter${count === 1 ? '' : 's'}` : '';
    ctx.fillText(`SCREEN ${i + 1}  ${f.width}×${f.height}${filters}`, f.x + f.width / 2, f.y + f.height / 2);
  });
  ctx.restore();
}

function gridLines(ctx, size, length, span, vertical, major) {
  for (let i = 1; i * size < length; i++) {
    if ((i % GRID_MAJOR_EVERY === 0) !== major) continue;
    const at = i * size;
    if (vertical) {
      ctx.moveTo(at, 0);
      ctx.lineTo(at, span);
    } else {
      ctx.moveTo(0, at);
      ctx.lineTo(span, at);
    }
  }
}

function drawGrid(ctx, mappingSize, size, viewScale) {
  if (!(size > 0) || size * viewScale < GRID_MIN_SCREEN_PX) return;
  const { width, height } = mappingSize;
  ctx.save();
  ctx.lineWidth = 1 / viewScale;
  for (const [major, color] of [[false, 'rgba(120, 200, 255, 0.18)'], [true, 'rgba(120, 200, 255, 0.4)']]) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    gridLines(ctx, size, width, height, true, major);
    gridLines(ctx, size, height, width, false, major);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSafeArea(ctx, device, orientation, mappingSize) {
  const safe = device.safe[orientation];
  const { width, height } = mappingSize;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 200, 0, 0.18)';
  if (orientation === 'landscape') {
    ctx.fillRect(0, 0, safe.left, height);
    ctx.fillRect(width - safe.right, 0, safe.right, height);
    ctx.fillRect(0, height - safe.bottom, width, safe.bottom);
    ctx.restore();
    return;
  }
  ctx.fillRect(0, 0, width, safe.top);
  ctx.fillRect(0, height - safe.bottom, width, safe.bottom);
  if (device.family === 'edgeToEdge' && safe.top > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    roundRect(ctx, width / 2 - ISLAND.width / 2, ISLAND.top, ISLAND.width, ISLAND.height, ISLAND.height / 2);
    ctx.fill();
  }
  ctx.restore();
}

// Hatched area hidden under the FlipPad controller, from `top` to the bottom of the skin.
function drawFlipPadCover(ctx, top, mappingSize, viewScale) {
  const { width } = mappingSize;
  const h = mappingSize.height - top;
  if (h <= 0) return;
  ctx.save();
  ctx.fillStyle = 'rgba(20, 20, 24, 0.55)';
  ctx.fillRect(0, top, width, h);
  ctx.beginPath();
  ctx.rect(0, top, width, h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let x = -h; x < width; x += 22) {
    ctx.moveTo(x, top + h);
    ctx.lineTo(x + h, top);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 170, 60, 0.9)';
  ctx.lineWidth = 1.5 / viewScale;
  ctx.setLineDash([6 / viewScale, 4 / viewScale]);
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(width, top);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 190, 90, 0.95)';
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.fillText('Covered by the FlipPad', width / 2, top + 22);
  ctx.restore();
}

// Red fill = item frame, dashed outline = frame plus extendedEdges (the real touch area).
function drawTouchAreas(ctx, orient, viewScale) {
  ctx.save();
  ctx.lineWidth = 1 / viewScale;
  for (const item of orient.items) {
    const f = item.frame;
    const e = { ...orient.extendedEdges, ...(item.extendedEdges || {}) };
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(f.x - e.left, f.y - e.top, f.width + e.left + e.right, f.height + e.top + e.bottom);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.28)';
    ctx.fillRect(f.x, f.y, f.width, f.height);
  }
  ctx.restore();
}

// One frame gets a resize handle; several get a dashed group box instead.
function drawSelection(ctx, frames, viewScale) {
  if (!frames.length) return;
  const px = 1 / viewScale;
  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 2 * px;
  for (const f of frames) ctx.strokeRect(f.x, f.y, f.width, f.height);
  if (frames.length > 1) {
    const b = boundsOf(frames);
    ctx.lineWidth = px;
    ctx.setLineDash([5 * px, 4 * px]);
    ctx.strokeRect(b.x - 3 * px, b.y - 3 * px, b.width + 6 * px, b.height + 6 * px);
    ctx.restore();
    return;
  }
  const f = frames[0];
  const hs = HANDLE_SIZE * px;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(f.x + f.width - hs / 2, f.y + f.height - hs / 2, hs, hs);
  ctx.strokeRect(f.x + f.width - hs / 2, f.y + f.height - hs / 2, hs, hs);
  ctx.restore();
}

function drawGuides(ctx, guides, viewScale) {
  if (!guides.length) return;
  ctx.save();
  ctx.strokeStyle = GUIDE_COLOR;
  ctx.lineWidth = 1.5 / viewScale;
  ctx.beginPath();
  for (const g of guides) {
    if (g.axis === 'x') {
      ctx.moveTo(g.pos, g.from);
      ctx.lineTo(g.pos, g.to);
    } else {
      ctx.moveTo(g.from, g.pos);
      ctx.lineTo(g.to, g.pos);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawMarquee(ctx, rect, viewScale) {
  ctx.save();
  ctx.fillStyle = 'rgba(58, 139, 255, 0.12)';
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1 / viewScale;
  ctx.setLineDash([4 / viewScale, 3 / viewScale]);
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

export {
  HANDLE_SIZE,
  drawChecker,
  drawScreenLabels,
  drawGrid,
  drawSafeArea,
  drawFlipPadCover,
  drawTouchAreas,
  drawSelection,
  drawGuides,
  drawMarquee,
};
