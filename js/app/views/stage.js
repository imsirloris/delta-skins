// Center stage: orientation tabs and the canvas view options (overlays, guides, grid).
(function (root) {
  'use strict';

  const { $ } = root.DeltaDom;

  const GRID_MIN = 2;
  const GRID_MAX = 100;

  class StageView {
    // deps: { redraw(), renderAll(), saveView() }
    constructor(context, deps) {
      this.context = context;
      this.deps = deps;
    }

    get ui() {
      return this.context.ui;
    }

    init() {
      for (const tab of this.tabs()) {
        tab.addEventListener('click', () => {
          this.ui.orientation = tab.dataset.orientation;
          this.ui.selection = [];
          this.deps.renderAll();
        });
      }
      this.bindToggle('view-safe', (on) => (this.ui.showSafe = on), { redraw: true });
      this.bindToggle('view-debug', (on) => (this.ui.showDebug = on), { redraw: true });
      this.bindToggle('view-guides', (on) => (this.ui.guides = on), { persist: true });
      this.bindToggle('view-grid', (on) => (this.ui.grid.show = on), { redraw: true, persist: true });
      this.bindToggle('view-grid-snap', (on) => (this.ui.grid.snap = on), { persist: true });
      $('view-grid-size').addEventListener('input', (e) => {
        const size = Math.round(Number(e.target.value));
        if (!(size >= GRID_MIN && size <= GRID_MAX)) return;
        this.ui.grid.size = size;
        this.deps.redraw();
        this.deps.saveView();
      });
    }

    tabs() {
      return document.querySelectorAll('.tabs button');
    }

    bindToggle(id, apply, { redraw = false, persist = false }) {
      $(id).addEventListener('change', (e) => {
        apply(e.target.checked);
        if (redraw) this.deps.redraw();
        if (persist) this.deps.saveView();
      });
    }

    render() {
      for (const tab of this.tabs()) tab.classList.toggle('active', tab.dataset.orientation === this.ui.orientation);
      $('orientation-disabled').hidden = this.context.current().enabled;
      $('view-safe').checked = this.ui.showSafe;
      $('view-debug').checked = this.ui.showDebug;
      $('view-guides').checked = this.ui.guides;
      $('view-grid').checked = this.ui.grid.show;
      $('view-grid-snap').checked = this.ui.grid.snap;
      $('view-grid-size').value = this.ui.grid.size;
      this.deps.redraw();
    }
  }

  root.DeltaViews = { ...root.DeltaViews, StageView };
})(window);
