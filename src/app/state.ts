// Project state: defaults, migrations of older saves and pure helpers over the state object.
// No DOM, so the Node test scripts can load it.

import * as Devices from '../devices';
import * as Consoles from '../consoles';
import * as Layout from '../layout';
import { slug, ORIENTATIONS } from '../skinjson';
import { DEFAULT_STYLE } from '../render';
import type {
  ConsoleId,
  Device,
  LayoutKind,
  Orientation,
  OrientationLayout,
  Orientations,
  ProjectState,
  Style,
  StyleColorKey,
  ViewPrefs,
} from '../types';

const STATE_VERSION = 1;
const DEFAULT_DEVICE_ID = 'iphone-17-pro';
const DEFAULT_CONSOLE_ID: ConsoleId = 'gba';
const DEFAULT_LAYOUT_KIND: LayoutKind = 'standard';

// Color inputs of the art panel (DEFAULT_STYLE also holds the landscape opacity).
const STYLE_COLOR_KEYS = (Object.keys(DEFAULT_STYLE) as (keyof Style)[]).filter(
  (key): key is StyleColorKey => typeof DEFAULT_STYLE[key] === 'string',
);

// Default art colors before the 8BitDo black matte palette; projects still on them get the new defaults.
const LEGACY_STYLE: Record<StyleColorKey, string> = { bg: '#2b2d42', bg2: '#1b1c2b', bezel: '#111219', button: '#3d405b', accent: '#ef233c', text: '#edf2f4' };

const defaultStyle = (): Style => ({ ...DEFAULT_STYLE });

// Editor view preferences (not part of the project file).
const defaultView = (): ViewPrefs => ({
  guides: true,
  grid: { show: false, snap: false, size: 8 },
  showSafe: true,
  showDebug: true,
});

const tag = (consoleId: ConsoleId) => consoleId.toUpperCase();
const defaultSkinName = (consoleId: ConsoleId): string => `My ${tag(consoleId)} Skin`;

// True while the name is still the generated one, so switching console may rename it.
// Also accepts the name older (Portuguese) versions generated.
function isDefaultSkinName(name: string, consoleId: ConsoleId): boolean {
  return name === defaultSkinName(consoleId) || name === `Minha Skin ${tag(consoleId)}`;
}

function autoIdentifier(state: Pick<ProjectState, 'name' | 'consoleId' | 'deviceId'>): string {
  const name = slug(state.name).replace(/-/g, '');
  return `com.deltaskin.${state.consoleId}.${name}.${state.deviceId.replace(/-/g, '')}`;
}

function refreshIdentifier<T extends ProjectState>(state: T): T {
  if (state.identifierAuto) state.identifier = autoIdentifier(state);
  return state;
}

// New layouts for both orientations. `prev` (the orientations being replaced) keeps its
// enabled flags; `keepsHiddenControls(orientation)` says whether an orientation that hid the
// drawn controls should keep doing so (only sensible over the user's own artwork).
function freshOrientations(
  device: Device,
  consoleId: ConsoleId,
  kind: LayoutKind = DEFAULT_LAYOUT_KIND,
  prev: Partial<Orientations> | null = null,
  keepsHiddenControls: (orientation: Orientation) => boolean = () => false,
): Orientations {
  const out = {} as Orientations;
  for (const orientation of ORIENTATIONS) {
    const layout: OrientationLayout = Layout.buildLayoutKind(kind, device, consoleId, orientation);
    out[orientation] = layout;
    const old = prev && prev[orientation];
    if (!old) continue;
    layout.enabled = old.enabled;
    if (old.drawControls === false && keepsHiddenControls(orientation)) layout.drawControls = false;
  }
  return out;
}

function defaultState(): ProjectState {
  const device = Devices.getDevice(DEFAULT_DEVICE_ID)!;
  const state: ProjectState = {
    version: STATE_VERSION,
    name: defaultSkinName(DEFAULT_CONSOLE_ID),
    identifier: '',
    identifierAuto: true,
    deviceId: device.id,
    device,
    consoleId: DEFAULT_CONSOLE_ID,
    debug: false,
    assetFormat: 'pdf',
    showTitle: true,
    style: defaultStyle(),
    orientations: freshOrientations(device, DEFAULT_CONSOLE_ID),
    layoutKind: DEFAULT_LAYOUT_KIND,
    bgImages: {},
    layoutEdited: false,
  };
  return refreshIdentifier(state);
}

function upgradeStyle<T extends Pick<ProjectState, 'style'> | null>(state: T): T {
  const style = state && state.style;
  if (!style) return state;
  const isLegacy = Object.entries(LEGACY_STYLE).every(([key, value]) => style[key as StyleColorKey] === value);
  if (!isLegacy) return state;
  state.style = { ...defaultStyle(), landscapeOpacity: style.landscapeOpacity ?? DEFAULT_STYLE.landscapeOpacity };
  return state;
}

// A saved project (autosave or project file). Only the parts every version has are checked;
// restoreState() fills in the rest.
function isProjectData(data: unknown): data is Partial<ProjectState> & Pick<ProjectState, 'orientations' | 'device' | 'consoleId'> {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<ProjectState>;
  return Boolean(d.orientations && d.device && Consoles.isConsoleId(d.consoleId));
}

// Project from a saved file or autosave, with defaults for anything older versions lacked.
function restoreState(data: unknown): ProjectState {
  if (!isProjectData(data)) return defaultState();
  const state = upgradeStyle({ ...defaultState(), ...data });
  Layout.bumpIds(Object.values(state.orientations));
  return refreshIdentifier(state);
}

// The selected iPhone preset with its original safe areas (custom devices keep their size).
function presetDevice(state: Pick<ProjectState, 'deviceId' | 'device'>): Device {
  const preset = state.deviceId !== 'custom' && Devices.getDevice(state.deviceId);
  if (preset) return preset;
  const { points, scale, family } = state.device;
  return Devices.customDevice(points.w, points.h, scale, family);
}

export {
  STYLE_COLOR_KEYS,
  LEGACY_STYLE,
  defaultStyle,
  defaultView,
  defaultSkinName,
  isDefaultSkinName,
  autoIdentifier,
  refreshIdentifier,
  freshOrientations,
  defaultState,
  upgradeStyle,
  isProjectData,
  restoreState,
  presetDevice,
};
