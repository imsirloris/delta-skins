// Right panel: orientation settings, adding buttons, the element list and the selection panel
// (single button, single screen or a multi-selection with align/distribute tools).

import { CONSOLES, CUSTOM_INPUTS, allowedInputs } from '../../consoles';
import { FILTER_PRESETS, presetFilter } from '../../filters';
import * as Layout from '../../layout';
import { alignFrames, distributeFrames, boundsOf, type AlignMode } from '../../snap';
import { refKey, itemRef, screenRef, toggleRef, resolveRef } from '../../refs';
import { ICONS } from '../../render';
import { CLASSES, $, el, button, numberField, frameFields, edgesFields, errorMessage } from '../dom';
import type {
  AppContext,
  ButtonItem,
  ChangeOptions,
  DirectionalItem,
  Frame,
  Item,
  OrientationLayout,
  Ref,
  Screen,
  ScreenFilter,
  Shape,
  Thumbstick,
} from '../../types';

interface InspectorDeps {
  redraw(): void;
  save(): void;
}

const SHAPES: Shape[] = ['circle', 'pill', 'rect', 'text'];
const DUPLICATE_OFFSET = 10;
const FRAME_KEYS: (keyof Frame)[] = ['x', 'y', 'width', 'height'];

const ITEM_NAMES = { dpad: 'D-Pad', thumbstick: 'Thumbstick', touch: 'Touch screen' };
const describeItem = (item: Item) => (item.kind === 'button' ? item.inputs.join(' + ') : ITEM_NAMES[item.kind]);

const ALIGN_TOOLS: [AlignMode, string, string][] = [
  ['left', '⇤ Left', 'Align left'],
  ['hcenter', '↔ Center', 'Center horizontally'],
  ['right', 'Right ⇥', 'Align right'],
  ['top', '⤒ Top', 'Align top'],
  ['vcenter', '↕ Middle', 'Center vertically'],
  ['bottom', 'Bottom ⤓', 'Align bottom'],
];

interface JsonEditorOptions<T> {
  // JSON text a cleared textarea stands for (none: clearing is an error).
  whenEmpty?: string;
  // Throws when the parsed value has the wrong shape.
  validate: (parsed: unknown) => T;
}

// JSON textarea that calls onValue(parsed) for valid input and shows the error otherwise.
function jsonEditor<T>(value: T, onValue: (value: T) => void, { whenEmpty, validate }: JsonEditorOptions<T>) {
  const warn = el('p', { class: 'hint' });
  const area = el('textarea', { class: CLASSES.textarea }, JSON.stringify(value, null, 2));
  area.addEventListener('input', () => {
    try {
      const parsed = validate(JSON.parse(area.value || (whenEmpty ?? '')));
      warn.textContent = '';
      onValue(parsed);
    } catch (err) {
      warn.textContent = `Invalid JSON: ${errorMessage(err)}`;
    }
  });
  return { area, warn };
}

function asInputsObject(parsed: unknown): Record<string, string> {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('must be an object');
  return parsed as Record<string, string>;
}

function asFilters(parsed: unknown): ScreenFilter[] {
  if (!Array.isArray(parsed)) throw new Error('must be an array');
  return parsed;
}

class InspectorView {
  context: AppContext;
  deps: InspectorDeps;
  panelChanged: () => void;

  constructor(context: AppContext, deps: InspectorDeps) {
    this.context = context;
    this.deps = deps;
    this.panelChanged = () => this.context.changed({ fromPanel: true });
  }

  get orient(): OrientationLayout {
    return this.context.current();
  }

  init(): void {
    const translucent = $<HTMLInputElement>('orient-translucent');
    translucent.addEventListener('change', () => {
      this.orient.translucent = translucent.checked;
      this.deps.save();
    });
    $('btn-add').addEventListener('click', () => {
      const item = Layout.newItem($<HTMLSelectElement>('add-input').value, this.orient.mappingSize);
      this.addItem(item);
    });
  }

  addItem(item: Item): void {
    this.orient.items.push(item);
    this.context.select([itemRef(item.id)]);
    this.context.changed({});
  }

