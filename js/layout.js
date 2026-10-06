// Default control layouts. Everything is in points (logical resolution), as Delta expects.
//
// Each element is positioned relative to a region:
//   portrait  -> the control area below the game screen(s)
//   landscape -> 'left' / 'right' columns (inside the safe area) or 'center' (whole skin)
// `g` is the anchor as a fraction of the region, `d` an offset in base points that is
// multiplied by the scale factor `s` (base design = 414pt wide).
(function (root) {
  'use strict';

  const Consoles = typeof module === 'object' && module.exports ? require('./consoles.js') : root.DeltaConsoles;

  const DPAD_INPUTS = { up: 'up', down: 'down', left: 'left', right: 'right' };
  const STICK_INPUTS = { up: 'analogStickUp', down: 'analogStickDown', left: 'analogStickLeft', right: 'analogStickRight' };
  const DEFAULT_EDGES = { top: 8, bottom: 8, left: 8, right: 8 };

  function button(input, label, size, p, ls, shape) {
    return { kind: 'button', inputs: [input], label, shape: shape || 'circle', w: size, h: size, p, ls };
  }

  function pill(input, label, p, ls) {
    return { kind: 'button', inputs: [input], label, shape: 'pill', w: 60, h: 24, p, ls };
  }

  function shoulder(input, label, side) {
    const left = side === 'left';
    return {
      kind: 'button',
      inputs: [input],
      label,
      shape: 'rect',
      w: 100,
      h: 36,
      p: { g: [left ? 0 : 1, 0], d: [left ? 62 : -62, 26] },
      ls: { r: side, g: [left ? 0 : 1, 0], d: [left ? 55 : -55, 30] },
    };
  }

  const dpad = (p, ls, size) => ({ kind: 'dpad', inputs: DPAD_INPUTS, label: '', shape: 'dpad', w: size || 130, h: size || 130, p, ls });
  const menu = () => button('menu', '', 36, { g: [0.5, 0], d: [0, 26] }, { r: 'center', g: [0.5, 1], d: [0, -24] });

  // Portrait/landscape group anchors shared by most consoles.
  const P_DPAD = { g: [0.25, 0.45], d: [0, 0] };
  const L_DPAD = { r: 'left', g: [0.5, 0.55], d: [0, 0] };
  const FACE_P = [0.75, 0.45];
  const FACE_L = ['right', 0.5, 0.55];

  // Face button at offset (dx, dy) from the face group anchor.
  function face(input, label, size, dx, dy) {
    return button(input, label, size, { g: FACE_P, d: [dx, dy] }, { r: FACE_L[0], g: [FACE_L[1], FACE_L[2]], d: [dx, dy] });
  }

  function selectStart(selectInput, selectLabel) {
    return [
      pill(selectInput, selectLabel, { g: [0.5, 1], d: [-40, -22] }, { r: 'left', g: [0.5, 1], d: [0, -28] }),
      pill('start', 'START', { g: [0.5, 1], d: [40, -22] }, { r: 'right', g: [0.5, 1], d: [0, -28] }),
    ];
  }

  const twoButtons = () => [face('a', 'A', 62, 34, -18), face('b', 'B', 62, -38, 18)];
  const fourButtons = () => [
    face('x', 'X', 52, 0, -56),
    face('a', 'A', 52, 56, 0),
    face('b', 'B', 52, 0, 56),
    face('y', 'Y', 52, -56, 0),
  ];

  const ELEMENTS = {
    gbc: () => [dpad(P_DPAD, L_DPAD), ...twoButtons(), ...selectStart('select', 'SELECT'), menu()],
    nes: () => [dpad(P_DPAD, L_DPAD), ...twoButtons(), ...selectStart('select', 'SELECT'), menu()],
    gba: () => [
      shoulder('l', 'L', 'left'),
      shoulder('r', 'R', 'right'),
      dpad(P_DPAD, L_DPAD),
      ...twoButtons(),
      ...selectStart('select', 'SELECT'),
      menu(),
    ],
    snes: () => [
      shoulder('l', 'L', 'left'),
      shoulder('r', 'R', 'right'),
      dpad(P_DPAD, L_DPAD),
      ...fourButtons(),
      ...selectStart('select', 'SELECT'),
      menu(),
    ],
    ds: () => [
      shoulder('l', 'L', 'left'),
      shoulder('r', 'R', 'right'),
      dpad(P_DPAD, L_DPAD),
      ...fourButtons(),
      ...selectStart('select', 'SELECT'),
      menu(),
    ],
    genesis: () => {
      const g6 = (input, label, dx, dy) => face(input, label, 50, dx, dy);
      return [
        dpad(P_DPAD, L_DPAD),
        g6('x', 'X', -50, -32),
        g6('y', 'Y', 6, -32),
        g6('z', 'Z', 62, -32),
        g6('a', 'A', -62, 32),
        g6('b', 'B', -6, 32),
        g6('c', 'C', 50, 32),
        ...selectStart('mode', 'MODE'),
        menu(),
      ];
    },
    n64: () => {
      const c = (input, label, dx, dy) =>
        button(input, label, 34, { g: [0.78, 0.36], d: [dx, dy] }, { r: 'right', g: [0.5, 0.35], d: [dx, dy] });
      return [
        shoulder('l', 'L', 'left'),
        shoulder('r', 'R', 'right'),
        {
          kind: 'button',
          inputs: ['z'],
          label: 'Z',
          shape: 'rect',
          w: 60,
          h: 36,
          p: { g: [0, 0], d: [150, 26] },
          ls: { r: 'left', g: [0, 0], d: [150, 30] },
        },
        {
          kind: 'thumbstick',
          inputs: STICK_INPUTS,
          label: '',
          shape: 'stick',
          w: 120,
          h: 120,
          stick: 60,
          p: { g: [0.27, 0.42], d: [0, 0] },
          ls: { r: 'left', g: [0.5, 0.45], d: [0, 0] },
        },
        dpad({ g: [0.14, 0.82], d: [0, 0] }, { r: 'left', g: [0.5, 1], d: [0, -70] }, 80),
        c('cUp', 'C▲', 0, -36),
        c('cDown', 'C▼', 0, 36),
        c('cLeft', 'C◀', -36, 0),
        c('cRight', 'C▶', 36, 0),
        button('a', 'A', 56, { g: [0.74, 0.78], d: [18, 10] }, { r: 'right', g: [0.5, 0.72], d: [18, 10] }),
        button('b', 'B', 48, { g: [0.74, 0.78], d: [-42, -14] }, { r: 'right', g: [0.5, 0.72], d: [-42, -14] }),
        pill('start', 'START', { g: [0.5, 1], d: [0, -22] }, { r: 'right', g: [0.5, 1], d: [0, -28] }),
        menu(),
      ];
    },
  };

  const round = (v) => Math.round(v);

  function rect(x, y, width, height) {
    return { x: round(x), y: round(y), width: round(width), height: round(height) };
  }

  // Fit a w×h box with the given aspect inside maxW×maxH.
  function fit(aspect, maxW, maxH) {
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    return { w, h };
  }

  function makeScreens(con, frames) {
    const { width: iw, height: ih } = con.inputFrame;
    if (con.dualScreen) {
      return frames.map((f, i) => ({
        inputFrame: { x: 0, y: i * (ih / 2), width: iw, height: ih / 2 },
        outputFrame: f,
        filters: [],
      }));
    }
    const screen = { inputFrame: { x: 0, y: 0, width: iw, height: ih }, outputFrame: frames[0], filters: [] };
    return [screen];
  }

  function screenAspect(con) {
    const { width, height } = con.inputFrame;
    return con.dualScreen ? width / (height / 2) : width / height;
  }

  function portraitScreens(con, W, H, safe) {
    const avail = H - safe.top - safe.bottom;
    const aspect = screenAspect(con);
    if (con.dualScreen) {
      const size = fit(aspect, W, avail * 0.3);
      const x = (W - size.w) / 2;
      return [rect(x, safe.top, size.w, size.h), rect(x, safe.top + round(size.h), size.w, size.h)];
    }
    const size = fit(aspect, W, avail * 0.55);
    return [rect((W - size.w) / 2, safe.top, size.w, size.h)];
  }

  function landscapeScreens(con, W, H, safe) {
    const aspect = screenAspect(con);
    const maxW = W - safe.left - safe.right;
    if (con.dualScreen) {
      const size = fit(aspect, Math.floor(maxW / 2), H);
      size.w = Math.floor(size.w);
      size.h = Math.floor(size.h);
      const x = (W - size.w * 2) / 2;
      const y = (H - size.h) / 2;
      return [rect(x, y, size.w, size.h), rect(x + round(size.w), y, size.w, size.h)];
    }
    const size = fit(aspect, maxW, H);
    return [rect((W - size.w) / 2, (H - size.h) / 2, size.w, size.h)];
  }

  function clampFrame(f, W, H) {
    const width = Math.min(f.width, W);
    const height = Math.min(f.height, H);
    return {
      x: Math.max(0, Math.min(f.x, W - width)),
      y: Math.max(0, Math.min(f.y, H - height)),
      width,
      height,
    };
  }

  let nextId = 1;
  const newId = () => 'i' + nextId++;

  function toItem(el, cx, cy, s, orientation) {
    const w = el.w * s;
    const h = el.h * s;
    const item = {
      id: newId(),
      kind: el.kind,
      inputs: Array.isArray(el.inputs) ? [...el.inputs] : { ...el.inputs },
      label: el.label,
      shape: el.shape,
      frame: rect(cx - w / 2, cy - h / 2, w, h),
    };
    if (el.kind === 'thumbstick') {
      const size = round(el.stick * s);
      item.thumbstick = { name: `${orientation}_thumbstick`, width: size, height: size };
    }
    return item;
  }

  function touchItem(frame) {
    return {
      id: newId(),
      kind: 'touch',
      inputs: { x: 'touchScreenX', y: 'touchScreenY' },
      label: '',
      shape: 'none',
      frame: { ...frame },
      extendedEdges: { top: 0, bottom: 0, left: 0, right: 0 },
    };
  }

  // Keep the DS touch item glued to the bottom screen's outputFrame.
  function syncTouch(orient) {
    const touch = orient.items.find((i) => i.kind === 'touch');
    if (touch && orient.screens[1]) touch.frame = { ...orient.screens[1].outputFrame };
  }

  function mappingSizeFor(device, orientation) {
    const { w, h } = device.points;
    return orientation === 'portrait' ? { width: w, height: h } : { width: h, height: w };
  }

  function buildLayout(device, consoleId, orientation) {
    const con = Consoles.CONSOLES[consoleId];
    const mappingSize = mappingSizeFor(device, orientation);
    const W = mappingSize.width;
    const H = mappingSize.height;
    const safe = device.safe[orientation];
    const elements = ELEMENTS[consoleId]();
    let frames;
    let regionFor;
    let s;

    if (orientation === 'portrait') {
      frames = portraitScreens(con, W, H, safe);
      const screenBottom = Math.max(...frames.map((f) => f.y + f.height));
      const top = screenBottom + 8;
      const bottom = H - safe.bottom - 6;
      const region = { x: 0, y: top, w: W, h: bottom - top };
      s = Math.min(W / 414, region.h / 330);
      regionFor = () => region;
    } else {
      frames = landscapeScreens(con, W, H, safe);
      s = H / 414;
      const colW = 190 * s;
      const h = H - safe.bottom;
      const regions = {
        left: { x: safe.left, y: 0, w: colW, h },
        right: { x: W - safe.right - colW, y: 0, w: colW, h },
        center: { x: 0, y: 0, w: W, h },
      };
      regionFor = (el) => regions[el.ls.r];
    }

    const items = elements.map((el) => {
      const pos = orientation === 'portrait' ? el.p : el.ls;
      const r = regionFor(el);
      const cx = r.x + pos.g[0] * r.w + pos.d[0] * s;
      const cy = r.y + pos.g[1] * r.h + pos.d[1] * s;
      const item = toItem(el, cx, cy, s, orientation);
      item.frame = clampFrame(item.frame, W, H);
      return item;
    });

    const screens = makeScreens(con, frames);
    if (con.dualScreen) items.push(touchItem(screens[1].outputFrame));

    return {
      enabled: true,
      mappingSize,
      items,
      screens,
      extendedEdges: { ...DEFAULT_EDGES },
      translucent: orientation === 'landscape',
    };
  }

  // ---- FlipPad layout ------------------------------------------------------------
  // For the FlipPad controller, which physically covers the lower part of the screen in
  // portrait: only the game screen(s) and Delta's app buttons are drawn; the controller
  // provides the game buttons. Taken from "minha-skin-ds.project (4).json" (DS on an
  // iPhone 17 Pro, 402×874pt, safe top 62pt) and scaled to other iPhones by width.
  const FLIPPAD_BASE = {
    width: 402,
    safeTop: 62,
    dsScreens: [
      { x: 45, y: 64, width: 311, height: 233 },
      { x: 45, y: 298, width: 311, height: 233 },
    ],
    buttons: [
      { input: 'menu', frame: { x: 45, y: 560, width: 50, height: 50 } },
      { input: 'quickSave', frame: { x: 132, y: 560, width: 50, height: 50 } },
      { input: 'toggleFastForward', frame: { x: 219, y: 560, width: 50, height: 50 } },
      { input: 'quickLoad', frame: { x: 306, y: 560, width: 50, height: 50 } },
    ],
  };

  function buildFlipPadLayout(device, consoleId, orientation) {
    // The FlipPad is only used in portrait; landscape keeps the regular layout.
    if (orientation !== 'portrait') return buildLayout(device, consoleId, orientation);

    const con = Consoles.CONSOLES[consoleId];
    const mappingSize = mappingSizeFor(device, orientation);
    const W = mappingSize.width;
    const H = mappingSize.height;
    const safe = device.safe.portrait;
    const s = W / FLIPPAD_BASE.width;
    // Same offset from the safe-area top as the base layout, scaled by width.
    const place = (f) => rect(f.x * s, safe.top + (f.y - FLIPPAD_BASE.safeTop) * s, f.width * s, f.height * s);

    const [top, bottom] = FLIPPAD_BASE.dsScreens.map(place);
    let frames;
    if (con.dualScreen) {
      frames = [top, bottom];
    } else {
      // Single screen: as large as possible, bottom edge on the DS bottom screen's base.
      const base = bottom.y + bottom.height;
      const size = fit(screenAspect(con), W, base - safe.top);
      const width = Math.floor(size.w);
      const height = Math.floor(size.h);
      frames = [rect((W - width) / 2, base - height, width, height)];
    }

    const items = FLIPPAD_BASE.buttons.map((b) => ({
      id: newId(),
      kind: 'button',
      inputs: [b.input],
      label: defaultLabel(b.input),
      shape: 'circle',
      frame: clampFrame(place(b.frame), W, H),
    }));

    const screens = makeScreens(con, frames);
    if (con.dualScreen) items.push(touchItem(screens[1].outputFrame));

    return {
      enabled: true,
      mappingSize,
      items,
      screens,
      extendedEdges: { ...DEFAULT_EDGES },
      translucent: false,
    };
  }

  const LAYOUT_KINDS = {
    standard: buildLayout,
    flippad: buildFlipPadLayout,
  };

  function buildLayoutKind(kind, device, consoleId, orientation) {
    return (LAYOUT_KINDS[kind] || buildLayout)(device, consoleId, orientation);
  }

  // Keep generated ids unique after loading a saved project.
  function bumpIds(orients) {
    for (const o of orients) {
      for (const item of o.items) {
        const n = parseInt(String(item.id).slice(1), 10);
        if (n >= nextId) nextId = n + 1;
      }
    }
  }

  function newItem(consoleId, input, mappingSize) {
    const size = 50;
    const kind = input === 'dpad' ? 'dpad' : input === 'thumbstick' ? 'thumbstick' : 'button';
    const w = kind === 'button' ? size : 120;
    const item = {
      id: newId(),
      kind,
      inputs: kind === 'dpad' ? { ...DPAD_INPUTS } : kind === 'thumbstick' ? { ...STICK_INPUTS } : [input],
      label: kind === 'button' ? defaultLabel(input) : '',
      shape: kind === 'dpad' ? 'dpad' : kind === 'thumbstick' ? 'stick' : 'circle',
      frame: rect((mappingSize.width - w) / 2, (mappingSize.height - w) / 2, w, w),
    };
    if (kind === 'thumbstick') item.thumbstick = { name: `thumbstick_${item.id}`, width: 60, height: 60 };
    return item;
  }

  // Delta's app buttons get a drawn icon instead of text (see DeltaRender ICONS).
  const LABELS = {
    menu: '',
    quickSave: '',
    quickLoad: '',
    fastForward: '',
    toggleFastForward: '',
    select: 'SELECT',
    start: 'START',
    mode: 'MODE',
    cUp: 'C▲',
    cDown: 'C▼',
    cLeft: 'C◀',
    cRight: 'C▶',
  };

  function defaultLabel(input) {
    return input in LABELS ? LABELS[input] : input.toUpperCase();
  }

  const api = { buildLayout, buildFlipPadLayout, buildLayoutKind, syncTouch, mappingSizeFor, newItem, newId, defaultLabel, bumpIds, DEFAULT_EDGES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeltaLayout = api;
})(typeof window !== 'undefined' ? window : globalThis);
