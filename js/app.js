// App state + UI wiring.
(function (root) {
  'use strict';

  const { DEVICES, getDevice, customDevice } = root.DeltaDevices;
  const { CONSOLES, CUSTOM_INPUTS, allowedInputs } = root.DeltaConsoles;
  const { FILTER_PRESETS, presetFilter } = root.DeltaFilters;
  const Layout = root.DeltaLayout;
  const { slug } = root.DeltaSkinJson;
  const { DEFAULT_STYLE } = root.DeltaRender;
  const { alignFrames, distributeFrames, boundsOf } = root.DeltaSnap;
  const Exporter = root.DeltaExport;
  const DeltaImporter = root.DeltaImporter;

  const STORAGE_KEY = 'delta-skin-generator:v1';
  const VIEW_KEY = 'delta-skin-generator:view';
  const ORIENT_LABEL = { portrait: 'Retrato', landscape: 'Paisagem' };
  const $ = (id) => document.getElementById(id);

  // ---- state ------------------------------------------------------------

  function freshOrientations(device, consoleId, prev, kind) {
    const out = {};
    for (const o of ['portrait', 'landscape']) {
      out[o] = Layout.buildLayoutKind(kind || 'standard', device, consoleId, o);
      if (prev && prev[o]) {
        out[o].enabled = prev[o].enabled;
        // Hidden controls only make sense over imported art, which a fresh layout drops.
        if (prev[o].drawControls === false && app.images[o] && !(app.state.importSource || {}).artOrientations?.includes(o)) {
          out[o].drawControls = false;
        }
      }
    }
    return out;
  }

  function defaultState() {
    const device = getDevice('iphone-17-pro');
    const consoleId = 'gba';
    return {
      version: 1,
      name: 'Minha Skin GBA',
      identifier: '',
      identifierAuto: true,
      deviceId: device.id,
      device,
      consoleId,
      debug: false,
      assetFormat: 'pdf',
      showTitle: true,
      style: { ...DEFAULT_STYLE },
      orientations: freshOrientations(device, consoleId),
      layoutKind: 'standard',
      bgImages: {},
      layoutEdited: false,
    };
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  // Editor view preferences (not part of the project file).
  function loadView() {
    const view = { guides: true, grid: { show: false, snap: false, size: 8 } };
    try {
      const raw = localStorage.getItem(VIEW_KEY);
      if (raw) Object.assign(view, JSON.parse(raw));
    } catch (_) {
      // Storage unavailable — defaults are fine.
    }
    return view;
  }

  function saveView() {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify({ guides: app.ui.guides, grid: app.ui.grid }));
    } catch (_) {
      // Storage unavailable — preference just won't persist.
    }
  }

  const app = {
    state: loadSaved() || defaultState(),
    ui: { orientation: 'portrait', selection: [], showSafe: true, showDebug: true, ...loadView() },
    images: {},
    current() {
      return this.state.orientations[this.ui.orientation];
    },
    select(refs) {
      this.ui.selection = refs || [];
      this.ui.alignRef = null;
      renderSelection();
      renderElementList();
      editor.render();
    },
    changed(opts) {
      // Any edit other than an align click starts a fresh align reference.
      if (!(opts && opts.fromAlign)) this.ui.alignRef = null;
      Layout.syncTouch(this.current());
      this.state.layoutEdited = true;
      editor.render();
      if (opts && opts.geometryOnly) updateFrameFields();
      else if (!(opts && opts.fromPanel)) renderSelection();
      renderElementList();
      scheduleSave();
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

  Layout.bumpIds(Object.values(app.state.orientations));
  if (app.state.identifierAuto) app.state.identifier = autoIdentifier();

  const editor = new root.DeltaEditor($('editor-canvas'), $('canvas-wrap'), app);
  editor.onCursor = (p) => {
    $('cursor-pos').textContent = `x ${Math.round(p.x)} · y ${Math.round(p.y)} pt`;
  };

  let saveTimer = null;
  let warnedQuota = false;
  function writeStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
    } catch (_) {
      // Quota exceeded by large background images: keep at least the layout.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...app.state, bgImages: {} }));
      } catch (__) {
        // Storage unavailable — project file save still works.
      }
      if (!warnedQuota) {
        warnedQuota = true;
        toast('Imagem grande demais para o salvamento automático; use "Salvar projeto" para guardar a arte.');
      }
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 400);
  }

  function flushSave() {
    clearTimeout(saveTimer);
    // Don't snapshot halfway through a drag; the pointer-up save records it.
    if (editor.drag) {
      saveTimer = setTimeout(flushSave, 400);
      return;
    }
    history.record();
    writeStorage();
  }

  // ---- undo / redo -----------------------------------------------------------
  // Snapshots of the project (minus background images, which are large) taken whenever the
  // debounced save fires, so a burst of edits (typing, arrow keys) becomes one undo step.

  const HISTORY_LIMIT = 100;

  const history = {
    undoStack: [],
    redoStack: [],

    snapshot() {
      return JSON.stringify({ ...app.state, bgImages: undefined });
    },

    reset() {
      this.undoStack = [this.snapshot()];
      this.redoStack = [];
      renderHistoryButtons();
    },

    record() {
      const snap = this.snapshot();
      if (snap === this.undoStack[this.undoStack.length - 1]) return;
      this.undoStack.push(snap);
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack = [];
      renderHistoryButtons();
    },

    undo() {
      flushSave();
      if (this.undoStack.length < 2) return;
      this.redoStack.push(this.undoStack.pop());
      this.restore(this.undoStack[this.undoStack.length - 1]);
    },

    redo() {
      flushSave();
      const snap = this.redoStack.pop();
      if (!snap) return;
      this.undoStack.push(snap);
      this.restore(snap);
    },

    restore(snap) {
      app.state = { ...JSON.parse(snap), bgImages: app.state.bgImages };
      Layout.bumpIds(Object.values(app.state.orientations));
      app.ui.selection = [];
      app.ui.alignRef = null;
      renderAll();
      renderHistoryButtons();
      writeStorage();
    },
  };

  function renderHistoryButtons() {
    $('btn-undo').disabled = history.undoStack.length < 2;
    $('btn-redo').disabled = history.redoStack.length === 0;
  }

  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (el.hidden = true), 3500);
  }

  function autoIdentifier() {
    return `com.deltaskin.${app.state.consoleId}.${slug(app.state.name).replace(/-/g, '')}.${app.state.deviceId.replace(/-/g, '')}`;
  }

  // Leaving an imported layout drops its artwork too: it no longer matches the frames.
  function leaveImport() {
    const imp = app.state.importSource;
    if (!imp) return;
    for (const o of imp.artOrientations || []) {
      delete app.state.bgImages[o];
      delete app.images[o];
    }
    app.state.importSource = null;
  }

  // Imported skin converted to the current iPhone; orientations it lacks get the standard layout.
  function importedOrientations(imp, prev) {
    const result = DeltaImporter.convertInfo(imp.info, app.state.device);
    const out = freshOrientations(app.state.device, result.consoleId, prev, 'standard');
    for (const o of Object.keys(result.orientations)) out[o] = result.orientations[o];
    if (result.warnings.length) toast(result.warnings.join(' '));
    return out;
  }

  // kind: 'standard' | 'flippad'; omitted keeps the current one (device/console changes).
  function relayout(kind) {
    if (kind) app.state.layoutKind = kind;
    if (app.state.layoutKind === 'imported' && app.state.importSource) {
      app.state.orientations = importedOrientations(app.state.importSource, app.state.orientations);
      app.state.layoutEdited = false;
      app.ui.selection = [];
      renderAll();
      scheduleSave();
      return;
    }
    if (app.state.layoutKind === 'imported') app.state.layoutKind = 'standard';
    leaveImport();
    const current = app.state.layoutKind || 'standard';
    app.state.orientations = freshOrientations(app.state.device, app.state.consoleId, app.state.orientations, current);
    app.state.layoutEdited = false;
    app.ui.selection = [];
    renderAll();
    scheduleSave();
  }

  function confirmRelayout() {
    return !app.state.layoutEdited || confirm('Isso recria o layout e descarta suas edições de posição. Continuar?');
  }

  // ---- images -----------------------------------------------------------

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function loadImages() {
    app.images = {};
    for (const [o, src] of Object.entries(app.state.bgImages || {})) {
      try {
        app.images[o] = await loadImage(src);
      } catch (_) {
        delete app.state.bgImages[o];
      }
    }
  }

  // ---- small DOM helpers ---------------------------------------------------

  // Bootstrap classes for the controls built in the inspector.
  const BTN = 'btn btn-sm btn-outline-secondary';
  const BTN_DANGER = 'btn btn-sm btn-outline-danger';
  const INPUT = 'form-control form-control-sm';
  const SELECT = 'form-select form-select-sm';
  const TEXTAREA = 'form-control form-control-sm font-monospace';

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k === 'class') node.className = v;
      else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  }

  function numberField(text, value, onValue, attrs) {
    const input = el('input', { type: 'number', class: INPUT, value: value ?? '', ...attrs });
    input.addEventListener('input', () => {
      const v = input.value === '' ? null : Number(input.value);
      if (v === null || Number.isFinite(v)) onValue(v);
    });
    return el('label', {}, text, input);
  }

  function frameFields(frame, prefix, onChange) {
    const wrap = el('div', { class: 'grid4' });
    for (const [key, text] of [['x', 'x'], ['y', 'y'], ['width', 'w'], ['height', 'h']]) {
      const field = numberField(text, frame[key], (v) => {
        frame[key] = v ?? 0;
        onChange();
      }, { 'data-frame': `${prefix}.${key}`, step: 1 });
      wrap.append(field);
    }
    return wrap;
  }

  function edgesFields(edges, allowBlank, onChange) {
    const wrap = el('div', { class: 'grid4' });
    for (const key of ['top', 'bottom', 'left', 'right']) {
      wrap.append(
        numberField(key, edges[key], (v) => {
          if (v === null && allowBlank) delete edges[key];
          else edges[key] = v ?? 0;
          onChange();
        }, { placeholder: allowBlank ? 'herda' : '' }),
      );
    }
    return wrap;
  }

  // ---- sidebar ---------------------------------------------------------------

  function initSidebar() {
    const deviceSelect = $('device-select');
    for (const d of DEVICES) {
      deviceSelect.append(el('option', { value: d.id }, `${d.name} — ${d.points.w}×${d.points.h}pt`));
    }
    deviceSelect.append(el('option', { value: 'custom' }, 'Custom…'));
    const consoleSelect = $('console-select');
    for (const c of Object.values(CONSOLES)) consoleSelect.append(el('option', { value: c.id }, c.name));

    deviceSelect.addEventListener('change', () => {
      const id = deviceSelect.value;
      const prevId = app.state.deviceId;
      if (!confirmRelayout()) {
        deviceSelect.value = prevId;
        return;
      }
      app.state.deviceId = id;
      app.state.device = id === 'custom' ? readCustomDevice() : getDevice(id);
      if (app.state.identifierAuto) app.state.identifier = autoIdentifier();
      relayout();
    });

    for (const id of ['custom-w', 'custom-h', 'custom-scale', 'custom-family']) {
      $(id).addEventListener('change', () => {
        app.state.device = readCustomDevice();
        relayout();
      });
    }

    const safeMap = {
      'safe-p-top': ['portrait', 'top'],
      'safe-p-bottom': ['portrait', 'bottom'],
      'safe-l-left': ['landscape', 'left'],
      'safe-l-right': ['landscape', 'right'],
      'safe-l-bottom': ['landscape', 'bottom'],
    };
    for (const [id, [o, k]] of Object.entries(safeMap)) {
      $(id).addEventListener('input', () => {
        app.state.device.safe[o][k] = Number($(id).value) || 0;
        editor.render();
        scheduleSave();
      });
    }

    consoleSelect.addEventListener('change', () => {
      const prev = app.state.consoleId;
      if (!confirmRelayout()) {
        consoleSelect.value = prev;
        return;
      }
      app.state.consoleId = consoleSelect.value;
      // An imported skin belongs to its console; switching console starts from the standard layout.
      if (app.state.layoutKind === 'imported') app.state.layoutKind = 'standard';
      if (app.state.name === `Minha Skin ${CONSOLES[prev].id.toUpperCase()}`) {
        app.state.name = `Minha Skin ${consoleSelect.value.toUpperCase()}`;
      }
      if (app.state.identifierAuto) app.state.identifier = autoIdentifier();
      relayout();
    });

    $('btn-relayout').addEventListener('click', () => {
      if (confirmRelayout()) relayout('standard');
    });
    $('btn-flippad').addEventListener('click', () => {
      if (confirmRelayout()) relayout('flippad');
    });

    $('skin-name').addEventListener('input', (e) => {
      app.state.name = e.target.value;
      if (app.state.identifierAuto) {
        app.state.identifier = autoIdentifier();
        $('skin-identifier').value = app.state.identifier;
      }
      editor.render();
      scheduleSave();
    });
    $('skin-identifier').addEventListener('input', (e) => {
      app.state.identifier = e.target.value;
      app.state.identifierAuto = e.target.value === '';
      scheduleSave();
    });
    $('skin-debug').addEventListener('change', (e) => {
      app.state.debug = e.target.checked;
      scheduleSave();
    });
    for (const o of ['portrait', 'landscape']) {
      $(`orient-${o}`).addEventListener('change', (e) => {
        app.state.orientations[o].enabled = e.target.checked;
        renderStage();
        scheduleSave();
      });
    }
    $('asset-format').addEventListener('change', (e) => {
      app.state.assetFormat = e.target.value;
      scheduleSave();
    });

    for (const key of ['bg', 'bg2', 'bezel', 'button', 'accent', 'text']) {
      $(`style-${key}`).addEventListener('input', (e) => {
        app.state.style[key] = e.target.value;
        editor.render();
        scheduleSave();
      });
    }
    $('style-opacity').addEventListener('input', (e) => {
      app.state.style.landscapeOpacity = Number(e.target.value);
      editor.render();
      scheduleSave();
    });
    $('show-title').addEventListener('change', (e) => {
      app.state.showTitle = e.target.checked;
      editor.render();
      scheduleSave();
    });

    $('bg-upload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      try {
        app.images[app.ui.orientation] = await loadImage(dataUrl);
      } catch (_) {
        toast('Não consegui ler essa imagem.');
        return;
      }
      app.state.bgImages[app.ui.orientation] = dataUrl;
      renderArtPanel();
      editor.render();
      scheduleSave();
    });
    $('btn-bg-remove').addEventListener('click', () => {
      delete app.state.bgImages[app.ui.orientation];
      delete app.images[app.ui.orientation];
      renderArtPanel();
      editor.render();
      scheduleSave();
    });
    $('draw-controls').addEventListener('change', (e) => {
      app.current().drawControls = e.target.checked;
      editor.render();
      scheduleSave();
    });
  }

  function readCustomDevice() {
    const family = $('custom-family').value;
    return customDevice(
      Number($('custom-w').value) || 402,
      Number($('custom-h').value) || 874,
      Number($('custom-scale').value) || 3,
      family,
      family === 'edgeToEdge' ? 59 : 0,
    );
  }

  function renderSidebar() {
    const s = app.state;
    const d = s.device;
    $('device-select').value = s.deviceId;
    $('custom-device').hidden = s.deviceId !== 'custom';
    if (s.deviceId === 'custom') {
      $('custom-w').value = d.points.w;
      $('custom-h').value = d.points.h;
      $('custom-scale').value = d.scale;
      $('custom-family').value = d.family;
    }
    $('device-info').textContent =
      `${d.points.w}×${d.points.h} pt · @${d.scale}x · imagem ${d.pixels.w}×${d.pixels.h} px · representação "${d.family}"`;
    $('safe-p-top').value = d.safe.portrait.top;
    $('safe-p-bottom').value = d.safe.portrait.bottom;
    $('safe-l-left').value = d.safe.landscape.left;
    $('safe-l-right').value = d.safe.landscape.right;
    $('safe-l-bottom').value = d.safe.landscape.bottom;
    $('console-select').value = s.consoleId;
    const kind = s.layoutKind || 'standard';
    $('btn-relayout').classList.toggle('active', kind === 'standard');
    $('btn-flippad').classList.toggle('active', kind === 'flippad');
    $('layout-kind').textContent = {
      standard: 'Layout padrão: todos os botões na tela.',
      flippad:
        'Layout FlipPad: retrato só com a tela e os botões do Delta; a área hachurada fica coberta pelo controle. Paisagem usa o layout padrão. Trocar iPhone/console mantém o FlipPad.',
      imported: `Layout importado de "${(s.importSource && s.importSource.fileName) || 'skin'}": medidas convertidas para este iPhone e arte original como fundo. Mover elementos não move o desenho. Trocar o iPhone reconverte.`,
    }[kind];
    $('skin-name').value = s.name;
    $('skin-identifier').value = s.identifier;
    $('skin-debug').checked = s.debug;
    $('orient-portrait').checked = s.orientations.portrait.enabled;
    $('orient-landscape').checked = s.orientations.landscape.enabled;
    $('asset-format').value = s.assetFormat;
    for (const key of ['bg', 'bg2', 'bezel', 'button', 'accent', 'text']) $(`style-${key}`).value = s.style[key];
    $('style-opacity').value = s.style.landscapeOpacity;
    $('show-title').checked = s.showTitle;
    renderArtPanel();
  }

  function renderArtPanel() {
    const o = app.ui.orientation;
    const img = app.images[o];
    const d = app.state.device;
    const ms = Layout.mappingSizeFor(d, o);
    const target = `${Math.round(ms.width * d.scale)}×${Math.round(ms.height * d.scale)} px`;
    $('bg-hint').textContent = img
      ? `Imagem ${img.width}×${img.height} px (alvo ${target}); recortada para preencher.`
      : `Tamanho ideal: ${target}. A área das telas fica transparente na exportação.`;
    $('btn-bg-remove').disabled = !img;
    $('draw-controls').checked = app.current().drawControls !== false;
    for (const n of document.querySelectorAll('.orient-name')) n.textContent = ORIENT_LABEL[o];
  }

  // ---- stage -----------------------------------------------------------------

  function initStage() {
    for (const btn of document.querySelectorAll('.tabs button')) {
      btn.addEventListener('click', () => {
        app.ui.orientation = btn.dataset.orientation;
        app.ui.selection = [];
        renderAll();
      });
    }
    $('view-safe').addEventListener('change', (e) => {
      app.ui.showSafe = e.target.checked;
      editor.render();
    });
    $('view-debug').addEventListener('change', (e) => {
      app.ui.showDebug = e.target.checked;
      editor.render();
    });
    $('view-guides').checked = app.ui.guides;
    $('view-grid').checked = app.ui.grid.show;
    $('view-grid-snap').checked = app.ui.grid.snap;
    $('view-grid-size').value = app.ui.grid.size;
    $('view-guides').addEventListener('change', (e) => {
      app.ui.guides = e.target.checked;
      saveView();
    });
    $('view-grid').addEventListener('change', (e) => {
      app.ui.grid.show = e.target.checked;
      editor.render();
      saveView();
    });
    $('view-grid-snap').addEventListener('change', (e) => {
      app.ui.grid.snap = e.target.checked;
      saveView();
    });
    $('view-grid-size').addEventListener('input', (e) => {
      const size = Math.round(Number(e.target.value));
      if (!(size >= 2 && size <= 100)) return;
      app.ui.grid.size = size;
      editor.render();
      saveView();
    });
  }

  function renderStage() {
    for (const btn of document.querySelectorAll('.tabs button')) {
      btn.classList.toggle('active', btn.dataset.orientation === app.ui.orientation);
    }
    $('orientation-disabled').hidden = app.current().enabled;
    editor.render();
  }

  // ---- inspector -------------------------------------------------------------

  function initInspector() {
    $('orient-translucent').addEventListener('change', (e) => {
      app.current().translucent = e.target.checked;
      scheduleSave();
    });
    $('btn-add').addEventListener('click', () => {
      const input = $('add-input').value;
      const orient = app.current();
      const item = Layout.newItem(app.state.consoleId, input, orient.mappingSize);
      orient.items.push(item);
      app.select([{ type: 'item', id: item.id }]);
      app.changed({});
    });
  }

  function renderInspector() {
    const orient = app.current();
    $('mapping-size').textContent = `mappingSize ${orient.mappingSize.width}×${orient.mappingSize.height} pt`;
    $('orient-translucent').checked = !!orient.translucent;
    const edges = $('orient-edges');
    edges.replaceChildren(...edgesFields(orient.extendedEdges, false, () => {
      editor.render();
      scheduleSave();
    }).childNodes);

    const add = $('add-input');
    const con = CONSOLES[app.state.consoleId];
    add.replaceChildren(
      el('optgroup', { label: 'Console' }, ...con.buttons.map((b) => el('option', { value: b }, b))),
      el('optgroup', { label: 'Direcional' }, el('option', { value: 'dpad' }, 'dpad'), el('option', { value: 'thumbstick' }, 'thumbstick')),
      el('optgroup', { label: 'Delta' }, ...CUSTOM_INPUTS.map((b) => el('option', { value: b }, b))),
    );
    renderSelection();
    renderElementList();
  }

  function describeItem(item) {
    if (item.kind === 'dpad') return 'D-Pad';
    if (item.kind === 'thumbstick') return 'Thumbstick';
    if (item.kind === 'touch') return 'Touch screen';
    return item.inputs.join(' + ');
  }

  const refKey = (ref) => (ref.type === 'item' ? `i:${ref.id}` : `s:${ref.index}`);

  // Click selects one; Shift/Ctrl/Cmd+click toggles, like on the canvas.
  function listClick(ref, e) {
    const sel = app.ui.selection;
    if (!(e.shiftKey || e.ctrlKey || e.metaKey)) return app.select([ref]);
    const key = refKey(ref);
    app.select(sel.some((r) => refKey(r) === key) ? sel.filter((r) => refKey(r) !== key) : [...sel, ref]);
  }

  function renderElementList() {
    const orient = app.current();
    const keys = new Set(app.ui.selection.map(refKey));
    const rows = [];
    const rowClass = (ref) => `list-group-item list-group-item-action${keys.has(refKey(ref)) ? ' active' : ''}`;
    orient.screens.forEach((s, i) => {
      const ref = { type: 'screen', index: i };
      const f = s.outputFrame;
      rows.push(
        el('li', { class: rowClass(ref), onclick: (e) => listClick(ref, e) },
          el('span', {}, `Tela ${i + 1}`), el('span', {}, `${f.width}×${f.height}`)),
      );
    });
    for (const item of orient.items) {
      if (item.kind === 'touch') continue;
      const ref = { type: 'item', id: item.id };
      const f = item.frame;
      rows.push(
        el('li', { class: rowClass(ref), onclick: (e) => listClick(ref, e) },
          el('span', {}, describeItem(item)), el('span', {}, `${f.x},${f.y}`)),
      );
    }
    $('element-list').replaceChildren(...rows);
  }

  function resolveRef(ref) {
    const orient = app.current();
    if (ref.type === 'item') {
      const item = orient.items.find((i) => i.id === ref.id);
      return item ? { item, frame: item.frame } : null;
    }
    const screen = orient.screens[ref.index];
    return screen ? { screen, frame: screen.outputFrame } : null;
  }

  // Refresh only the numeric frame inputs while dragging (keeps the panel stable).
  function updateFrameFields() {
    const sel = app.ui.selection;
    if (sel.length !== 1) return;
    const resolved = resolveRef(sel[0]);
    if (!resolved) return;
    const prefix = sel[0].type === 'item' ? 'frame' : 'output';
    for (const key of ['x', 'y', 'width', 'height']) {
      const input = document.querySelector(`[data-frame="${prefix}.${key}"]`);
      if (input && document.activeElement !== input) input.value = resolved.frame[key];
    }
  }

  function panelChanged() {
    app.changed({ fromPanel: true });
  }

  function renderSelection() {
    const sel = app.ui.selection.filter((r) => resolveRef(r));
    const body = $('selection-body');
    $('selection-empty').hidden = sel.length > 0;
    body.hidden = sel.length === 0;
    if (sel.length > 1) {
      body.replaceChildren(...multiPanel(sel));
    } else if (sel.length === 1) {
      const { item, screen } = resolveRef(sel[0]);
      body.replaceChildren(...(item ? itemPanel(item) : screenPanel(screen, sel[0].index)));
    } else {
      body.replaceChildren();
    }
  }

  function multiPanel(sel) {
    const frames = sel.map((r) => resolveRef(r).frame);
    const action = (text, title, fn, disabled, opts) => {
      const btn = el('button', { type: 'button', class: BTN, title, disabled }, text);
      btn.addEventListener('click', () => {
        fn();
        app.changed(opts || {});
      });
      return btn;
    };
    // Align against the selection's box from before the first align click, so switching
    // between left/center/right (or top/middle/bottom) keeps moving the buttons.
    const align = (mode, text, title) =>
      action(text, title, () => {
        if (!app.ui.alignRef) app.ui.alignRef = boundsOf(frames);
        alignFrames(frames, mode, app.ui.alignRef);
      }, false, { fromAlign: true });
    const few = frames.length < 3;
    const first = frames[0];
    const nodes = [
      el('h3', {}, `${sel.length} selecionados`),
      el('p', { class: 'hint' }, 'Alinhar (pela caixa da seleção)'),
      el('div', { class: 'grid3 tools' },
        align('left', '⇤ Esquerda', 'Alinhar à esquerda'),
        align('hcenter', '↔ Centro', 'Centralizar na horizontal'),
        align('right', 'Direita ⇥', 'Alinhar à direita'),
        align('top', '⤒ Topo', 'Alinhar ao topo'),
        align('vcenter', '↕ Meio', 'Centralizar na vertical'),
        align('bottom', 'Base ⤓', 'Alinhar à base')),
      el('p', { class: 'hint' }, 'Distribuir (espaço igual, precisa de 3+)'),
      el('div', { class: 'grid2 tools' },
        action('Horizontal', 'Distribuir na horizontal', () => distributeFrames(frames, 'x'), few),
        action('Vertical', 'Distribuir na vertical', () => distributeFrames(frames, 'y'), few)),
      el('p', { class: 'hint' }, 'Tamanho (igual ao primeiro selecionado)'),
      el('div', { class: 'grid2 tools' },
        action('Mesma largura', '', () => frames.forEach((f) => (f.width = first.width))),
        action('Mesma altura', '', () => frames.forEach((f) => (f.height = first.height)))),
    ];
    if (sel.some((r) => r.type === 'item')) {
      const del = el('button', { type: 'button', class: `${BTN_DANGER} w-100 mt-2` }, 'Remover botões selecionados');
      del.addEventListener('click', () => app.removeSelected());
      nodes.push(del);
    }
    return nodes;
  }

  function itemPanel(item) {
    const nodes = [el('h3', {}, describeItem(item))];
    const allowed = new Set(allowedInputs(app.state.consoleId));

    if (Array.isArray(item.inputs)) {
      const warn = el('p', { class: 'hint' });
      const input = el('input', { type: 'text', class: INPUT, value: item.inputs.join(', ') });
      const check = () => {
        const bad = item.inputs.filter((i) => !allowed.has(i));
        warn.textContent = bad.length ? `⚠ Não suportado neste console: ${bad.join(', ')}` : 'Vários inputs = pressionados juntos.';
      };
      input.addEventListener('input', () => {
        item.inputs = input.value.split(',').map((s) => s.trim()).filter(Boolean);
        check();
        panelChanged();
      });
      check();
      nodes.push(el('label', {}, 'inputs (separados por vírgula)', input), warn);

      const labelInput = el('input', { type: 'text', class: INPUT, value: item.label || '' });
      labelInput.addEventListener('input', () => {
        item.label = labelInput.value;
        panelChanged();
      });
      const hasIcon = item.inputs.length === 1 && item.inputs[0] in root.DeltaRender.ICONS;
      nodes.push(el('label', {}, hasIcon ? 'Rótulo na arte (vazio = ícone)' : 'Rótulo na arte', labelInput));

      const shape = el('select', { class: SELECT }, ...['circle', 'pill', 'rect', 'text'].map((s) => el('option', { value: s, selected: item.shape === s }, s)));
      shape.addEventListener('change', () => {
        item.shape = shape.value;
        panelChanged();
      });
      nodes.push(el('label', {}, 'Forma', shape));
    } else {
      const warn = el('p', { class: 'hint' });
      const area = el('textarea', { class: TEXTAREA }, JSON.stringify(item.inputs, null, 2));
      area.addEventListener('input', () => {
        try {
          item.inputs = JSON.parse(area.value);
          warn.textContent = '';
          panelChanged();
        } catch (err) {
          warn.textContent = `JSON inválido: ${err.message}`;
        }
      });
      nodes.push(el('label', {}, 'inputs', area), warn);
      if (item.kind === 'dpad') nodes.push(el('p', { class: 'hint' }, 'Mapeie o D-Pad exatamente sem padding; use extendedEdges para folga.'));
      if (item.kind === 'touch') nodes.push(el('p', { class: 'hint' }, 'Segue automaticamente o outputFrame da tela 2.'));
    }

    nodes.push(el('h3', {}, 'frame (pt)'), frameFields(item.frame, 'frame', panelChanged));

    if (item.kind === 'thumbstick' && item.thumbstick) {
      nodes.push(
        el('h3', {}, 'Imagem do thumbstick (pt)'),
        el('div', { class: 'grid2' },
          numberField('width', item.thumbstick.width, (v) => { item.thumbstick.width = v || 1; panelChanged(); }),
          numberField('height', item.thumbstick.height, (v) => { item.thumbstick.height = v || 1; panelChanged(); })),
      );
    }

    if (item.kind !== 'touch') {
      item.extendedEdges = item.extendedEdges || {};
      nodes.push(el('h3', {}, 'extendedEdges (vazio = herda)'), edgesFields(item.extendedEdges, true, panelChanged));
      const dup = el('button', { type: 'button', class: BTN }, 'Duplicar');
      dup.addEventListener('click', () => {
        const orient = app.current();
        const copy = JSON.parse(JSON.stringify(item));
        copy.id = Layout.newId();
        copy.frame.x = Math.min(copy.frame.x + 10, orient.mappingSize.width - copy.frame.width);
        copy.frame.y = Math.min(copy.frame.y + 10, orient.mappingSize.height - copy.frame.height);
        if (copy.thumbstick) copy.thumbstick.name = `thumbstick_${copy.id}`;
        orient.items.push(copy);
        app.select([{ type: 'item', id: copy.id }]);
        app.changed({});
      });
      const del = el('button', { type: 'button', class: BTN_DANGER }, 'Remover');
      del.addEventListener('click', () => app.removeSelected());
      nodes.push(el('div', { class: 'd-flex gap-2 mt-2' }, dup, del));
    }
    return nodes;
  }

  function screenPanel(screen, index) {
    const con = CONSOLES[app.state.consoleId];
    const nodes = [el('h3', {}, `Tela ${index + 1}`)];

    nodes.push(el('h3', {}, 'outputFrame (pt)'), frameFields(screen.outputFrame, 'output', panelChanged));
    const fix = el('button', { type: 'button', class: `${BTN} w-100 mt-2` }, 'Corrigir proporção (altura pelo inputFrame)');
    fix.addEventListener('click', () => {
      const ratio = screen.inputFrame.width / screen.inputFrame.height;
      screen.outputFrame.height = Math.round(screen.outputFrame.width / ratio);
      app.changed({});
    });
    nodes.push(fix);

    if (con.omitInputFrame) {
      nodes.push(el('p', { class: 'hint' }, 'Genesis: inputFrame não é suportado e não é exportado.'));
    } else {
      nodes.push(el('h3', {}, 'inputFrame (px do emulador)'), frameFields(screen.inputFrame, 'input', panelChanged));
    }

    nodes.push(el('h3', {}, 'filters'));
    const preset = el('select', { class: 'form-select' }, ...FILTER_PRESETS.map((p) => el('option', { value: p.id }, p.name)));
    const addBtn = el('button', { type: 'button', class: 'btn btn-outline-secondary' }, '+');
    const warn = el('p', { class: 'hint' });
    const area = el('textarea', { class: TEXTAREA }, JSON.stringify(screen.filters || [], null, 2));
    addBtn.addEventListener('click', () => {
      screen.filters = screen.filters || [];
      screen.filters.push(presetFilter(preset.value));
      area.value = JSON.stringify(screen.filters, null, 2);
      panelChanged();
    });
    area.addEventListener('input', () => {
      try {
        const parsed = JSON.parse(area.value || '[]');
        if (!Array.isArray(parsed)) throw new Error('precisa ser um array');
        screen.filters = parsed;
        warn.textContent = '';
        panelChanged();
      } catch (err) {
        warn.textContent = `JSON inválido: ${err.message}`;
      }
    });
    nodes.push(el('div', { class: 'input-group input-group-sm mb-2' }, preset, addBtn), area, warn,
      el('p', { class: 'hint' }, 'Filtros CoreImage (CIFilter). Cores em 0–255; vetores {x,y}.'));
    return nodes;
  }

  // ---- top bar -----------------------------------------------------------------

  function initHistory() {
    $('btn-undo').addEventListener('click', () => history.undo());
    $('btn-redo').addEventListener('click', () => history.redo());
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Text fields keep their own native undo.
      const active = document.activeElement;
      const textInput = active && active.tagName === 'INPUT' && ['text', 'number', 'search'].includes(active.type);
      if (textInput || (active && active.tagName === 'TEXTAREA')) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        history.redo();
      }
    });
  }

  function initTopbar() {
    $('btn-export').addEventListener('click', async () => {
      const s = app.state;
      if (!s.orientations.portrait.enabled && !s.orientations.landscape.enabled) {
        toast('Ative pelo menos uma orientação.');
        return;
      }
      const btn = $('btn-export');
      btn.disabled = true;
      btn.textContent = 'Gerando…';
      try {
        await Exporter.exportDeltaSkin(s, app.images);
        toast('Skin exportada. Abra o .deltaskin no iPhone (Arquivos/AirDrop) para importar no Delta.');
      } catch (err) {
        console.error(err);
        toast(`Erro ao exportar: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Exportar .deltaskin';
      }
    });
    $('btn-info-json').addEventListener('click', () => Exporter.exportInfoJson(app.state));
    $('btn-save-project').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(app.state)], { type: 'application/json' });
      Exporter.download(blob, `${slug(app.state.name)}.project.json`);
    });
    $('input-import-skin').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (!confirmRelayout()) return;
      try {
        const result = await DeltaImporter.importDeltaSkin(file, app.state.device);
        leaveImport();
        app.state.consoleId = result.consoleId;
        app.state.name = result.name;
        if (app.state.identifierAuto) app.state.identifier = autoIdentifier();
        app.state.layoutKind = 'imported';
        app.state.importSource = { fileName: file.name, info: result.info, artOrientations: Object.keys(result.images) };
        app.state.orientations = freshOrientations(app.state.device, result.consoleId, app.state.orientations, 'standard');
        for (const o of Object.keys(result.orientations)) app.state.orientations[o] = result.orientations[o];
        for (const [o, src] of Object.entries(result.images)) app.state.bgImages[o] = src;
        app.state.layoutEdited = false;
        app.ui.selection = [];
        app.ui.orientation = result.orientations.portrait ? 'portrait' : 'landscape';
        await loadImages();
        renderAll();
        scheduleSave();
        const missing = ['portrait', 'landscape'].filter((o) => !result.orientations[o]);
        const notes = [...result.warnings];
        if (missing.length) notes.push(`Sem ${missing.map((o) => ORIENT_LABEL[o].toLowerCase()).join(' e ')} na skin: usei o layout padrão.`);
        toast(`Skin importada (${CONSOLES[result.consoleId].name}). ${notes.join(' ')}`);
      } catch (err) {
        console.error(err);
        toast(`Não consegui importar: ${err.message}`);
      }
    });
    $('input-open-project').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data.orientations || !data.device || !CONSOLES[data.consoleId]) throw new Error('arquivo não é um projeto');
        app.state = { ...defaultState(), ...data };
        Layout.bumpIds(Object.values(app.state.orientations));
        app.ui.selection = [];
        await loadImages();
        renderAll();
        writeStorage();
        history.reset();
        toast('Projeto carregado.');
      } catch (err) {
        toast(`Não consegui abrir: ${err.message}`);
      }
    });
  }

  function renderAll() {
    renderSidebar();
    renderStage();
    renderInspector();
  }

  initSidebar();
  initStage();
  initInspector();
  initTopbar();
  initHistory();
  history.reset();
  loadImages().then(renderAll);
})(window);