  render(): void {
    const orient = this.orient;
    $('mapping-size').textContent = `mappingSize ${orient.mappingSize.width}×${orient.mappingSize.height} pt`;
    $<HTMLInputElement>('orient-translucent').checked = Boolean(orient.translucent);
    const onEdges = () => {
      this.deps.redraw();
      this.deps.save();
    };
    $('orient-edges').replaceChildren(...edgesFields(orient.extendedEdges, false, onEdges).childNodes);
    this.renderAddOptions();
    this.renderSelection();
    this.renderElementList();
  }

  renderAddOptions(): void {
    const option = (value: string) => el('option', { value }, value);
    const con = CONSOLES[this.context.state.consoleId];
    $('add-input').replaceChildren(
      el('optgroup', { label: 'Console' }, ...con.buttons.map(option)),
      el('optgroup', { label: 'Directional' }, option('dpad'), option('thumbstick')),
      el('optgroup', { label: 'Delta' }, ...CUSTOM_INPUTS.map(option)),
    );
  }

  // ---- element list ----------------------------------------------------------

  // Click selects one; Shift/Ctrl/Cmd+click toggles, like on the canvas.
  listClick(ref: Ref, e: MouseEvent): void {
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    this.context.select(additive ? toggleRef(this.context.ui.selection, ref) : [ref]);
  }

  renderElementList(): void {
    const orient = this.orient;
    const selected = new Set(this.context.ui.selection.map(refKey));
    const row = (ref: Ref, name: string, detail: string) =>
      el('li', {
        class: `list-group-item list-group-item-action${selected.has(refKey(ref)) ? ' active' : ''}`,
        onclick: (e: MouseEvent) => this.listClick(ref, e),
      }, el('span', {}, name), el('span', {}, detail));

    const screens = orient.screens.map((s, i) =>
      row(screenRef(i), `Screen ${i + 1}`, `${s.outputFrame.width}×${s.outputFrame.height}`));
    const items = orient.items
      .filter((item) => item.kind !== 'touch')
      .map((item) => row(itemRef(item.id), describeItem(item), `${item.frame.x},${item.frame.y}`));
    $('element-list').replaceChildren(...screens, ...items);
  }

  // ---- selection panel -------------------------------------------------------

  // Refresh only the numeric frame inputs while dragging (keeps the panel stable).
  updateFrameFields(): void {
    const selection = this.context.ui.selection;
    if (selection.length !== 1) return;
    const resolved = resolveRef(this.orient, selection[0]);
    if (!resolved) return;
    const prefix = selection[0].type === 'item' ? 'frame' : 'output';
    for (const key of FRAME_KEYS) {
      const input = document.querySelector<HTMLInputElement>(`[data-frame="${prefix}.${key}"]`);
      if (input && document.activeElement !== input) input.value = String(resolved.frame[key]);
    }
  }

  renderSelection(): void {
    const selection = this.context.ui.selection.filter((r) => resolveRef(this.orient, r));
    $('selection-empty').hidden = selection.length > 0;
    $('selection-body').hidden = selection.length === 0;
    $('selection-body').replaceChildren(...this.selectionPanel(selection));
  }

  // `selection` only holds refs that resolve in the current orientation.
  selectionPanel(selection: Ref[]): HTMLElement[] {
    if (!selection.length) return [];
    if (selection.length > 1) return this.multiPanel(selection);
    const ref = selection[0];
    const resolved = resolveRef(this.orient, ref);
    if (!resolved) return [];
    if (resolved.item) return this.itemPanel(resolved.item);
    return ref.type === 'screen' ? this.screenPanel(resolved.screen, ref.index) : [];
  }

