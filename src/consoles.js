// Console metadata from the Delta skin docs (https://noah978.gitbook.io/delta-docs/skins).
// Inputs every system accepts (Delta app actions).

const CUSTOM_INPUTS = ['menu', 'quickSave', 'quickLoad', 'fastForward', 'toggleFastForward'];

const CONSOLES = {
  gbc: {
    id: 'gbc',
    name: 'Game Boy (Color)',
    gameTypeIdentifier: 'com.rileytestut.delta.game.gbc',
    inputFrame: { width: 160, height: 144 },
    buttons: ['a', 'b', 'select', 'start'],
  },
  gba: {
    id: 'gba',
    name: 'Game Boy Advance',
    gameTypeIdentifier: 'com.rileytestut.delta.game.gba',
    inputFrame: { width: 240, height: 160 },
    buttons: ['a', 'b', 'select', 'start', 'l', 'r'],
  },
  nes: {
    id: 'nes',
    name: 'NES',
    gameTypeIdentifier: 'com.rileytestut.delta.game.nes',
    inputFrame: { width: 256, height: 240 },
    buttons: ['a', 'b', 'select', 'start'],
  },
  snes: {
    id: 'snes',
    name: 'Super NES',
    gameTypeIdentifier: 'com.rileytestut.delta.game.snes',
    inputFrame: { width: 256, height: 224 },
    buttons: ['a', 'b', 'x', 'y', 'select', 'start', 'l', 'r'],
  },
  n64: {
    id: 'n64',
    name: 'Nintendo 64',
    gameTypeIdentifier: 'com.rileytestut.delta.game.n64',
    inputFrame: { width: 256, height: 224 },
    buttons: ['a', 'b', 'start', 'cUp', 'cDown', 'cLeft', 'cRight', 'l', 'r', 'z'],
  },
  ds: {
    id: 'ds',
    name: 'Nintendo DS',
    gameTypeIdentifier: 'com.rileytestut.delta.game.ds',
    // Full output: both screens stacked. Split into two screen objects.
    inputFrame: { width: 256, height: 384 },
    dualScreen: true,
    buttons: ['a', 'b', 'x', 'y', 'select', 'start', 'l', 'r'],
  },
  genesis: {
    id: 'genesis',
    name: 'Sega Genesis',
    gameTypeIdentifier: 'com.rileytestut.delta.game.genesis',
    // inputFrame is unsupported for Genesis (variable output size); only outputFrame is exported.
    inputFrame: { width: 320, height: 224 },
    omitInputFrame: true,
    buttons: ['a', 'b', 'c', 'x', 'y', 'z', 'start', 'mode'],
  },
};

const DIRECTIONAL_INPUTS = {
  dpad: ['up', 'down', 'left', 'right'],
  thumbstick: ['analogStickUp', 'analogStickDown', 'analogStickLeft', 'analogStickRight'],
  touch: ['touchScreenX', 'touchScreenY'],
};

function allowedInputs(consoleId) {
  const c = CONSOLES[consoleId];
  const list = [...c.buttons, ...CUSTOM_INPUTS, ...DIRECTIONAL_INPUTS.dpad, ...DIRECTIONAL_INPUTS.thumbstick];
  if (c.dualScreen) list.push(...DIRECTIONAL_INPUTS.touch);
  return list;
}

export { CONSOLES, CUSTOM_INPUTS, DIRECTIONAL_INPUTS, allowedInputs };
