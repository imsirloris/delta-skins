#!/usr/bin/env node
// Unit checks for js/app/state.js (defaults, migrations, resets). Usage: node scripts/state-test.js
import assert from 'node:assert';
import * as State from '../src/app/state.js';
import { DEFAULT_STYLE } from '../src/render.js';
import { getDevice } from '../src/devices.js';

const tests = {
  'default state is a GBA skin for the iPhone 17 Pro with an auto identifier'() {
    const state = State.defaultState();
    assert.strictEqual(state.consoleId, 'gba');
    assert.strictEqual(state.deviceId, 'iphone-17-pro');
    assert.strictEqual(state.name, 'My GBA Skin');
    assert.strictEqual(state.identifier, 'com.deltaskin.gba.mygbaskin.iphone17pro');
    assert.deepStrictEqual(state.style, DEFAULT_STYLE);
    assert.ok(state.orientations.portrait.items.length > 0);
    assert.ok(state.orientations.landscape.enabled);
  },

  'default state is a fresh copy every time'() {
    const a = State.defaultState();
    a.style.bg = '#ffffff';
    a.device.safe.portrait.top = 0;
    const b = State.defaultState();
    assert.strictEqual(b.style.bg, DEFAULT_STYLE.bg);
    assert.strictEqual(b.device.safe.portrait.top, 62);
  },

  'style color keys cover every color but not the opacity'() {
    assert.deepStrictEqual(State.STYLE_COLOR_KEYS, ['bg', 'bg2', 'bezel', 'button', 'accent', 'text']);
  },

  'legacy palette upgrades to the new default, keeping the opacity'() {
    const state = { style: { ...State.LEGACY_STYLE, landscapeOpacity: 0.8 } };
    State.upgradeStyle(state);
    assert.deepStrictEqual(state.style, { ...DEFAULT_STYLE, landscapeOpacity: 0.8 });
  },

  'custom palette is left alone'() {
    const style = { ...DEFAULT_STYLE, bg: '#123456' };
    assert.deepStrictEqual(State.upgradeStyle({ style }).style, style);
    assert.strictEqual(State.upgradeStyle(null), null);
  },

  'default skin names, new and legacy, are recognized'() {
    assert.strictEqual(State.defaultSkinName('snes'), 'My SNES Skin');
    assert.ok(State.isDefaultSkinName('My SNES Skin', 'snes'));
    assert.ok(State.isDefaultSkinName('Minha Skin SNES', 'snes'));
    assert.ok(!State.isDefaultSkinName('My SNES Skin', 'gba'));
    assert.ok(!State.isDefaultSkinName('Cool skin', 'snes'));
  },

  'identifier only follows the name while it is automatic'() {
    const state = State.defaultState();
    state.name = 'Night Mode';
    State.refreshIdentifier(state);
    assert.strictEqual(state.identifier, 'com.deltaskin.gba.nightmode.iphone17pro');
    state.identifierAuto = false;
    state.identifier = 'com.me.custom';
    state.name = 'Other';
    State.refreshIdentifier(state);
    assert.strictEqual(state.identifier, 'com.me.custom');
  },

  'fresh orientations keep enabled flags and hidden controls only when allowed'() {
    const device = getDevice('iphone-17-pro');
    const prev = State.freshOrientations(device, 'gba');
    prev.landscape.enabled = false;
    prev.portrait.drawControls = false;
    const kept = State.freshOrientations(device, 'gba', 'flippad', prev, (o) => o === 'portrait');
    assert.strictEqual(kept.landscape.enabled, false);
    assert.strictEqual(kept.portrait.drawControls, false);
    const dropped = State.freshOrientations(device, 'gba', 'flippad', prev);
    assert.strictEqual(dropped.portrait.drawControls, undefined);
  },

  'restoreState fills missing fields and rejects non-projects'() {
    const saved = { ...State.defaultState(), name: 'Saved', consoleId: 'nes' };
    delete saved.showTitle;
    const restored = State.restoreState(JSON.parse(JSON.stringify(saved)));
    assert.strictEqual(restored.name, 'Saved');
    assert.strictEqual(restored.showTitle, true);
    assert.strictEqual(restored.identifier, 'com.deltaskin.nes.saved.iphone17pro');
    assert.ok(!State.isProjectData({ foo: 1 }));
    assert.strictEqual(State.restoreState({ foo: 1 }).name, 'My GBA Skin');
    assert.strictEqual(State.restoreState(null).name, 'My GBA Skin');
  },

  'presetDevice restores the preset safe areas'() {
    const state = State.defaultState();
    state.device.safe.portrait.top = 10;
    assert.strictEqual(State.presetDevice(state).safe.portrait.top, 62);
  },

  'presetDevice keeps a custom device size'() {
    const state = State.defaultState();
    state.deviceId = 'custom';
    state.device = { ...state.device, id: 'custom', points: { w: 500, h: 1000 }, scale: 2, family: 'standard' };
    state.device.safe = { portrait: { top: 99, bottom: 99 }, landscape: { left: 9, right: 9, bottom: 9 } };
    const device = State.presetDevice(state);
    assert.deepStrictEqual(device.points, { w: 500, h: 1000 });
    assert.strictEqual(device.scale, 2);
    assert.strictEqual(device.safe.portrait.top, 0);
  },

  'default view turns guides and overlays on, grid off'() {
    assert.deepStrictEqual(State.defaultView(), {
      guides: true,
      grid: { show: false, snap: false, size: 8 },
      showSafe: true,
      showDebug: true,
    });
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}\n     ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
