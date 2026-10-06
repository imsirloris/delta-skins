// Canvas editor: preview, multi-selection, drag-to-move with smart guides/grid, marquee
// selection, corner-resize and keyboard nudging. Overlay drawing lives in editor-overlays.js.

import { renderSkin } from './render.js';
import { computeSnap, boundsOf } from './snap.js';
import { refKey, containsRef, toggleRef, resolveRef, selectableRefs } from './refs.js';
import * as Overlays from './editor-overlays.js';
import { flipPadCoverTop } from './layout.js';

const SNAP_PX = 6; // snap distance in screen pixels
const MIN_SIZE = 8; // smallest frame side when resizing (points)
const NUDGE = 1; // arrow key step (points)
const NUDGE_FAST = 10; // Shift+arrow step without grid snapping
const CANVAS_MARGIN = 24; // screen pixels kept free around the canvas
const CHECKER_PX = 12;
const ROUND_SHAPES = ['circle', 'dpad', 'stick'];
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

const isAdditive = (e) => e.shiftKey || e.ctrlKey || e.metaKey;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

class Editor {
  // app: { state, ui, images, current(), select(refs), changed(opts), removeSelected() }
  constructor(canvas, wrap, app) {
    this.canvas = canvas;
    this.wrap = wrap;
    this.app = app;
    this.viewScale = 1;
    this.drag = null;
    this.guides = [];
    this.onCursor = null;

    canvas.addEventListener('pointerdown', (e) => this.pointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.pointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.pointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this.pointerUp(e));
    canvas.addEventListener('keydown', (e) => this.keyDown(e));
    new ResizeObserver(() => this.render()).observe(wrap);
  }

  // ---- geometry -------------------------------------------------------

