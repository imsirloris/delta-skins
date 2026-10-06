#!/usr/bin/env node
// Validates a .deltaskin (zip) or an info.json against the Delta skin spec.
// Usage: npm run validate -- <file.deltaskin|info.json> [...]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { CONSOLES, allowedInputs } from '../src/consoles';

export interface Report {
  errors: string[];
  warnings: string[];
}

// Minimal zip reader (central directory + stored/deflate entries).
function readZip(buffer: Buffer): Record<string, () => Buffer> {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('not a zip file');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const files: Record<string, () => Buffer> = {};
  for (let i = 0; i < count; i++) {
    const method = buffer.readUInt16LE(offset + 10);
    const compSize = buffer.readUInt32LE(offset + 20);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buffer.subarray(start, start + compSize);
    files[name] = () => (method === 0 ? raw : zlib.inflateRawSync(raw));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// info: parsed info.json. It is untrusted, so it stays untyped and every field is checked.
function validateInfo(info: any, fileNames: Set<string> | null): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (m: string) => errors.push(m);
  const warn = (m: string) => warnings.push(m);

  for (const key of ['name', 'identifier', 'gameTypeIdentifier', 'representations']) {
    if (info[key] === undefined) err(`missing top-level key "${key}"`);
  }
  const con = Object.values(CONSOLES).find((c) => c.gameTypeIdentifier === info.gameTypeIdentifier);
  if (!con) {
    err(`unknown gameTypeIdentifier "${info.gameTypeIdentifier}"`);
    return { errors, warnings };
  }
  const allowed = new Set(allowedInputs(con.id));
  const reps = info.representations || {};

  for (const [deviceType, families] of Object.entries<any>(reps)) {
    if (!['iphone', 'ipad'].includes(deviceType)) err(`unknown device "${deviceType}"`);
    for (const [family, orients] of Object.entries<any>(families)) {
      if (!['standard', 'edgeToEdge', 'splitView'].includes(family)) err(`unknown family "${family}"`);
      for (const [orientation, rep] of Object.entries<any>(orients)) {
        const where = `${deviceType}.${family}.${orientation}`;
        if (!['portrait', 'landscape'].includes(orientation)) err(`${where}: unknown orientation`);
        const ms = rep.mappingSize;
        if (!ms || !(ms.width > 0) || !(ms.height > 0)) {
          err(`${where}: invalid mappingSize`);
          continue;
        }
        if (orientation === 'portrait' && ms.width > ms.height) warn(`${where}: portrait mappingSize is wider than tall`);
        if (orientation === 'landscape' && ms.width < ms.height) warn(`${where}: landscape mappingSize is taller than wide`);

        const assets = rep.assets || {};
        const names: (string | undefined)[] = assets.resizable ? [assets.resizable] : [assets.small, assets.medium, assets.large];
        if (!assets.resizable && names.some((n) => !n)) err(`${where}: assets needs "resizable" or small/medium/large`);
        for (const n of names.filter((name) => name !== undefined)) {
          if (fileNames && !fileNames.has(n)) err(`${where}: asset "${n}" not in archive`);
        }

        const inBounds = (f: any, label: string) => {
          if (!f || [f.x, f.y, f.width, f.height].some((v) => typeof v !== 'number')) {
            err(`${where}: ${label} frame invalid`);
            return;
          }
          if (f.x < 0 || f.y < 0 || f.x + f.width > ms.width + 0.5 || f.y + f.height > ms.height + 0.5) {
            warn(`${where}: ${label} frame outside mappingSize`);
          }
        };

        for (const [i, item] of (rep.items || []).entries() as [number, any][]) {
          const label = `item ${i} (${JSON.stringify(item.inputs)})`;
          const inputs: unknown[] = Array.isArray(item.inputs) ? item.inputs : Object.values(item.inputs || {});
          if (!inputs.length) err(`${where}: ${label} has no inputs`);
          for (const input of inputs) if (typeof input !== 'string' || !allowed.has(input)) err(`${where}: ${label} input "${input}" not valid for ${con.name}`);
          inBounds(item.frame, label);
          if (item.thumbstick) {
            if (fileNames && !fileNames.has(item.thumbstick.name)) err(`${where}: thumbstick "${item.thumbstick.name}" not in archive`);
            if (!(item.thumbstick.width > 0 && item.thumbstick.height > 0)) err(`${where}: thumbstick size invalid`);
          }
        }

        const screens: any[] = rep.screens || [];
        if (!screens.length) warn(`${where}: no screens`);
        for (const [i, s] of screens.entries()) {
          inBounds(s.outputFrame, `screen ${i} outputFrame`);
          if (con.omitInputFrame) {
            if (s.inputFrame) warn(`${where}: screen ${i} has inputFrame (unsupported for ${con.name})`);
          } else if (s.inputFrame && s.outputFrame) {
            const a = s.inputFrame.width / s.inputFrame.height;
            const b = s.outputFrame.width / s.outputFrame.height;
            if (Math.abs(a - b) / a > 0.03) warn(`${where}: screen ${i} aspect ${b.toFixed(3)} differs from inputFrame ${a.toFixed(3)}`);
          }
        }
        if (con.dualScreen) {
          const touch = (rep.items || []).find((it: any) => it.inputs && it.inputs.x === 'touchScreenX');
          if (!touch) warn(`${where}: DS skin without touch screen item`);
          else if (screens[1] && JSON.stringify(touch.frame) !== JSON.stringify(screens[1].outputFrame)) {
            warn(`${where}: touch item frame does not match bottom screen outputFrame`);
          }
        }
      }
    }
  }
  return { errors, warnings };
}

function validateFile(file: string): Report {
  const buffer = fs.readFileSync(file);
  let info;
  let fileNames: Set<string> | null = null;
  if (path.extname(file) === '.json') {
    info = JSON.parse(buffer.toString('utf8'));
  } else {
    const zip = readZip(buffer);
    fileNames = new Set(Object.keys(zip));
    if (!zip['info.json']) return { errors: ['info.json not at archive root (zip the files, not the folder)'], warnings: [] };
    info = JSON.parse(zip['info.json']().toString('utf8'));
  }
  return validateInfo(info, fileNames);
}

export { validateInfo, readZip };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: npm run validate -- <file.deltaskin|info.json> [...]');
    process.exit(2);
  }
  let failed = false;
  for (const file of files) {
    const { errors, warnings } = validateFile(file);
    console.log(`${errors.length ? 'FAIL' : 'OK  '} ${file}`);
    for (const e of errors) console.log(`  error: ${e}`);
    for (const w of warnings) console.log(`  warn:  ${w}`);
    if (errors.length) failed = true;
  }
  process.exit(failed ? 1 : 0);
}
