#!/usr/bin/env node
// Builds the standard and FlipPad layouts for every iPhone × console and validates the resulting info.json.
// Usage: node scripts/smoke.js
import { DEVICES } from '../src/devices.js';
import { CONSOLES } from '../src/consoles.js';
import * as Layout from '../src/layout.js';
import { buildInfoJson } from '../src/skinjson.js';
import { validateInfo } from './validate.js';

const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

let failures = 0;
let checked = 0;
for (const device of DEVICES) {
  for (const consoleId of Object.keys(CONSOLES)) {
    for (const kind of ['standard', 'flippad']) {
      const state = {
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
      const problems = [];
      const { errors, warnings } = validateInfo(buildInfoJson(state), null);
      problems.push(...errors, ...warnings);

      for (const [orientation, o] of Object.entries(state.orientations)) {
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
      }
      checked++;
      if (problems.length) {
        failures++;
        console.log(`FAIL ${device.id} × ${consoleId} (${kind})`);
        for (const p of problems) console.log(`  ${p}`);
      }
    }
  }
}
console.log(`${checked - failures}/${checked} combinations OK`);
process.exit(failures ? 1 : 0);