  multiPanel(selection: Ref[]): HTMLElement[] {
    const frames = selection.map((r) => resolveRef(this.orient, r)?.frame).filter((f) => f !== undefined);
    const ui = this.context.ui;
    const tool = (text: string, title: string, apply: () => void, { disabled = false, changeOpts = {} as ChangeOptions } = {}) =>
      button(text, () => {
        apply();
        this.context.changed(changeOpts);
      }, { title, disabled });
    // Align against the selection's box from before the first align click, so switching
    // between left/center/right (or top/middle/bottom) keeps moving the buttons.
    const align = ([mode, text, title]: [AlignMode, string, string]) =>
      tool(text, title, () => {
        if (!ui.alignRef) ui.alignRef = boundsOf(frames);
        alignFrames(frames, mode, ui.alignRef);
      }, { changeOpts: { fromAlign: true } });
    const tooFew = frames.length < 3;
    const first = frames[0];

    const nodes: HTMLElement[] = [
      el('h3', {}, `${selection.length} selected`),
      el('p', { class: 'hint' }, 'Align (to the selection box)'),
      el('div', { class: 'grid3 tools' }, ...ALIGN_TOOLS.map(align)),
      el('p', { class: 'hint' }, 'Distribute (equal spacing, needs 3+)'),
      el('div', { class: 'grid2 tools' },
        tool('Horizontal', 'Distribute horizontally', () => distributeFrames(frames, 'x'), { disabled: tooFew }),
        tool('Vertical', 'Distribute vertically', () => distributeFrames(frames, 'y'), { disabled: tooFew })),
      el('p', { class: 'hint' }, 'Size (match the first selected)'),
      el('div', { class: 'grid2 tools' },
        tool('Same width', '', () => frames.forEach((f) => (f.width = first.width))),
        tool('Same height', '', () => frames.forEach((f) => (f.height = first.height)))),
    ];
    if (selection.some((r) => r.type === 'item')) {
      nodes.push(button('Remove selected buttons', () => this.context.removeSelected(), { class: `${CLASSES.dangerButton} w-100 mt-2` }));
    }
    return nodes;
  }

  itemPanel(item: Item): HTMLElement[] {
    const fields = item.kind === 'button' ? this.buttonFields(item) : this.directionalFields(item);
    const nodes = [el('h3', {}, describeItem(item)), ...fields];
    nodes.push(el('h3', {}, 'frame (pt)'), frameFields(item.frame, 'frame', this.panelChanged));
    if (item.kind === 'thumbstick' && item.thumbstick) nodes.push(...this.thumbstickFields(item.thumbstick));
    if (item.kind !== 'touch') nodes.push(...this.itemEdgesAndActions(item));
    return nodes;
  }

  // Buttons: comma-separated inputs, art label and shape.
  buttonFields(item: ButtonItem): HTMLElement[] {
    const allowed = new Set(allowedInputs(this.context.state.consoleId));
    const warn = el('p', { class: 'hint' });
    const checkInputs = () => {
      const unsupported = item.inputs.filter((i) => !allowed.has(i));
      warn.textContent = unsupported.length
        ? `⚠ Not supported on this console: ${unsupported.join(', ')}`
        : 'Several inputs = pressed together.';
    };
    const inputs = el('input', { type: 'text', class: CLASSES.input, value: item.inputs.join(', ') });
    inputs.addEventListener('input', () => {
      item.inputs = inputs.value.split(',').map((s) => s.trim()).filter(Boolean);
      checkInputs();
      this.panelChanged();
    });
    checkInputs();

    const label = el('input', { type: 'text', class: CLASSES.input, value: item.label || '' });
    label.addEventListener('input', () => {
      item.label = label.value;
      this.panelChanged();
    });
    const hasIcon = item.inputs.length === 1 && item.inputs[0] in ICONS;

    const shape = el('select', { class: CLASSES.select }, ...SHAPES.map((s) => el('option', { value: s, selected: item.shape === s }, s)));
    shape.addEventListener('change', () => {
      item.shape = shape.value as Shape;
      this.panelChanged();
    });

    return [
      el('label', {}, 'inputs (comma-separated)', inputs),
      warn,
      el('label', {}, hasIcon ? 'Label on the art (empty = icon)' : 'Label on the art', label),
      el('label', {}, 'Shape', shape),
    ];
  }

