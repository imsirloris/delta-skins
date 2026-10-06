// Center stage: orientation tabs and the canvas view options (overlays, guides, grid).

import { $ } from '../dom';
import type { AppContext, Orientation, UiState } from '../../types';

interface StageDeps {
  redraw(): void;
  renderAll(): void;
  saveView(): void;
}

const GRID_MIN = 2;
const GRID_MAX = 100;

class StageView {
  context: AppContext;
  deps: StageDeps;

  constructor(context: AppContext, deps: StageDeps) {
    this.context = context;
    this.deps = deps;
  }

  get ui(): UiState {
    return this.context.ui;
  }

  init(): void {
    for (const tab of this.tabs()) {
      tab.addEventListener('click', () => {
        this.ui.orientation = tab.dataset.orientation as Orientation;
        this.ui.selection = [];
        this.deps.renderAll();
      });
    }
    this.bindToggle('view-safe', (on) => (this.ui.showSafe = on), { redraw: true });
    this.bindToggle('view-debug', (on) => (this.ui.showDebug = on), { redraw: true });
    this.bindToggle('view-guides', (on) => (this.ui.guides = on), { persist: true });
    this.bindToggle('view-grid', (on) => (this.ui.grid.show = on), { redraw: true, persist: true });
    this.bindToggle('view-grid-snap', (on) => (this.ui.grid.snap = on), { persist: true });
    const gridSize = $<HTMLInputElement>('view-grid-size');
    gridSize.addEventListener('input', () => {
      const size = Math.round(Number(gridSize.value));
      if (!(size >= GRID_MIN && size <= GRID_MAX)) return;
      this.ui.grid.size = size;
      this.deps.redraw();
      this.deps.saveView();
    });
  }

  tabs(): NodeListOf<HTMLButtonElement> {
    return document.querySelectorAll('.tabs button');
  }

  bindToggle(id: string, apply: (on: boolean) => void, { redraw = false, persist = false }): void {
    const toggle = $<HTMLInputElement>(id);
    toggle.addEventListener('change', () => {
      apply(toggle.checked);
      if (redraw) this.deps.redraw();
      if (persist) this.deps.saveView();
    });
  }

  render(): void {
    for (const tab of this.tabs()) tab.classList.toggle('active', tab.dataset.orientation === this.ui.orientation);
    $('orientation-disabled').hidden = this.context.current().enabled;
    $<HTMLInputElement>('view-safe').checked = this.ui.showSafe;
    $<HTMLInputElement>('view-debug').checked = this.ui.showDebug;
    $<HTMLInputElement>('view-guides').checked = this.ui.guides;
    $<HTMLInputElement>('view-grid').checked = this.ui.grid.show;
    $<HTMLInputElement>('view-grid-snap').checked = this.ui.grid.snap;
    $<HTMLInputElement>('view-grid-size').value = String(this.ui.grid.size);
    this.deps.redraw();
  }
}

export { StageView };
