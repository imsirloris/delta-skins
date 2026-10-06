// Project state: defaults, migrations of older saves and pure helpers over the state object.
// No DOM, so the Node test scripts can load it.
(function (root) {
  'use strict';

  const isNode = typeof module === 'object' && module.exports;
  const Devices = isNode ? require('../devices.js') : root.DeltaDevices;
  const Consoles = isNode ? require('../consoles.js') : root.DeltaConsoles;
  const Layout = isNode ? require('../layout.js') : root.DeltaLayout;
  const { slug, ORIENTATIONS } = isNode ? require('../skinjson.js') : root.DeltaSkinJson;
  const { DEFAULT_STYLE } = isNode ? require('../render.js') : root.DeltaRender;

  const STATE_VERSION = 1;
  const DEFAULT_DEVICE_ID = 'iphone-17-pro';
  const DEFAULT_CONSOLE_ID = 'gba';
  const DEFAULT_LAYOUT_KIND = 'standard';

  // Color inputs of the art panel (DEFAULT_STYLE also holds the landscape opacity).
  const STYLE_COLOR_KEYS = Object.keys(DEFAULT_STYLE).filter((key) => typeof DEFAULT_STYLE[key] === 'string');

  // Default art colors before the 8BitDo black matte palette; projects still on them get the new defaults.
  const LEGACY_STYLE = { bg: '#2b2d42', bg2: '#1b1c2b', bezel: '#111219', button: '#3d405b', accent: '#ef233c', text: '#edf2f4' };

  const defaultStyle = () => ({ ...DEFAULT_STYLE });

  // Editor view preferences (not part of the project file).
  const defaultView = () => ({
    guides: true,
    grid: { show: false, snap: false, size: 8 },
    showSafe: true,
    showDebug: true,
  });

  const tag = (consoleId) => consoleId.toUpperCase();
  const defaultSkinName = (consoleId) => `My ${tag(consoleId)} Skin`;

  // True while the name is still the generated one, so switching console may rename it.
  // Also accepts the name older (Portuguese) versions generated.
  function isDefaultSkinName(name, consoleId) {
    return name === defaultSkinName(consoleId) || name === `Minha Skin ${tag(consoleId)}`;
  }

  function autoIdentifier(state) {
    const name = slug(state.name).replace(/-/g, '');
    return `com.deltaskin.${state.consoleId}.${name}.${state.deviceId.replace(/-/g, '')}`;
  }

  function refreshIdentifier(state) {
    if (state.identifierAuto) state.identifier = autoIdentifier(state);
    return state;
  }

  // New layouts for both orientations. `prev` (the orientations being replaced) keeps its
  // enabled flags; `keepsHiddenControls(orientation)` says whether an orientation that hid the
  // drawn controls should keep doing so (only sensible over the user's own artwork).
  function freshOrientations(device, consoleId, kind = DEFAULT_LAYOUT_KIND, prev = null, keepsHiddenControls = () => false) {
    const out = {};
    for (const orientation of ORIENTATIONS) {
      out[orientation] = Layout.buildLayoutKind(kind, device, consoleId, orientation);
      const old = prev && prev[orientation];
      if (!old) continue;
      out[orientation].enabled = old.enabled;
      if (old.drawControls === false && keepsHiddenControls(orientation)) out[orientation].drawControls = false;
    }
    return out;
  }

  function defaultState() {
    const device = Devices.getDevice(DEFAULT_DEVICE_ID);
    const state = {
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

  function upgradeStyle(state) {
    const style = state && state.style;
    if (!style) return state;
    const isLegacy = Object.entries(LEGACY_STYLE).every(([key, value]) => style[key] === value);
    if (!isLegacy) return state;
    state.style = { ...defaultStyle(), landscapeOpacity: style.landscapeOpacity ?? DEFAULT_STYLE.landscapeOpacity };
    return state;
  }

  function isProjectData(data) {
    return Boolean(data && data.orientations && data.device && Consoles.CONSOLES[data.consoleId]);
  }

  // Project from a saved file or autosave, with defaults for anything older versions lacked.
  function restoreState(data) {
    if (!isProjectData(data)) return defaultState();
    const state = upgradeStyle({ ...defaultState(), ...data });
    Layout.bumpIds(Object.values(state.orientations));
    return refreshIdentifier(state);
  }

  // The selected iPhone preset with its original safe areas (custom devices keep their size).
  function presetDevice(state) {
    if (state.deviceId !== 'custom') return Devices.getDevice(state.deviceId);
    const { points, scale, family } = state.device;
    return Devices.customDevice(points.w, points.h, scale, family);
  }

  const api = {
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
  if (isNode) module.exports = api;
  else root.DeltaState = api;
})(typeof window !== 'undefined' ? window : globalThis);