  // D-Pad, thumbstick and touch screen: inputs object edited as JSON.
  directionalFields(item: DirectionalItem): HTMLElement[] {
    const { area, warn } = jsonEditor(item.inputs, (inputs) => {
      item.inputs = inputs;
      this.panelChanged();
    }, { validate: asInputsObject });
    const nodes: HTMLElement[] = [el('label', {}, 'inputs', area), warn];
    if (item.kind === 'dpad') nodes.push(el('p', { class: 'hint' }, 'Map the D-Pad exactly, without padding; use extendedEdges for slack.'));
    if (item.kind === 'touch') nodes.push(el('p', { class: 'hint' }, 'Follows the outputFrame of screen 2 automatically.'));
    return nodes;
  }

  thumbstickFields(thumbstick: Thumbstick): HTMLElement[] {
    const size = (key: 'width' | 'height') => numberField(key, thumbstick[key], (v) => {
      thumbstick[key] = v || 1;
      this.panelChanged();
    });
    return [el('h3', {}, 'Thumbstick image (pt)'), el('div', { class: 'grid2' }, size('width'), size('height'))];
  }

  itemEdgesAndActions(item: Item): HTMLElement[] {
    item.extendedEdges = item.extendedEdges || {};
    const actions = el('div', { class: 'd-flex gap-2 mt-2' },
      button('Duplicate', () => this.duplicate(item)),
      button('Remove', () => this.context.removeSelected(), { class: CLASSES.dangerButton }));
    return [el('h3', {}, 'extendedEdges (empty = inherit)'), edgesFields(item.extendedEdges, true, this.panelChanged), actions];
  }

  duplicate(item: Item): void {
    const ms = this.orient.mappingSize;
    const copy = structuredClone(item);
    copy.id = Layout.newId();
    copy.frame.x = Math.min(copy.frame.x + DUPLICATE_OFFSET, ms.width - copy.frame.width);
    copy.frame.y = Math.min(copy.frame.y + DUPLICATE_OFFSET, ms.height - copy.frame.height);
    if (copy.kind !== 'button' && copy.thumbstick) copy.thumbstick.name = `thumbstick_${copy.id}`;
    this.addItem(copy);
  }

  screenPanel(screen: Screen, index: number): HTMLElement[] {
    const con = CONSOLES[this.context.state.consoleId];
    const fixAspect = button('Fix aspect ratio (height from inputFrame)', () => {
      const ratio = screen.inputFrame.width / screen.inputFrame.height;
      screen.outputFrame.height = Math.round(screen.outputFrame.width / ratio);
      this.context.changed({});
    }, { class: `${CLASSES.button} w-100 mt-2` });

    const nodes: HTMLElement[] = [
      el('h3', {}, `Screen ${index + 1}`),
      el('h3', {}, 'outputFrame (pt)'),
      frameFields(screen.outputFrame, 'output', this.panelChanged),
      fixAspect,
    ];
    if (con.omitInputFrame) {
      nodes.push(el('p', { class: 'hint' }, 'Genesis: inputFrame is not supported and is not exported.'));
    } else {
      nodes.push(el('h3', {}, 'inputFrame (emulator px)'), frameFields(screen.inputFrame, 'input', this.panelChanged));
    }
    return [...nodes, ...this.filterFields(screen)];
  }

  filterFields(screen: Screen): HTMLElement[] {
    const { area, warn } = jsonEditor(screen.filters || [], (filters) => {
      screen.filters = filters;
      this.panelChanged();
    }, { whenEmpty: '[]', validate: asFilters });
    const preset = el('select', { class: 'form-select' }, ...FILTER_PRESETS.map((p) => el('option', { value: p.id }, p.name)));
    const add = button('+', () => {
      const filter = presetFilter(preset.value);
      if (!filter) return;
      screen.filters = [...(screen.filters || []), filter];
      area.value = JSON.stringify(screen.filters, null, 2);
      this.panelChanged();
    }, { class: 'btn btn-outline-secondary' });
    return [
      el('h3', {}, 'filters'),
      el('div', { class: 'input-group input-group-sm mb-2' }, preset, add),
      area,
      warn,
      el('p', { class: 'hint' }, 'CoreImage filters (CIFilter). Colors in 0–255; vectors as {x,y}.'),
    ];
  }
}

export { InspectorView };
