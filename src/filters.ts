// CoreImage filter presets for `screens[].filters`
// (from https://noah978.gitbook.io/delta-docs/skins/filter-examples).

import type { ScreenFilter } from './types';

interface FilterPreset {
  id: string;
  name: string;
  filter: ScreenFilter;
}

const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'monochrome',
    name: 'Monochrome 50% gray (CIColorMonochrome)',
    filter: {
      name: 'CIColorMonochrome',
      parameters: { inputIntensity: 0.5, inputColor: { r: 128, g: 128, b: 128 } },
    },
  },
  {
    id: 'gameboy',
    name: 'Game Boy green (CIColorMonochrome)',
    filter: {
      name: 'CIColorMonochrome',
      parameters: { inputIntensity: 1, inputColor: { r: 155, g: 188, b: 15 } },
    },
  },
  {
    id: 'rotate180',
    name: 'Rotate 180° (CIAffineTransform)',
    filter: { name: 'CIAffineTransform', parameters: { inputTransform: { rotation: 180 } } },
  },
  {
    id: 'mirror',
    name: 'Mirror horizontally (CIAffineTransform)',
    filter: { name: 'CIAffineTransform', parameters: { inputTransform: { scaleX: -1 } } },
  },
  {
    id: 'gradient',
    name: 'Gradient (CISmoothLinearGradient)',
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
    name: 'Crystallize (CICrystallize)',
    filter: { name: 'CICrystallize', parameters: { inputRadius: 6, inputCenter: { x: 120, y: 0 } } },
  },
];

function presetFilter(id: string): ScreenFilter | null {
  const preset = FILTER_PRESETS.find((p) => p.id === id);
  return preset ? structuredClone(preset.filter) : null;
}

export { FILTER_PRESETS, presetFilter };
