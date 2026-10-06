// Project defaults, migrations of older saves and resets (src/app/state.ts).

import { describe, expect, it } from 'vitest';
import * as State from '../src/app/state';
import { DEFAULT_STYLE } from '../src/render';
import { getDevice } from '../src/devices';
import type { ProjectState } from '../src/types';

describe('defaultState', () => {
  it('is a GBA skin for the iPhone 17 Pro with an auto identifier', () => {
    const state = State.defaultState();
    expect(state.consoleId).toBe('gba');
    expect(state.deviceId).toBe('iphone-17-pro');
    expect(state.name).toBe('My GBA Skin');
    expect(state.identifier).toBe('com.deltaskin.gba.mygbaskin.iphone17pro');
    expect(state.style).toEqual(DEFAULT_STYLE);
    expect(state.orientations.portrait.items.length).toBeGreaterThan(0);
    expect(state.orientations.landscape.enabled).toBe(true);
  });

  it('is a fresh copy every time', () => {
    const a = State.defaultState();
    a.style.bg = '#ffffff';
    a.device.safe.portrait.top = 0;
    const b = State.defaultState();
    expect(b.style.bg).toBe(DEFAULT_STYLE.bg);
    expect(b.device.safe.portrait.top).toBe(62);
  });
});

describe('style', () => {
  it('has color keys for every color but not the opacity', () => {
    expect(State.STYLE_COLOR_KEYS).toEqual(['bg', 'bg2', 'bezel', 'button', 'accent', 'text']);
  });

  it('upgrades the legacy palette to the new default, keeping the opacity', () => {
    const state = { style: { ...State.LEGACY_STYLE, landscapeOpacity: 0.8 } };
    State.upgradeStyle(state);
    expect(state.style).toEqual({ ...DEFAULT_STYLE, landscapeOpacity: 0.8 });
  });

  it('leaves a custom palette alone', () => {
    const style = { ...DEFAULT_STYLE, bg: '#123456' };
    expect(State.upgradeStyle({ style }).style).toEqual(style);
    expect(State.upgradeStyle(null)).toBeNull();
  });
});

describe('names and identifiers', () => {
  it('recognizes default skin names, new and legacy', () => {
    expect(State.defaultSkinName('snes')).toBe('My SNES Skin');
    expect(State.isDefaultSkinName('My SNES Skin', 'snes')).toBe(true);
    expect(State.isDefaultSkinName('Minha Skin SNES', 'snes')).toBe(true);
    expect(State.isDefaultSkinName('My SNES Skin', 'gba')).toBe(false);
    expect(State.isDefaultSkinName('Cool skin', 'snes')).toBe(false);
  });

  it('only follows the name while the identifier is automatic', () => {
    const state = State.defaultState();
    state.name = 'Night Mode';
    State.refreshIdentifier(state);
    expect(state.identifier).toBe('com.deltaskin.gba.nightmode.iphone17pro');
    state.identifierAuto = false;
    state.identifier = 'com.me.custom';
    state.name = 'Other';
    State.refreshIdentifier(state);
    expect(state.identifier).toBe('com.me.custom');
  });
});

describe('layouts and restores', () => {
  it('keeps enabled flags, and hidden controls only when allowed, on fresh orientations', () => {
    const device = getDevice('iphone-17-pro')!;
    const prev = State.freshOrientations(device, 'gba');
    prev.landscape.enabled = false;
    prev.portrait.drawControls = false;
    const kept = State.freshOrientations(device, 'gba', 'flippad', prev, (o) => o === 'portrait');
    expect(kept.landscape.enabled).toBe(false);
    expect(kept.portrait.drawControls).toBe(false);
    const dropped = State.freshOrientations(device, 'gba', 'flippad', prev);
    expect(dropped.portrait.drawControls).toBeUndefined();
  });

  it('fills missing fields and rejects non-projects', () => {
    const saved: Partial<ProjectState> = { ...State.defaultState(), name: 'Saved', consoleId: 'nes' };
    delete saved.showTitle;
    const restored = State.restoreState(JSON.parse(JSON.stringify(saved)));
    expect(restored.name).toBe('Saved');
    expect(restored.showTitle).toBe(true);
    expect(restored.identifier).toBe('com.deltaskin.nes.saved.iphone17pro');
    expect(State.isProjectData({ foo: 1 })).toBe(false);
    expect(State.restoreState({ foo: 1 }).name).toBe('My GBA Skin');
    expect(State.restoreState(null).name).toBe('My GBA Skin');
  });

  it('restores the preset safe areas', () => {
    const state = State.defaultState();
    state.device.safe.portrait.top = 10;
    expect(State.presetDevice(state).safe.portrait.top).toBe(62);
  });

  it('keeps a custom device size', () => {
    const state = State.defaultState();
    state.deviceId = 'custom';
    state.device = { ...state.device, id: 'custom', points: { w: 500, h: 1000 }, scale: 2, family: 'standard' };
    state.device.safe = { portrait: { top: 99, bottom: 99 }, landscape: { left: 9, right: 9, bottom: 9 } };
    const device = State.presetDevice(state);
    expect(device.points).toEqual({ w: 500, h: 1000 });
    expect(device.scale).toBe(2);
    expect(device.safe.portrait.top).toBe(0);
  });
});

describe('defaultView', () => {
  it('turns guides and overlays on, grid off', () => {
    expect(State.defaultView()).toEqual({
      guides: true,
      grid: { show: false, snap: false, size: 8 },
      showSafe: true,
      showDebug: true,
    });
  });
});
