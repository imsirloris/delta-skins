// Canvas editor: preview, overlays, multi-selection, drag-to-move with smart guides/grid,
// marquee selection and corner-resize.
(function (root) {
  'use strict';

  const { renderSkin, roundRect } = root.DeltaRender;
  const { computeSnap, boundsOf } = root.DeltaSnap;
  const HANDLE = 10; // screen pixels
  const SNAP_PX = 6; // snap distance in screen pixels

  const refKey = (ref) => (ref.type === 'item' ? `i:${ref.id}` : `s:${ref.index}`);

  class Editor {
    // app: { state, ui, images, current(), select(refs), changed(), removeSelected() }
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
      const orient = this.app.current();
      if (ref.type === 'item') {
        const item = orient.items.find((i) => i.id === ref.id);
        return item ? item.frame : null;
      }
      const screen = orient.screens[ref.index];
      return screen ? screen.outputFrame : null;
    }

    selection() {
      return this.app.ui.selection || [];
    }

    isSelected(ref) {
      const key = refKey(ref);
      return this.selection().some((r) => refKey(r) === key);
    }

    selectedFrames() {
      return this.selection().map((r) => this.frameOf(r)).filter(Boolean);
    }

    // Single selected frame (resize handle only exists then).
    singleFrame() {
      const frames = this.selectedFrames();
      return frames.length === 1 ? frames[0] : null;
    }

    allRefs() {
      const orient = this.app.current();
      const refs = orient.items.filter((i) => i.kind !== 'touch').map((i) => ({ type: 'item', id: i.id }));
      orient.screens.forEach((_, index) => refs.push({ type: 'screen', index }));
      return refs;
    }

    // Frames to align against: everything not being dragged.
    snapTargets() {
      return this.allRefs().filter((r) => !this.isSelected(r)).map((r) => this.frameOf(r));
    }

    hitHandle(p) {
      const f = this.singleFrame();
      if (!f) return false;
      const tol = HANDLE / this.viewScale;
      return Math.abs(p.x - (f.x + f.width)) <= tol && Math.abs(p.y - (f.y + f.height)) <= tol;
    }

    hitTest(p) {
      const orient = this.app.current();
      const inside = (f) => p.x >= f.x && p.x <= f.x + f.width && p.y >= f.y && p.y <= f.y + f.height;
      for (let i = orient.items.length - 1; i >= 0; i--) {
        const item = orient.items[i];
        if (item.kind !== 'touch' && inside(item.frame)) return { type: 'item', id: item.id };
      }
      for (let i = orient.screens.length - 1; i >= 0; i--) {
        if (inside(orient.screens[i].outputFrame)) return { type: 'screen', index: i };
      }
      return null;
    }

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

    // ---- interaction ----------------------------------------------------

    pointerDown(e) {
      if (!this.app.current()) return;
      this.canvas.focus();
      const p = this.toPoints(e);
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;

      if (!additive && this.hitHandle(p)) {
        this.drag = { mode: 'resize', start: p, orig: { ...this.singleFrame() } };
      } else {
        const hit = this.hitTest(p);
        if (hit && additive) {
          const key = refKey(hit);
          const sel = this.isSelected(hit) ? this.selection().filter((r) => refKey(r) !== key) : [...this.selection(), hit];
          this.app.select(sel);
          return;
        }
        if (hit) {
          if (!this.isSelected(hit)) this.app.select([hit]);
          const frames = this.selectedFrames();
          this.drag = { mode: 'move', start: p, origs: frames.map((f) => ({ f, orig: { ...f } })), bounds: boundsOf(frames) };
        } else {
          const base = additive ? [...this.selection()] : [];
          if (!additive) this.app.select([]);
          this.drag = { mode: 'marquee', start: p, current: p, base };
        }
      }
      this.canvas.setPointerCapture(e.pointerId);
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
      const f = this.singleFrame();
      const { orig, start } = this.drag;
      const ms = this.app.current().mappingSize;
      const dx = Math.round(p.x - start.x);
      const dy = Math.round(p.y - start.y);
      let w = clamp(orig.width + dx, 8, ms.width - orig.x);
      let h = clamp(orig.height + dy, 8, ms.height - orig.y);
      this.guides = [];
      if (this.keepAspect(e)) {
        const ratio = orig.width / orig.height;
        if (Math.abs(dx) >= Math.abs(dy)) h = Math.round(w / ratio);
        else w = Math.round(h * ratio);
        if (orig.x + w > ms.width || orig.y + h > ms.height) return;
      } else {
        const opts = this.snapOptions(e, 'resize');
        if (opts) {
          const snap = computeSnap({ x: orig.x, y: orig.y, width: w, height: h }, this.snapTargets(), opts);
          w = clamp(Math.round(w + snap.dx), 8, ms.width - orig.x);
          h = clamp(Math.round(h + snap.dy), 8, ms.height - orig.y);
          this.guides = snap.guides;
        }
      }
      f.width = w;
      f.height = h;
      this.app.changed({ geometryOnly: true });
    }

    dragMarquee(p) {
      this.drag.current = p;
      const box = this.marqueeRect();
      const hits = this.allRefs().filter((r) => intersects(this.frameOf(r), box));
      const keys = new Set(this.drag.base.map(refKey));
      this.app.select([...this.drag.base, ...hits.filter((r) => !keys.has(refKey(r)))]);
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
      const sel = this.selection();
      if (sel.length !== 1) return false;
      const ref = sel[0];
      const item = ref.type === 'item' ? this.app.current().items.find((i) => i.id === ref.id) : null;
      const isRound = item && ['circle', 'dpad', 'stick'].includes(item.shape);
      return (ref.type === 'screen' || isRound) !== e.shiftKey;
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

    keyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        this.app.select(this.allRefs().filter((r) => r.type === 'item'));
        return;
      }
      if (e.key === 'Escape') {
        this.app.select([]);
        return;
      }
      const frames = this.selectedFrames();
      if (!frames.length) return;
      const grid = this.app.ui.grid;
      const step = e.shiftKey ? (grid && grid.snap ? grid.size : 10) : 1;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        const ms = this.app.current().mappingSize;
        const b = boundsOf(frames);
        const dx = clamp(moves[e.key][0], -b.x, ms.width - (b.x + b.width));
        const dy = clamp(moves[e.key][1], -b.y, ms.height - (b.y + b.height));
        for (const f of frames) {
          f.x += dx;
          f.y += dy;
        }
        this.app.changed({});
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.app.removeSelected();
      }
    }

    // ---- drawing --------------------------------------------------------

    render() {
      const orient = this.app.current();
      const canvas = this.canvas;
      if (!orient) return;
      const ms = orient.mappingSize;
      const availW = this.wrap.clientWidth - 24;
      const availH = this.wrap.clientHeight - 24;
      this.viewScale = Math.max(0.1, Math.min(availW / ms.width, availH / ms.height));
      const dpr = window.devicePixelRatio || 1;
      const cssW = Math.round(ms.width * this.viewScale);
      const cssH = Math.round(ms.height * this.viewScale);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);

      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawChecker(ctx, canvas.width, canvas.height, 12 * dpr);
      const s = this.viewScale * dpr;
      ctx.setTransform(s, 0, 0, s, 0, 0);

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
      this.drawScreenLabels(ctx, orient);
      if (ui.grid && ui.grid.show) this.drawGrid(ctx, orient);
      if (ui.showSafe) this.drawSafeArea(ctx, orient);
      if (state.layoutKind === 'flippad' && ui.orientation === 'portrait') this.drawFlipPadCover(ctx, orient);
      if (ui.showDebug) this.drawTouchAreas(ctx, orient);
      this.drawSelection(ctx);
      this.drawGuides(ctx);
      if (this.drag && this.drag.mode === 'marquee') this.drawMarquee(ctx);
    }

    drawScreenLabels(ctx, orient) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '600 12px -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      orient.screens.forEach((s, i) => {
        const f = s.outputFrame;
        const extra = s.filters && s.filters.length ? ` · ${s.filters.length} filtro(s)` : '';
        ctx.fillText(`TELA ${i + 1}  ${f.width}×${f.height}${extra}`, f.x + f.width / 2, f.y + f.height / 2);
      });
      ctx.restore();
    }

    drawGrid(ctx, orient) {
      const size = this.app.ui.grid.size;
      if (!(size > 0) || size * this.viewScale < 3) return;
      const ms = orient.mappingSize;
      ctx.save();
      ctx.lineWidth = 1 / this.viewScale;
      for (const [strong, color] of [[false, 'rgba(120, 200, 255, 0.18)'], [true, 'rgba(120, 200, 255, 0.4)']]) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        for (let i = 1; i * size < ms.width; i++) {
          if ((i % 4 === 0) !== strong) continue;
          ctx.moveTo(i * size, 0);
          ctx.lineTo(i * size, ms.height);
        }
        for (let i = 1; i * size < ms.height; i++) {
          if ((i % 4 === 0) !== strong) continue;
          ctx.moveTo(0, i * size);
          ctx.lineTo(ms.width, i * size);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    drawSafeArea(ctx, orient) {
      const device = this.app.state.device;
      const safe = device.safe[this.app.ui.orientation];
      const ms = orient.mappingSize;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 200, 0, 0.18)';
      if (this.app.ui.orientation === 'portrait') {
        ctx.fillRect(0, 0, ms.width, safe.top);
        ctx.fillRect(0, ms.height - safe.bottom, ms.width, safe.bottom);
        if (device.family === 'edgeToEdge' && safe.top > 0) {
          // Notch / Dynamic Island hint.
          ctx.fillStyle = 'rgba(0,0,0,0.85)';
          roundRect(ctx, ms.width / 2 - 63, 11, 126, 37, 18.5);
          ctx.fill();
        }
      } else {
        ctx.fillRect(0, 0, safe.left, ms.height);
        ctx.fillRect(ms.width - safe.right, 0, safe.right, ms.height);
        ctx.fillRect(0, ms.height - safe.bottom, ms.width, safe.bottom);
      }
      ctx.restore();
    }

    // Hatched area hidden under the FlipPad controller (editor-only hint, never exported).
    drawFlipPadCover(ctx, orient) {
      const top = root.DeltaLayout.flipPadCoverTop(this.app.state.device);
      const ms = orient.mappingSize;
      const h = ms.height - top;
      if (h <= 0) return;
      ctx.save();
      ctx.fillStyle = 'rgba(20, 20, 24, 0.55)';
      ctx.fillRect(0, top, ms.width, h);
      ctx.beginPath();
      ctx.rect(0, top, ms.width, h);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let x = -h; x < ms.width; x += 22) {
        ctx.moveTo(x, top + h);
        ctx.lineTo(x + h, top);
      }
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 170, 60, 0.9)';
      ctx.lineWidth = 1.5 / this.viewScale;
      ctx.setLineDash([6 / this.viewScale, 4 / this.viewScale]);
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(ms.width, top);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 190, 90, 0.95)';
      ctx.font = '600 12px -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Área coberta pelo FlipPad', ms.width / 2, top + 22);
      ctx.restore();
    }

    drawTouchAreas(ctx, orient) {
      ctx.save();
      for (const item of orient.items) {
        const f = item.frame;
        const e = { ...orient.extendedEdges, ...(item.extendedEdges || {}) };
        ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1 / this.viewScale;
        ctx.strokeRect(f.x - e.left, f.y - e.top, f.width + e.left + e.right, f.height + e.top + e.bottom);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.28)';
        ctx.fillRect(f.x, f.y, f.width, f.height);
      }
      ctx.restore();
    }

    drawSelection(ctx) {
      const frames = this.selectedFrames();
      if (!frames.length) return;
      const px = 1 / this.viewScale;
      ctx.save();
      ctx.strokeStyle = '#3a8bff';
      ctx.lineWidth = 2 * px;
      for (const f of frames) ctx.strokeRect(f.x, f.y, f.width, f.height);
      if (frames.length > 1) {
        const b = boundsOf(frames);
        ctx.lineWidth = px;
        ctx.setLineDash([5 * px, 4 * px]);
        ctx.strokeRect(b.x - 3 * px, b.y - 3 * px, b.width + 6 * px, b.height + 6 * px);
        ctx.setLineDash([]);
      } else {
        const f = frames[0];
        ctx.fillStyle = '#ffffff';
        const hs = HANDLE * px;
        ctx.fillRect(f.x + f.width - hs / 2, f.y + f.height - hs / 2, hs, hs);
        ctx.strokeRect(f.x + f.width - hs / 2, f.y + f.height - hs / 2, hs, hs);
      }
      ctx.restore();
    }

    drawGuides(ctx) {
      if (!this.guides.length) return;
      ctx.save();
      ctx.strokeStyle = '#ff2d95';
      ctx.lineWidth = 1.5 / this.viewScale;
      ctx.beginPath();
      for (const g of this.guides) {
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

    drawMarquee(ctx) {
      const r = this.marqueeRect();
      ctx.save();
      ctx.fillStyle = 'rgba(58, 139, 255, 0.12)';
      ctx.strokeStyle = '#3a8bff';
      ctx.lineWidth = 1 / this.viewScale;
      ctx.setLineDash([4 / this.viewScale, 3 / this.viewScale]);
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.strokeRect(r.x, r.y, r.width, r.height);
      ctx.restore();
    }
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function intersects(a, b) {
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  }

  function drawChecker(ctx, w, h, size) {
    ctx.fillStyle = '#d0d0d0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b8b8b8';
    for (let y = 0; y < h; y += size) {
      for (let x = (y / size) % 2 ? size : 0; x < w; x += size * 2) ctx.fillRect(x, y, size, size);
    }
  }

  root.DeltaEditor = Editor;
})(window);
