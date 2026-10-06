// Top bar: undo/redo (buttons and shortcuts), reset, project files, skin import and export.

import * as Exporter from '../../export';
import { slug } from '../../skinjson';
import { $, toast, onFilePicked, errorMessage } from '../dom';
import type { History } from '../history';
import type { ProjectService } from '../project';
import type { AppContext } from '../../types';

interface TopbarDeps {
  service: ProjectService;
  history: History;
  undo(): void;
  redo(): void;
}

const EXPORT_LABEL = 'Export .deltaskin';
const TEXT_INPUT_TYPES = ['text', 'number', 'search'];

// Text fields keep their own native undo.
function isEditingText(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  if (active instanceof HTMLTextAreaElement) return true;
  return active instanceof HTMLInputElement && TEXT_INPUT_TYPES.includes(active.type);
}

class TopbarView {
  context: AppContext;
  deps: TopbarDeps;

  constructor(context: AppContext, deps: TopbarDeps) {
    this.context = context;
    this.deps = deps;
  }

  init(): void {
    this.initHistory();
    $('btn-reset-all').addEventListener('click', () => this.deps.service.resetAll());
    $('btn-export').addEventListener('click', () => this.exportSkin());
    $('btn-info-json').addEventListener('click', () => Exporter.exportInfoJson(this.context.state));
    $('btn-save-project').addEventListener('click', () => this.saveProject());
    onFilePicked($<HTMLInputElement>('input-import-skin'), (file) => this.importSkin(file));
    onFilePicked($<HTMLInputElement>('input-open-project'), (file) => this.openProject(file));
  }

  initHistory(): void {
    $('btn-undo').addEventListener('click', () => this.deps.undo());
    $('btn-redo').addEventListener('click', () => this.deps.redo());
    document.addEventListener('keydown', (e) => this.historyShortcut(e));
  }

  // Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo.
  historyShortcut(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey) || isEditingText()) return;
    const key = e.key.toLowerCase();
    const isUndo = key === 'z' && !e.shiftKey;
    const isRedo = (key === 'z' && e.shiftKey) || key === 'y';
    if (!isUndo && !isRedo) return;
    e.preventDefault();
    if (isUndo) this.deps.undo();
    else this.deps.redo();
  }

  renderHistoryButtons(): void {
    $<HTMLButtonElement>('btn-undo').disabled = !this.deps.history.canUndo;
    $<HTMLButtonElement>('btn-redo').disabled = !this.deps.history.canRedo;
  }

  async exportSkin(): Promise<void> {
    const state = this.context.state;
    if (!state.orientations.portrait.enabled && !state.orientations.landscape.enabled) {
      toast('Enable at least one orientation.');
      return;
    }
    const btn = $<HTMLButtonElement>('btn-export');
    btn.disabled = true;
    btn.textContent = 'Generating…';
    try {
      await Exporter.exportDeltaSkin(state, this.context.images);
      toast('Skin exported. Open the .deltaskin on your iPhone (Files or AirDrop) to add it to Delta.');
    } catch (err) {
      console.error(err);
      toast(`Export failed: ${errorMessage(err)}`);
    } finally {
      btn.disabled = false;
      btn.textContent = EXPORT_LABEL;
    }
  }

  saveProject(): void {
    const state = this.context.state;
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    Exporter.download(blob, `${slug(state.name)}.project.json`);
  }

  async importSkin(file: File): Promise<void> {
    try {
      await this.deps.service.importSkin(file);
    } catch (err) {
      console.error(err);
      toast(`Could not import: ${errorMessage(err)}`);
    }
  }

  async openProject(file: File): Promise<void> {
    try {
      await this.deps.service.openProject(JSON.parse(await file.text()));
      toast('Project loaded.');
    } catch (err) {
      toast(`Could not open: ${errorMessage(err)}`);
    }
  }
}

export { TopbarView };
