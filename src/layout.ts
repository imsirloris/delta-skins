// Default control layouts. Everything is in points (logical resolution), as Delta expects.
//
// Each element is positioned relative to a region:
//   portrait  -> the control area below the game screen(s)
//   landscape -> 'left' / 'right' columns (inside the safe area) or 'center' (whole skin)
// `g` is the anchor as a fraction of the region, `d` an offset in base points that is
// multiplied by the scale factor `s` (base design = 414pt wide).

import * as Consoles from './consoles';
import type {
  ButtonItem,
  ConsoleDef,
  ConsoleId,
  Device,
  DirectionalItem,
  Frame,
  FullEdges,
  Item,
  ItemKind,
  LayoutKind,
  Orientation,
  OrientationLayout,
  Shape,
  Size,
} from './types';

// Anchor inside a region: `g` as a fraction of the region, `d` in base points (times `s`).
interface Anchor {
  g: [number, number];
  d: [number, number];
}

type LandscapeRegion = 'left' | 'right' | 'center';

interface LandscapeAnchor extends Anchor {
  r: LandscapeRegion;
}

// Element of a default layout, before it is placed on a device.
interface Template {
  kind: ItemKind;
  inputs: string[] | Record<string, string>;
  label: string;
  shape: Shape;
  w: number;
  h: number;
  p: Anchor;
  ls: LandscapeAnchor;
  stick?: number;
}

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SafeInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const DPAD_INPUTS = { up: 'up', down: 'down', left: 'left', right: 'right' };
const STICK_INPUTS = { up: 'analogStickUp', down: 'analogStickDown', left: 'analogStickLeft', right: 'analogStickRight' };
const DEFAULT_EDGES: FullEdges = { top: 8, bottom: 8, left: 8, right: 8 };

function button(input: string, label: string, size: number, p: Anchor, ls: LandscapeAnchor, shape?: Shape): Template {
  return { kind: 'button', inputs: [input], label, shape: shape || 'circle', w: size, h: size, p, ls };
}

function pill(input: string, label: string, p: Anchor, ls: LandscapeAnchor): Template {
  return { kind: 'button', inputs: [input], label, shape: 'pill', w: 60, h: 24, p, ls };
}