  toPoints(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / this.viewScale, y: (e.clientY - rect.top) / this.viewScale };
  }

  frameOf(ref) {
    const resolved = resolveRef(this.app.current(), ref);
    return resolved ? resolved.frame : null;
  }

  selection() {
    return this.app.ui.selection || [];
  }

  selectedFrames() {
    return this.selection().map((r) => this.frameOf(r)).filter(Boolean);
  }

  // Single selected frame (resize handle only exists then).
  singleFrame() {
    const frames = this.selectedFrames();
    return frames.length === 1 ? frames[0] : null;
  }

  // Frames to align against: everything not being dragged.
  snapTargets() {
    const selection = this.selection();
    return selectableRefs(this.app.current())
      .filter((r) => !containsRef(selection, r))
      .map((r) => this.frameOf(r));
  }

  hitHandle(p) {
    const f = this.singleFrame();
    if (!f) return false;
    const tolerance = Overlays.HANDLE_SIZE / this.viewScale;
    return Math.abs(p.x - (f.x + f.width)) <= tolerance && Math.abs(p.y - (f.y + f.height)) <= tolerance;
  }

  // Topmost element under the point: buttons first (drawn on top), then screens.
  hitTest(p) {
    const orient = this.app.current();
    const inside = (f) => p.x >= f.x && p.x <= f.x + f.width && p.y >= f.y && p.y <= f.y + f.height;
    const item = [...orient.items].reverse().find((i) => i.kind !== 'touch' && inside(i.frame));
    if (item) return { type: 'item', id: item.id };
    const index = orient.screens.map((s) => s.outputFrame).findLastIndex(inside);
    return index >= 0 ? { type: 'screen', index } : null;
  }

  // null when snapping is off (Alt held, or neither guides nor grid snapping enabled).
  snapOptions(e, edges) {
    const ui = this.app.ui;
    const guides = ui.guides !== false;
    const grid = ui.grid && ui.grid.snap ? ui.grid.size : 0;
    if (e.altKey || (!guides && !grid)) return null;
    return {
      threshold: SNAP_PX / this.viewScale,
      bounds: this.app.current().mappingSize,
      grid,
      guides,
      edges,
    };
  }

  // ---- pointer interaction --------------------------------------------

  pointerDown(e) {
    if (!this.app.current()) return;
    this.canvas.focus();
    const p = this.toPoints(e);
    const additive = isAdditive(e);

    if (!additive && this.hitHandle(p)) {
      this.beginDrag(e, { mode: 'resize', start: p, orig: { ...this.singleFrame() } });
      return;
    }
    const hit = this.hitTest(p);
    if (hit && additive) {
      this.app.select(toggleRef(this.selection(), hit));
      return;
    }
    if (hit) {
      this.beginMove(e, p, hit);
      return;
    }
    this.beginMarquee(e, p, additive);
  }

  beginDrag(e, drag) {
    this.drag = drag;
    this.canvas.setPointerCapture(e.pointerId);
  }

  beginMove(e, p, hit) {
    if (!containsRef(this.selection(), hit)) this.app.select([hit]);
    const frames = this.selectedFrames();
    this.beginDrag(e, { mode: 'move', start: p, origs: frames.map((f) => ({ f, orig: { ...f } })), bounds: boundsOf(frames) });
  }

  beginMarquee(e, p, additive) {
    const base = additive ? [...this.selection()] : [];
    if (!additive) this.app.select([]);
    this.beginDrag(e, { mode: 'marquee', start: p, current: p, base });
  }

  pointerMove(e) {
    const p = this.toPoints(e);
    if (this.onCursor) this.onCursor(p);
    if (!this.drag) {
      this.canvas.style.cursor = this.hitHandle(p) ? 'nwse-resize' : this.hitTest(p) ? 'move' : 'default';
      return;
    }
    if (this.drag.mode === 'move') this.dragMove(p, e);
    else if (this.drag.mode === 'resize') this.dragResize(p, e);
    else this.dragMarquee(p);
  }

  dragMove(p, e) {
    const { start, origs, bounds } = this.drag;
    const ms = this.app.current().mappingSize;
    let dx = p.x - start.x;
    let dy = p.y - start.y;
    this.guides = [];
    const opts = this.snapOptions(e, 'move');
    if (opts) {
      const moved = { ...bounds, x: bounds.x + dx, y: bounds.y + dy };
      const snap = computeSnap(moved, this.snapTargets(), opts);
      dx += snap.dx;
      dy += snap.dy;
      this.guides = snap.guides;
    }
    dx = clamp(Math.round(dx), -bounds.x, ms.width - (bounds.x + bounds.width));
    dy = clamp(Math.round(dy), -bounds.y, ms.height - (bounds.y + bounds.height));
    for (const { f, orig } of origs) {
      f.x = orig.x + dx;
      f.y = orig.y + dy;
    }
    this.app.changed({ geometryOnly: true });
  }

  dragResize(p, e) {
    const frame = this.singleFrame();
    const { orig, start } = this.drag;
    const ms = this.app.current().mappingSize;
    const dx = Math.round(p.x - start.x);
    const dy = Math.round(p.y - start.y);
    const size = this.keepAspect(e)
      ? this.aspectResize(orig, dx, dy, ms)
      : this.snappedResize(orig, dx, dy, ms, e);
    if (!size) return;
    frame.width = size.width;
    frame.height = size.height;
    this.app.changed({ geometryOnly: true });
  }

  // Resize keeping the original ratio; null when the result would leave the skin.
  aspectResize(orig, dx, dy, ms) {
    this.guides = [];
    const ratio = orig.width / orig.height;
    let width = clamp(orig.width + dx, MIN_SIZE, ms.width - orig.x);
    let height = clamp(orig.height + dy, MIN_SIZE, ms.height - orig.y);
    if (Math.abs(dx) >= Math.abs(dy)) height = Math.round(width / ratio);
    else width = Math.round(height * ratio);
    if (orig.x + width > ms.width || orig.y + height > ms.height) return null;
    return { width, height };
  }

  snappedResize(orig, dx, dy, ms, e) {
    this.guides = [];
    let width = clamp(orig.width + dx, MIN_SIZE, ms.width - orig.x);
    let height = clamp(orig.height + dy, MIN_SIZE, ms.height - orig.y);
    const opts = this.snapOptions(e, 'resize');
    if (!opts) return { width, height };
    const snap = computeSnap({ x: orig.x, y: orig.y, width, height }, this.snapTargets(), opts);
    width = clamp(Math.round(width + snap.dx), MIN_SIZE, ms.width - orig.x);
    height = clamp(Math.round(height + snap.dy), MIN_SIZE, ms.height - orig.y);
    this.guides = snap.guides;
    return { width, height };
  }

  dragMarquee(p) {
    this.drag.current = p;
    const box = this.marqueeRect();
    const base = this.drag.base;
    const hits = selectableRefs(this.app.current()).filter((r) => intersects(this.frameOf(r), box));
    const baseKeys = new Set(base.map(refKey));
    this.app.select([...base, ...hits.filter((r) => !baseKeys.has(refKey(r)))]);
  }

  marqueeRect() {
    const { start, current } = this.drag;
    return {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    };
  }

  // Screens and round buttons keep their aspect ratio (unless Shift), others only with Shift.
  keepAspect(e) {
    const selection = this.selection();
    if (selection.length !== 1) return false;
    const resolved = resolveRef(this.app.current(), selection[0]);
    const isRound = Boolean(resolved && resolved.item && ROUND_SHAPES.includes(resolved.item.shape));
    return (selection[0].type === 'screen' || isRound) !== e.shiftKey;
  }

  pointerUp(e) {
    if (!this.drag) return;
    const mode = this.drag.mode;
    this.drag = null;
    this.guides = [];
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (mode === 'marquee') this.render();
    else this.app.changed({});
  }

  // ---- keyboard ---------------------------------------------------------

  keyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      this.app.select(selectableRefs(this.app.current()).filter((r) => r.type === 'item'));
      return;
    }
    if (e.key === 'Escape') {
      this.app.select([]);
      return;
    }
    const frames = this.selectedFrames();
    if (!frames.length) return;
    if (ARROWS[e.key]) {
      e.preventDefault();
      this.nudge(frames, ARROWS[e.key], this.nudgeStep(e));
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.app.removeSelected();
    }
  }

  nudgeStep(e) {
    if (!e.shiftKey) return NUDGE;
    const grid = this.app.ui.grid;
    return grid && grid.snap ? grid.size : NUDGE_FAST;
  }

  // Moves the frames as a group, never past the skin's edges.
  nudge(frames, [dirX, dirY], step) {
    const ms = this.app.current().mappingSize;
    const b = boundsOf(frames);
    const dx = clamp(dirX * step, -b.x, ms.width - (b.x + b.width));
    const dy = clamp(dirY * step, -b.y, ms.height - (b.y + b.height));
    for (const f of frames) {
      f.x += dx;
      f.y += dy;
    }
    this.app.changed({});
  }

  // ---- drawing --------------------------------------------------------

  // Sizes the canvas to fit the stage and returns the device-pixel ratio used.
  fitCanvas(mappingSize) {
    const availW = this.wrap.clientWidth - CANVAS_MARGIN;
    const availH = this.wrap.clientHeight - CANVAS_MARGIN;
    this.viewScale = Math.max(0.1, Math.min(availW / mappingSize.width, availH / mappingSize.height));
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.round(mappingSize.width * this.viewScale);
    const cssH = Math.round(mappingSize.height * this.viewScale);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    return dpr;
  }

  render() {
    const orient = this.app.current();
    if (!orient) return;
    const dpr = this.fitCanvas(orient.mappingSize);
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    Overlays.drawChecker(ctx, this.canvas.width, this.canvas.height, CHECKER_PX * dpr);
    const scale = this.viewScale * dpr;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    const { state, ui, images } = this.app;
    renderSkin(ctx, {
      orient,
      orientation: ui.orientation,
      style: state.style,
      bgImage: images[ui.orientation] || null,
      drawControls: orient.drawControls !== false,
      forExport: false,
      title: state.showTitle ? state.name : '',
    });
    this.drawOverlays(ctx, orient);
  }

  drawOverlays(ctx, orient) {
    const { state, ui } = this.app;
    const ms = orient.mappingSize;
    const vs = this.viewScale;
    Overlays.drawScreenLabels(ctx, orient);
    if (ui.grid && ui.grid.show) Overlays.drawGrid(ctx, ms, ui.grid.size, vs);
    if (ui.showSafe) Overlays.drawSafeArea(ctx, state.device, ui.orientation, ms);
    if (state.layoutKind === 'flippad' && ui.orientation === 'portrait') {
      Overlays.drawFlipPadCover(ctx, flipPadCoverTop(state.device), ms, vs);
    }
    if (ui.showDebug) Overlays.drawTouchAreas(ctx, orient, vs);
    Overlays.drawSelection(ctx, this.selectedFrames(), vs);
    Overlays.drawGuides(ctx, this.guides, vs);
    if (this.drag && this.drag.mode === 'marquee') Overlays.drawMarquee(ctx, this.marqueeRect(), vs);
  }
}

export { Editor };
