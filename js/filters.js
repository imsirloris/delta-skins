// CoreImage filter presets for `screens[].filters`
// (from https://noah978.gitbook.io/delta-docs/skins/filter-examples).
(function (root) {
  'use strict';

  const FILTER_PRESETS = [
    {
      id: 'monochrome',
      name: 'Monocromático 50% cinza (CIColorMonochrome)',
      filter: {
        name: 'CIColorMonochrome',
        parameters: { inputIntensity: 0.5, inputColor: { r: 128, g: 128, b: 128 } },
      },
    },
    {
      id: 'gameboy',
      name: 'Verde Game Boy (CIColorMonochrome)',
      filter: {
        name: 'CIColorMonochrome',
        parameters: { inputIntensity: 1, inputColor: { r: 155, g: 188, b: 15 } },
      },
    },
    {
      id: 'rotate180',
      name: 'Girar 180° (CIAffineTransform)',
      filter: { name: 'CIAffineTransform', parameters: { inputTransform: { rotation: 180 } } },
    },
    {
      id: 'mirror',
      name: 'Espelhar horizontal (CIAffineTransform)',
      filter: { name: 'CIAffineTransform', parameters: { inputTransform: { scaleX: -1 } } },
    },
    {
      id: 'gradient',
      name: 'Gradiente (CISmoothLinearGradient)',
      filter: {
        name: 'CISmoothLinearGradient',
        parameters: {
          inputPoint0: { x: 120, y: 0 },
          inputPoint1: { x: 120, y: 53 },
          inputColor0: { r: 255, g: 255, b: 255, a: 0 },
          inputColor1: { r: 0, g: 0, b: 0 },
        },
      },
    },
    {
      id: 'crystallize',
      name: 'Cristalizar (CICrystallize)',
      filter: { name: 'CICrystallize', parameters: { inputRadius: 6, inputCenter: { x: 120, y: 0 } } },
    },
  ];

  function presetFilter(id) {
    const preset = FILTER_PRESETS.find((p) => p.id === id);
    return preset ? JSON.parse(JSON.stringify(preset.filter)) : null;
  }

  const api = { FILTER_PRESETS, presetFilter };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DeltaFilters = api;
})(typeof window !== 'undefined' ? window : globalThis);