function shoulder(input: string, label: string, side: 'left' | 'right'): Template {
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

const dpad = (p: Anchor, ls: LandscapeAnchor, size?: number): Template => ({ kind: 'dpad', inputs: DPAD_INPUTS, label: '', shape: 'dpad', w: size || 130, h: size || 130, p, ls });
const menu = () => button('menu', '', 36, { g: [0.5, 0], d: [0, 26] }, { r: 'center', g: [0.5, 1], d: [0, -24] });

// Portrait/landscape group anchors shared by most consoles.
const P_DPAD: Anchor = { g: [0.25, 0.45], d: [0, 0] };
const L_DPAD: LandscapeAnchor = { r: 'left', g: [0.5, 0.55], d: [0, 0] };
const FACE_P: [number, number] = [0.75, 0.45];
const FACE_L: LandscapeAnchor['g'] = [0.5, 0.55];

// Face button at offset (dx, dy) from the face group anchor.
function face(input: string, label: string, size: number, dx: number, dy: number): Template {
  return button(input, label, size, { g: FACE_P, d: [dx, dy] }, { r: 'right', g: FACE_L, d: [dx, dy] });
}

function selectStart(selectInput: string, selectLabel: string): Template[] {
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

const ELEMENTS: Record<ConsoleId, () => Template[]> = {
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
    const g6 = (input: string, label: string, dx: number, dy: number) => face(input, label, 50, dx, dy);
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
    const c = (input: string, label: string, dx: number, dy: number) =>
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

const round = (v: number) => Math.round(v);

function rect(x: number, y: number, width: number, height: number): Frame {
  return { x: round(x), y: round(y), width: round(width), height: round(height) };
}

// Fit a w×h box with the given aspect inside maxW×maxH.
function fit(aspect: number, maxW: number, maxH: number): { w: number; h: number } {
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w, h };
}

function makeScreens(con: ConsoleDef, frames: Frame[]): OrientationLayout['screens'] {
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

function screenAspect(con: ConsoleDef): number {
  const { width, height } = con.inputFrame;
  return con.dualScreen ? width / (height / 2) : width / height;
}

function portraitScreens(con: ConsoleDef, W: number, H: number, safe: Pick<SafeInsets, 'top' | 'bottom'>): Frame[] {
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

function landscapeScreens(con: ConsoleDef, W: number, H: number, safe: Pick<SafeInsets, 'left' | 'right'>): Frame[] {
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

function clampFrame(f: Frame, W: number, H: number): Frame {
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
const newId = (): string => 'i' + nextId++;

function toItem(el: Template, cx: number, cy: number, s: number, orientation: Orientation): Item {
  const w = el.w * s;
  const h = el.h * s;
  const id = newId();
  const { label, shape } = el;
  const frame = rect(cx - w / 2, cy - h / 2, w, h);
  if (Array.isArray(el.inputs)) return { id, kind: 'button', inputs: [...el.inputs], label, shape, frame };
  const item: DirectionalItem = { id, kind: el.kind as DirectionalItem['kind'], inputs: { ...el.inputs }, label, shape, frame };
  if (el.kind === 'thumbstick') {
    const size = round((el.stick ?? 0) * s);
    item.thumbstick = { name: `${orientation}_thumbstick`, width: size, height: size };
  }
  return item;
}

function touchItem(frame: Frame): DirectionalItem {
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
function syncTouch(orient: OrientationLayout): void {
  const touch = orient.items.find((i) => i.kind === 'touch');
  if (touch && orient.screens[1]) touch.frame = { ...orient.screens[1].outputFrame };
}

function mappingSizeFor(device: Device, orientation: Orientation): Size {
  const { w, h } = device.points;
  return orientation === 'portrait' ? { width: w, height: h } : { width: h, height: w };
}

function buildLayout(device: Device, consoleId: ConsoleId, orientation: Orientation): OrientationLayout {
  const con = Consoles.CONSOLES[consoleId];
  const mappingSize = mappingSizeFor(device, orientation);
  const W = mappingSize.width;
  const H = mappingSize.height;
  const elements = ELEMENTS[consoleId]();
  let frames: Frame[];
  let regionFor: (el: Template) => Region;
  let s: number;

  if (orientation === 'portrait') {
    const safe = device.safe.portrait;
    frames = portraitScreens(con, W, H, safe);
    const screenBottom = Math.max(...frames.map((f) => f.y + f.height));
    const top = screenBottom + 8;
    const bottom = H - safe.bottom - 6;
    const region = { x: 0, y: top, w: W, h: bottom - top };
    s = Math.min(W / 414, region.h / 330);
    regionFor = () => region;
  } else {
    const safe = device.safe.landscape;
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
// provides the game buttons. Measurements come from the "ekwipt_graphite" GBA FlipPad
// skin (iPhone 17 Pro, 402×874pt, safe top 62pt) and are scaled to other iPhones by width.
const FLIPPAD_BASE = {
  width: 402,
  safeTop: 62,
  // Where the controller starts covering the screen.
  coverTop: 550,
  // Delta buttons in the reference skin's style: a row of spaced-out text labels
  // (MENU / SAVE / LOAD / FFW) sitting right above the covered area.
  buttonGap: 4, // between the buttons and the covered area
  buttonWidth: 76,
  buttonHeight: 30,
  buttons: [
    { input: 'menu', label: 'MENU', cx: 53 },
    { input: 'quickSave', label: 'SAVE', cx: 148 },
    { input: 'quickLoad', label: 'LOAD', cx: 247.5 },
    { input: 'toggleFastForward', label: 'FFW', cx: 351.5 },
  ],
  // Minimum space between the game screen(s) and the buttons / safe-area top. DS screens
  // fill everything above the buttons; single screens are centered in that space, 8pt
  // from the sides.
  screenGap: 8,
  screenMargin: 8,
};

// Base-layout y (402pt wide iPhone) -> target device, keeping the offset from the safe top.
function flipPadY(device: Device, y: number): number {
  const s = device.points.w / FLIPPAD_BASE.width;
  return device.safe.portrait.top + (y - FLIPPAD_BASE.safeTop) * s;
}

function flipPadCoverTop(device: Device): number {
  return Math.round(flipPadY(device, FLIPPAD_BASE.coverTop));
}

function buildFlipPadLayout(device: Device, consoleId: ConsoleId, orientation: Orientation): OrientationLayout {
  // The FlipPad is only used in portrait; landscape keeps the regular layout.
  if (orientation !== 'portrait') return buildLayout(device, consoleId, orientation);

  const con = Consoles.CONSOLES[consoleId];
  const mappingSize = mappingSizeFor(device, orientation);
  const W = mappingSize.width;
  const H = mappingSize.height;
  const safe = device.safe.portrait;
  const s = W / FLIPPAD_BASE.width;
  const coverTop = flipPadY(device, FLIPPAD_BASE.coverTop);
  const buttonH = FLIPPAD_BASE.buttonHeight * s;
  const buttonY = coverTop - FLIPPAD_BASE.buttonGap * s - buttonH;
  const base = Math.round(buttonY - FLIPPAD_BASE.screenGap * s);
  const margin = FLIPPAD_BASE.screenMargin * s;
  const aspect = screenAspect(con);

  // Screen(s) as large as possible between the safe top and the base line.
  let frames: Frame[];
  if (con.dualScreen) {
    const size = fit(aspect, W - margin * 2, (base - safe.top) / 2);
    const width = Math.floor(size.w);
    const height = Math.floor(size.h);
    const x = (W - width) / 2;
    frames = [rect(x, base - height * 2, width, height), rect(x, base - height, width, height)];
  } else {
    // Single screen: centered between the safe-area top and the buttons, keeping at
    // least `screenGap` above and below.
    const gap = FLIPPAD_BASE.screenGap * s;
    const size = fit(aspect, W - margin * 2, buttonY - safe.top - gap * 2);
    const width = Math.floor(size.w);
    const height = Math.floor(size.h);
    frames = [rect((W - width) / 2, safe.top + (buttonY - safe.top - height) / 2, width, height)];
  }

  const buttonW = FLIPPAD_BASE.buttonWidth * s;
  const items: Item[] = FLIPPAD_BASE.buttons.map((b): ButtonItem => ({
    id: newId(),
    kind: 'button',
    inputs: [b.input],
    label: b.label,
    shape: 'text',
    frame: clampFrame(rect(b.cx * s - buttonW / 2, buttonY, buttonW, buttonH), W, H),
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

const LAYOUT_KINDS: Partial<Record<LayoutKind, typeof buildLayout>> = {
  standard: buildLayout,
  flippad: buildFlipPadLayout,
};

function buildLayoutKind(kind: LayoutKind | string, device: Device, consoleId: ConsoleId, orientation: Orientation): OrientationLayout {
  return (LAYOUT_KINDS[kind as LayoutKind] || buildLayout)(device, consoleId, orientation);
}

// Keep generated ids unique after loading a saved project.
function bumpIds(orients: OrientationLayout[]): void {
  for (const o of orients) {
    for (const item of o.items) {
      const n = parseInt(String(item.id).slice(1), 10);
      if (n >= nextId) nextId = n + 1;
    }
  }
}

// `input` is a console/Delta input, or 'dpad' / 'thumbstick' for a directional control.
function newItem(input: string, mappingSize: Size): Item {
  if (input !== 'dpad' && input !== 'thumbstick') {
    const size = 50;
    const frame = rect((mappingSize.width - size) / 2, (mappingSize.height - size) / 2, size, size);
    return { id: newId(), kind: 'button', inputs: [input], label: defaultLabel(input), shape: 'circle', frame };
  }
  const size = 120;
  const frame = rect((mappingSize.width - size) / 2, (mappingSize.height - size) / 2, size, size);
  if (input === 'dpad') return { id: newId(), kind: 'dpad', inputs: { ...DPAD_INPUTS }, label: '', shape: 'dpad', frame };
  const id = newId();
  return { id, kind: 'thumbstick', inputs: { ...STICK_INPUTS }, label: '', shape: 'stick', frame, thumbstick: { name: `thumbstick_${id}`, width: 60, height: 60 } };
}

// Delta's app buttons get a drawn icon instead of text (see DeltaRender ICONS).
const LABELS: Record<string, string> = {
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

function defaultLabel(input: string): string {
  return input in LABELS ? LABELS[input] : input.toUpperCase();
}

export { buildLayout, buildFlipPadLayout, buildLayoutKind, flipPadCoverTop, syncTouch, mappingSizeFor, newItem, newId, defaultLabel, bumpIds, DEFAULT_EDGES };
