// Builds the standard and FlipPad layouts for every iPhone × console and validates the
// resulting info.json, then checks that importing it back gives the same layout.

import { describe, expect, it } from 'vitest';
import { DEVICES } from '../src/devices';
import { CONSOLES } from '../src/consoles';
import * as Layout from '../src/layout';
import { buildInfoJson } from '../src/skinjson';
import { convertInfo } from '../src/importer';
import { validateInfo } from '../scripts/validate';
import type { ConsoleId, Frame, LayoutKind, Orientation, OrientationLayout, SkinSource } from '../src/types';

const overlaps = (a: Frame, b: Frame) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// Buttons that cover each other (or, in portrait, a game screen).
function overlapProblems(orientation: Orientation, o: OrientationLayout): string[] {
  const problems = [];
  const items = o.items.filter((i) => i.kind !== 'touch');
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i].frame, items[j].frame)) {
        problems.push(`${orientation}: ${JSON.stringify(items[i].inputs)} overlaps ${JSON.stringify(items[j].inputs)}`);
      }
    }
    if (orientation === 'portrait') {
      for (const s of o.screens) {
        if (overlaps(items[i].frame, s.outputFrame)) problems.push(`portrait: ${JSON.stringify(items[i].inputs)} overlaps screen`);
      }
    }
  }
  return problems;
}

const combinations = DEVICES.flatMap((device) =>
  (Object.keys(CONSOLES) as ConsoleId[]).flatMap((consoleId) =>
    (['standard', 'flippad'] as LayoutKind[]).map((kind) => ({ device, consoleId, kind })),
  ),
);

describe.each(combinations)('$device.id × $consoleId ($kind)', ({ device, consoleId, kind }) => {
  const state: SkinSource = {
    name: 'Smoke',
    identifier: `com.smoke.${consoleId}.${device.id}`,
    consoleId,
    device,
    debug: false,
    assetFormat: 'pdf',
    orientations: {
      portrait: Layout.buildLayoutKind(kind, device, consoleId, 'portrait'),
      landscape: Layout.buildLayoutKind(kind, device, consoleId, 'landscape'),
    },
  };
  const info = buildInfoJson(state);

  it('builds a valid info.json without overlapping controls', () => {
    const { errors, warnings } = validateInfo(info, null);
    const problems = [...errors, ...warnings];
    for (const orientation of ['portrait', 'landscape'] as const) problems.push(...overlapProblems(orientation, state.orientations[orientation]));
    expect(problems).toEqual([]);
  });

  it('imports back to the same frames on the same iPhone', () => {
    const converted = convertInfo(info, device);
    expect(converted.warnings).toEqual([]);
    for (const orientation of ['portrait', 'landscape'] as const) {
      const imported = converted.orientations[orientation]!;
      const original = state.orientations[orientation];
      expect(imported.items.map((i) => i.frame)).toEqual(original.items.map((i) => i.frame));
      expect(imported.screens.map((s) => s.outputFrame)).toEqual(original.screens.map((s) => s.outputFrame));
    }
  });
});
