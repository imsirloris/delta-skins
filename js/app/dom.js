// Small DOM helpers shared by the views: element builder, form fields and the toast.
(function (root) {
  'use strict';

  const TOAST_MS = 3500;

  // Bootstrap classes for the controls built in code.
  const CLASSES = {
    button: 'btn btn-sm btn-outline-secondary',
    dangerButton: 'btn btn-sm btn-outline-danger',
    input: 'form-control form-control-sm',
    select: 'form-select form-select-sm',
    textarea: 'form-control form-control-sm font-monospace',
  };

  const $ = (id) => document.getElementById(id);

  // el('button', { class, onclick, disabled }, 'text'): `on*` attributes become listeners and
  // false/null attributes are skipped.
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (key === 'class') node.className = value;
      else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children) if (child != null) node.append(child);
    return node;
  }

  const button = (text, onclick, attrs = {}) => el('button', { type: 'button', class: CLASSES.button, onclick, ...attrs }, text);

  // Labeled number input; onValue gets a number, or null when the field is cleared.
  function numberField(text, value, onValue, attrs) {
    const input = el('input', { type: 'number', class: CLASSES.input, value: value ?? '', ...attrs });
    input.addEventListener('input', () => {
      const parsed = input.value === '' ? null : Number(input.value);
      if (parsed === null || Number.isFinite(parsed)) onValue(parsed);
    });
    return el('label', {}, text, input);
  }

  const FRAME_FIELDS = [['x', 'x'], ['y', 'y'], ['width', 'w'], ['height', 'h']];

  // x/y/w/h inputs bound to `frame`; `prefix` tags them so drags can refresh them in place.
  function frameFields(frame, prefix, onChange) {
    const fields = FRAME_FIELDS.map(([key, text]) =>
      numberField(text, frame[key], (v) => {
        frame[key] = v ?? 0;
        onChange();
      }, { 'data-frame': `${prefix}.${key}`, step: 1 }),
    );
    return el('div', { class: 'grid4' }, ...fields);
  }

  const EDGE_KEYS = ['top', 'bottom', 'left', 'right'];

  // top/bottom/left/right inputs bound to `edges`; with allowBlank, a cleared field inherits.
  function edgesFields(edges, allowBlank, onChange) {
    const fields = EDGE_KEYS.map((key) =>
      numberField(key, edges[key], (v) => {
        if (v === null && allowBlank) delete edges[key];
        else edges[key] = v ?? 0;
        onChange();
      }, { placeholder: allowBlank ? '—' : '', title: allowBlank ? 'Empty = inherit the orientation default' : null }),
    );
    return el('div', { class: 'grid4' }, ...fields);
  }

  function toast(message) {
    const node = $('toast');
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (node.hidden = true), TOAST_MS);
  }

  // Runs `handler(file)` for the picked file and clears the input so the same file can be picked again.
  function onFilePicked(input, handler) {
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) handler(file);
    });
  }

  root.DeltaDom = { CLASSES, $, el, button, numberField, frameFields, edgesFields, toast, onFilePicked };
})(window);
