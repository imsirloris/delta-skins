// Composition root: builds the shared context, wires storage, history, the project service,
// the canvas editor and the views together, then renders the first frame.

import 'bootstrap/dist/css/bootstrap.min.css';
import '../style.css';
import * as State from './state.js';
import * as Layout from '../layout.js';
import { ProjectStorage, Autosave } from './storage.js';
import { History } from './history.js';
import { ProjectService } from './project.js';
import { loadImages } from './images.js';
import { SidebarView } from './views/sidebar.js';
import { StageView } from './views/stage.js';
import { InspectorView } from './views/inspector.js';
import { TopbarView } from './views/topbar.js';
import { $, toast } from './dom.js';
import { Editor } from '../editor.js';

const storage = new ProjectStorage({
  onQuotaExceeded: () => toast('The image is too large for autosave; use "Save project" to keep the artwork.'),
});

// Everything the editor and the views share. The editor relies on exactly this interface.
const context = {
  state: State.restoreState(storage.loadProject()),
  ui: { orientation: 'portrait', selection: [], alignRef: null, ...storage.loadView(State.defaultView()) },
  images: {},

  current() {
    return this.state.orientations[this.ui.orientation];
  },

  select(refs) {
    this.ui.selection = refs || [];
    this.ui.alignRef = null;
    inspector.renderSelection();
    inspector.renderElementList();
    editor.render();
  },

  // opts: { geometryOnly } while dragging, { fromPanel } for inspector edits, { fromAlign } for align clicks.
  changed(opts = {}) {
    // Any edit other than an align click starts a fresh align reference.
    if (!opts.fromAlign) this.ui.alignRef = null;
    Layout.syncTouch(this.current());
    this.state.layoutEdited = true;
    editor.render();
    if (opts.geometryOnly) inspector.updateFrameFields();
    else if (!opts.fromPanel) inspector.renderSelection();
    inspector.renderElementList();
    autosave.schedule();
  },

  removeSelected() {
    const ids = new Set(this.ui.selection.filter((r) => r.type === 'item').map((r) => r.id));
    if (!ids.size) return;
    const orient = this.current();
    orient.items = orient.items.filter((i) => !ids.has(i.id));
    this.select([]);
    this.changed({});
  },
};

const editor = new Editor($('editor-canvas'), $('canvas-wrap'), context);
editor.onCursor = (p) => {
  $('cursor-pos').textContent = `x ${Math.round(p.x)} · y ${Math.round(p.y)} pt`;
};

// Snapshots leave out background images, which are large.
const history = new History({
  snapshot: () => JSON.stringify({ ...context.state, bgImages: undefined }),
  restore: (snap) => {
    context.state = { ...JSON.parse(snap), bgImages: context.state.bgImages };
    Layout.bumpIds(Object.values(context.state.orientations));
    context.ui.selection = [];
    context.ui.alignRef = null;
    renderAll();
    storage.saveProject(context.state);
  },
  onChange: () => topbar.renderHistoryButtons(),
});

// Each debounced save is one undo step, so a burst of edits (typing, arrow keys) undoes together.
const autosave = new Autosave({
  isBusy: () => Boolean(editor.drag),
  save: () => {
    history.record();
    storage.saveProject(context.state);
  },
});

const commands = {
  redraw: () => editor.render(),
  save: () => autosave.schedule(),
  saveView: () => storage.saveView(context.ui),
  undo: () => {
    autosave.flush();
    history.undo();
  },
  redo: () => {
    autosave.flush();
    history.redo();
  },
};

const service = new ProjectService(context, {
  render: renderAll,
  save: commands.save,
  checkpoint: () => autosave.flush(),
  persist: () => storage.saveProject(context.state),
  resetHistory: () => history.reset(),
  saveView: commands.saveView,
  notify: toast,
  ask: (message) => window.confirm(message),
});

const sidebar = new SidebarView(context, { service, redraw: commands.redraw, save: commands.save, renderStage: () => stage.render() });
const stage = new StageView(context, { redraw: commands.redraw, renderAll, saveView: commands.saveView });
const inspector = new InspectorView(context, { redraw: commands.redraw, save: commands.save });
const topbar = new TopbarView(context, { service, history, undo: commands.undo, redo: commands.redo });

function renderAll() {
  sidebar.render();
  stage.render();
  inspector.render();
}

for (const view of [sidebar, stage, inspector, topbar]) view.init();
history.reset();
loadImages(context.state.bgImages).then((images) => {
  context.images = images;
  renderAll();
});
