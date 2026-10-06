// Builds Delta's info.json from the editor state. Pure (no DOM) so Node scripts can reuse it.
(function (root) {
  'use strict';

  const Consoles = typeof module === 'object' && module.exports ? require('./consoles.js') : root.DeltaConsoles;
  const ORIENTATIONS = ['portrait', 'landscape'];

  function slug(text) {
    return (
      String(text)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'skin'
    );
  }

  function assetNames(orientation, format) {
    if (format === 'png') {
      const file = `iphone_${orientation}.png`;
      return { small: file, medium: file, large: file };
    }
    return { resizable: `iphone_${orientation}.pdf` };
  }

  function thumbstickFile(item, format) {
    return `${item.thumbstick.name}.${format === 'png' ? 'png' : 'pdf'}`;
  }

  function hasEdges(edges) {
    return edges && ['top', 'bottom', 'left', 'right'].some((k) => typeof edges[k] === 'number');
  }

  function exportItem(item, format) {
    const out = { inputs: Array.isArray(item.inputs) ? [...item.inputs] : { ...item.inputs } };
    if (item.kind === 'thumbstick' && item.thumbstick) {
      out.thumbstick = {
        name: thumbstickFile(item, format),
        width: item.thumbstick.width,
        height: item.thumbstick.height,
      };
    }
    out.frame = { ...item.frame };
    if (hasEdges(item.extendedEdges)) out.extendedEdges = { ...item.extendedEdges };
    return out;
  }

  function exportScreen(screen, con) {
    const out = {};
    if (!con.omitInputFrame) out.inputFrame = { ...screen.inputFrame };
    out.outputFrame = { ...screen.outputFrame };
    if (screen.filters && screen.filters.length) out.filters = JSON.parse(JSON.stringify(screen.filters));
    return out;
  }

  function buildInfoJson(state) {
    const con = Consoles.CONSOLES[state.consoleId];
    const family = {};
    for (const orientation of ORIENTATIONS) {
      const o = state.orientations[orientation];
      if (!o || !o.enabled) continue;
      const rep = {
        assets: assetNames(orientation, state.assetFormat),
        items: o.items.map((item) => exportItem(item, state.assetFormat)),
        screens: o.screens.map((s) => exportScreen(s, con)),
        mappingSize: { ...o.mappingSize },
        extendedEdges: { ...o.extendedEdges },
      };
      if (o.translucent) rep.translucent = true;
      family[orientation] = rep;
    }
    return {
      name: state.name,
      identifier: state.identifier,
      gameTypeIdentifier: con.gameTypeIdentifier,
      debug: !!state.debug,
      representations: { iphone: { [state.device.family]: family } },
    };
  }

  // Files referenced by info.json, keyed by file name, with what to render for each.
  function assetPlan(state) {
    const plan = [];
    for (const orientation of ORIENTATIONS) {
      const o = state.orientations[orientation];
      if (!o || !o.enabled) continue;
      const names = assetNames(orientation, state.assetFormat);
      plan.push({ file: names.resizable || names.large, type: 'skin', orientation });
      for (const item of o.items) {
        if (item.kind === 'thumbstick' && item.thumbstick) {
          plan.push({ file: thumbstickFile(item, state.assetFormat), type: 'thumbstick', orientation, item });
        }
      }
    }
    return plan;
  }

  const api = { buildInfoJson, assetPlan, slug, ORIENTATIONS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeltaSkinJson = api;
})(typeof window !== 'undefined' ? window : globalThis);
