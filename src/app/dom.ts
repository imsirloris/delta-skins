// Small DOM helpers shared by the views: element builder, form fields and the toast.

import type { Edges, Frame } from '../types';

const TOAST_MS = 3500;

// Bootstrap classes for the controls built in code.
const CLASSES = {
  button: 'btn btn-sm btn-outline-secondary',
  dangerButton: 'btn btn-sm btn-outline-danger',
  input: 'form-control form-control-sm',
  select: 'form-select form-select-sm',
  textarea: 'form-control form-control-sm font-monospace',
};

// Element of index.html by id; throws when the markup and the code disagree.
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} is missing from the page`);
  return node as T;
}

// Handlers take whatever event their element fires; `never` accepts any of them.
type Handler = (event: never) => void;
type AttrValue = string | number | boolean | null | undefined | Handler;
type Attrs = Record<string, AttrValue>;
type Child = Node | string | null | undefined;

// el('button', { class, onclick, disabled }, 'text'): `on*` attributes become listeners and
// false/null attributes are skipped.
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value as EventListener);
    else if (key === 'class') node.className = String(value);
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child != null) node.append(child);
  return node;
}

const button = (text: string, onclick: (event: MouseEvent) => void, attrs: Attrs = {}): HTMLButtonElement =>
  el('button', { type: 'button', class: CLASSES.button, onclick, ...attrs }, text);

// Labeled number input; onValue gets a number, or null when the field is cleared.
function numberField(text: string, value: number | undefined, onValue: (value: number | null) => void, attrs?: Attrs): HTMLLabelElement {
  const input = el('input', { type: 'number', class: CLASSES.input, value: value ?? '', ...attrs });
  input.addEventListener('input', () => {
    const parsed = input.value === '' ? null : Number(input.value);
    if (parsed === null || Number.isFinite(parsed)) onValue(parsed);
  });
  return el('label', {}, text, input);
}

const FRAME_FIELDS: [keyof Frame, string][] = [['x', 'x'], ['y', 'y'], ['width', 'w'], ['height', 'h']];

// x/y/w/h inputs bound to `frame`; `prefix` tags them so drags can refresh them in place.
function frameFields(frame: Frame, prefix: string, onChange: () => void): HTMLDivElement {
  const fields = FRAME_FIELDS.map(([key, text]) =>
    numberField(text, frame[key], (v) => {
      frame[key] = v ?? 0;
      onChange();
    }, { 'data-frame': `${prefix}.${key}`, step: 1 }),
  );
  return el('div', { class: 'grid4' }, ...fields);
}

const EDGE_KEYS = ['top', 'bottom', 'left', 'right'] as const;

// top/bottom/left/right inputs bound to `edges`; with allowBlank, a cleared field inherits.
function edgesFields(edges: Edges, allowBlank: boolean, onChange: () => void): HTMLDivElement {
  const fields = EDGE_KEYS.map((key) =>
    numberField(key, edges[key], (v) => {
      if (v === null && allowBlank) delete edges[key];
      else edges[key] = v ?? 0;
      onChange();
    }, { placeholder: allowBlank ? '—' : '', title: allowBlank ? 'Empty = inherit the orientation default' : null }),
  );
  return el('div', { class: 'grid4' }, ...fields);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function toast(message: string): void {
  const node = $('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.hidden = true), TOAST_MS);
}

// Runs `handler(file)` for the picked file and clears the input so the same file can be picked again.
function onFilePicked(input: HTMLInputElement, handler: (file: File) => void): void {
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (file) handler(file);
  });
}

// Message of a caught error, for toasts.
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export { CLASSES, $, el, button, numberField, frameFields, edgesFields, toast, onFilePicked, errorMessage };
