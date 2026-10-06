// Top bar: undo/redo (buttons and shortcuts), reset, project files, skin import and export.
(function (root) {
  'use strict';

  const Exporter = root.DeltaExport;
  const { slug } = root.DeltaSkinJson;
  const { $, toast, onFilePicked } = root.DeltaDom;

  const EXPORT_LABEL = 'Export .deltaskin';
  const TEXT_INPUT_TYPES = ['text', 'number', 'search'];

  // Text fields keep their own native undo.
  function isEditingText() {
    const active = document.activeElement;
    if (!active) return false;
    if (active.tagName === 'TEXTAREA') return true;
    return active.tagName === 'INPUT' && TEXT_INPUT_TYPES.includes(active.type);
  }

  class TopbarView {
    // deps: { service, history, undo(), redo() }
    constructor(context, deps) {
      this.context = context;
      this.deps = deps;
    }

    init() {
      this.initHistory();
      $('btn-reset-all').addEventListener('click', () => this.deps.service.resetAll());
      $('btn-export').addEventListener('click', () => this.exportSkin());
      $('btn-info-json').addEventListener('click', () => Exporter.exportInfoJson(this.context.state));
      $('btn-save-project').addEventListener('click', () => this.saveProject());
      onFilePicked($('input-import-skin'), (file) => this.importSkin(file));
      onFilePicked($('input-open-project'), (file) => this.openProject(file));
    }

    initHistory() {
      $('btn-undo').addEventListener('click', () => this.deps.undo());
      $('btn-redo').addEventListener('click', () => this.deps.redo());
      document.addEventListener('keydown', (e) => this.historyShortcut(e));
    }

    // Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo.
    historyShortcut(e) {
      if (!(e.ctrlKey || e.metaKey) || isEditingText()) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) return;
      e.preventDefault();
      if (isUndo) this.deps.undo();
      else this.deps.redo();
    }

    renderHistoryButtons() {
      $('btn-undo').disabled = !this.deps.history.canUndo;
      $('btn-redo').disabled = !this.deps.history.canRedo;
    }

    async exportSkin() {
      const state = this.context.state;
      if (!state.orientations.portrait.enabled && !state.orientations.landscape.enabled) {
        toast('Enable at least one orientation.');
        return;
      }
      const btn = $('btn-export');
      btn.disabled = true;
      btn.textContent = 'Generating…';
      try {
        await Exporter.exportDeltaSkin(state, this.context.images);
        toast('Skin exported. Open the .deltaskin on your iPhone (Files or AirDrop) to add it to Delta.');
      } catch (err) {
        console.error(err);
        toast(`Export failed: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = EXPORT_LABEL;
      }
    }

    saveProject() {
      const state = this.context.state;
      const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
      Exporter.download(blob, `${slug(state.name)}.project.json`);
    }

    async importSkin(file) {
      try {
        await this.deps.service.importSkin(file);
      } catch (err) {
        console.error(err);
        toast(`Could not import: ${err.message}`);
      }
    }

    async openProject(file) {
      try {
        await this.deps.service.openProject(JSON.parse(await file.text()));
        toast('Project loaded.');
      } catch (err) {
        toast(`Could not open: ${err.message}`);
      }
    }
  }

  root.DeltaViews = { ...root.DeltaViews, TopbarView };
})(window);
