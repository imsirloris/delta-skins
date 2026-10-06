// Imports an existing .deltaskin: converts its info.json to the editor's state for the
// selected iPhone (points) and extracts its artwork so it can be used as the background.

import JSZip from 'jszip';
import * as Consoles from './consoles.js';
import * as Layout from './layout.js';

const ORIENTATIONS = ['portrait', 'landscape'];

// ---- info.json -> editor state (pure) ---------------------------------------

function consoleFromGameType(gameType) {
  return Object.values(Consoles.CONSOLES).find((c) => c.gameTypeIdentifier === gameType) || null;
}

// Same transform the renderer uses to cover-fit the artwork, so frames stay on the art.
function coverTransform(from, to) {
  const scale = Math.max(to.width / from.width, to.height / from.height);
  return {
    scale,
    ox: (to.width - from.width * scale) / 2,
    oy: (to.height - from.height * scale) / 2,
  };
}

function mapFrame(f, t, bounds) {
  const x = Math.round(f.x * t.scale + t.ox);
  const y = Math.round(f.y * t.scale + t.oy);
  const width = Math.round(f.width * t.scale);
  const height = Math.round(f.height * t.scale);
  // Keep the frame inside the skin if cover-fit cropped an edge.
  return {
    x: Math.max(0, Math.min(x, bounds.width - Math.min(width, bounds.width))),
    y: Math.max(0, Math.min(y, bounds.height - Math.min(height, bounds.height))),
    width: Math.min(width, bounds.width),
    height: Math.min(height, bounds.height),
  };
}

function mapEdges(edges, scale) {
  const out = {};
  for (const k of ['top', 'bottom', 'left', 'right']) {
    if (typeof edges[k] === 'number') out[k] = Math.round(edges[k] * scale);
  }
  return out;
}

// Thumbstick image size Delta assumes when a skin doesn't declare one.
const DEFAULT_THUMBSTICK = { width: 85, height: 87 };

// Editor kind and shape of a directional (object-mapped) item.
function directionalKind(inputs) {
  const values = Object.values(inputs || {});
  if (values.includes('touchScreenX')) return { kind: 'touch', shape: 'none' };
  if (values.some((v) => String(v).startsWith('analogStick'))) return { kind: 'thumbstick', shape: 'stick' };
  return { kind: 'dpad', shape: 'dpad' };
}

function convertItem(item, t, bounds, orientation) {
  const out = {
    id: Layout.newId(),
    frame: mapFrame(item.frame, t, bounds),
    label: '',
    shape: 'rect',
  };
  if (item.extendedEdges) out.extendedEdges = mapEdges(item.extendedEdges, t.scale);
  if (Array.isArray(item.inputs)) return { ...out, kind: 'button', inputs: [...item.inputs] };

  Object.assign(out, directionalKind(item.inputs), { inputs: { ...item.inputs } });
  if (out.kind !== 'thumbstick') return out;
  const size = item.thumbstick || DEFAULT_THUMBSTICK;
  out.thumbstick = {
    name: `${orientation}_thumbstick_${out.id}`,
    width: Math.round(size.width * t.scale),
    height: Math.round(size.height * t.scale),
  };
  return out;
}

function convertScreen(screen, index, con, t, bounds) {
  const { width, height } = con.inputFrame;
  const half = con.dualScreen ? height / 2 : height;
  const defaultInput = { x: 0, y: con.dualScreen ? index * half : 0, width, height: half };
  return {
    inputFrame: screen.inputFrame ? { ...screen.inputFrame } : defaultInput,
    outputFrame: mapFrame(screen.outputFrame, t, bounds),
    filters: Array.isArray(screen.filters) ? JSON.parse(JSON.stringify(screen.filters)) : [],
  };
}

function convertRepresentation(rep, con, device, orientation) {
  const mappingSize = Layout.mappingSizeFor(device, orientation);
  const t = coverTransform(rep.mappingSize, mappingSize);
  const items = (rep.items || []).map((item) => convertItem(item, t, mappingSize, orientation));
  const screens = (rep.screens || []).map((s, i) => convertScreen(s, i, con, t, mappingSize));
  return {
    enabled: true,
    mappingSize,
    items,
    screens,
    extendedEdges: { top: 0, bottom: 0, left: 0, right: 0, ...mapEdges(rep.extendedEdges || {}, t.scale) },
    translucent: !!rep.translucent,
    // The artwork already has the buttons drawn on it.
    drawControls: false,
  };
}

function assetFile(rep) {
  const a = rep.assets || {};
  return a.resizable || a.large || a.medium || a.small || null;
}

// Returns { consoleId, name, family, orientations: {portrait?, landscape?}, assets: {o: file}, warnings }.
function convertInfo(info, device) {
  const con = consoleFromGameType(info.gameTypeIdentifier);
  if (!con) throw new Error(`unknown console: ${info.gameTypeIdentifier}`);
  const iphone = (info.representations && info.representations.iphone) || {};
  const warnings = [];
  let family = device.family;
  if (!iphone[family]) {
    family = Object.keys(iphone).find((k) => iphone[k] && Object.keys(iphone[k]).length);
    if (!family) throw new Error('the skin has no iPhone representation');
    warnings.push(`The skin is "${family}" and the selected iPhone is "${device.family}"; measurements were converted anyway.`);
  }
  const orientations = {};
  const assets = {};
  for (const o of ORIENTATIONS) {
    const rep = iphone[family][o];
    if (!rep || !rep.mappingSize) continue;
    orientations[o] = convertRepresentation(rep, con, device, o);
    assets[o] = assetFile(rep);
    const target = Layout.mappingSizeFor(device, o);
    const ratioFrom = rep.mappingSize.width / rep.mappingSize.height;
    const ratioTo = target.width / target.height;
    if (Math.abs(ratioFrom - ratioTo) / ratioTo > 0.02) {
      warnings.push(`${o}: the skin's aspect ratio differs from the selected iPhone; the artwork was cropped to fill.`);
    }
  }
  if (!Object.keys(orientations).length) throw new Error('no iPhone orientation found');
  return { consoleId: con.id, name: info.name || 'Imported skin', family, orientations, assets, warnings };
}

// ---- artwork extraction (browser) ----------------------------------------------

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Undo PNG row predictors (/Predictor >= 10).
function unpredict(data, columns, colors) {
  const rowLen = columns * colors;
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  for (let y = 0; y < rows; y++) {
    const type = data[y * (rowLen + 1)];
    const src = y * (rowLen + 1) + 1;
    const dst = y * rowLen;
    for (let i = 0; i < rowLen; i++) {
      const raw = data[src + i];
      const left = i >= colors ? out[dst + i - colors] : 0;
      const up = y > 0 ? out[dst - rowLen + i] : 0;
      const upLeft = y > 0 && i >= colors ? out[dst - rowLen + i - colors] : 0;
      let v;
      if (type === 0) v = raw;
      else if (type === 1) v = raw + left;
      else if (type === 2) v = raw + up;
      else if (type === 3) v = raw + ((left + up) >> 1);
      else {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        v = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
      }
      out[dst + i] = v & 0xff;
    }
  }
  return out;
}

// Minimal PDF reader: finds image XObjects (Flate or DCT), enough for skin artwork.
class PdfImages {
  constructor(bytes) {
    this.bytes = bytes;
    // windows-1252 is single-byte, so string indexes match byte offsets.
    this.text = new TextDecoder('windows-1252').decode(bytes);
  }

  // Dictionary text that ends right before `end` (handles nested << >>).
  dictBefore(end) {
    let depth = 0;
    for (let i = end; i > 0; i--) {
      if (this.text.startsWith('>>', i - 1)) {
        depth++;
        i--;
      } else if (this.text.startsWith('<<', i - 1)) {
        depth--;
        i--;
        if (depth === 0) return this.text.slice(i + 2, end - 1);
      }
    }
    return '';
  }

  resolveNumber(dict, key) {
    const ref = new RegExp(`/${key}\\s+(\\d+)\\s+(\\d+)\\s+R`).exec(dict);
    if (ref) {
      const obj = new RegExp(`(?:^|\\s)${ref[1]}\\s+${ref[2]}\\s+obj\\s+(\\d+)`).exec(this.text);
      return obj ? Number(obj[1]) : null;
    }
    const num = new RegExp(`/${key}\\s+(\\d+)`).exec(dict);
    return num ? Number(num[1]) : null;
  }

  streams() {
    const out = [];
    const re = />>\s*stream\r?\n/g;
    let m;
    while ((m = re.exec(this.text))) {
      const dict = this.dictBefore(m.index + 2);
      const length = this.resolveNumber(dict, 'Length');
      const start = m.index + m[0].length;
      out.push({ dict, start, data: this.bytes.subarray(start, start + (length || 0)) });
    }
    return out;
  }

  async decode(stream) {
    const d = stream.dict;
    const width = Number(/\/Width\s+(\d+)/.exec(d)[1]);
    const height = Number(/\/Height\s+(\d+)/.exec(d)[1]);
    if (/\/DCTDecode/.test(d)) return { width, height, jpeg: stream.data };
    if (!/\/FlateDecode/.test(d)) throw new Error('unsupported PDF image format');
    if (Number((/\/BitsPerComponent\s+(\d+)/.exec(d) || [0, 8])[1]) !== 8) throw new Error('PDF image is not 8-bit');
    let data = await inflate(stream.data);
    let components = Math.round(data.length / (width * height));
    const predictor = /\/Predictor\s+(\d+)/.exec(d);
    if (predictor && Number(predictor[1]) >= 10) {
      const declared = /\/Colors\s+(\d+)/.exec(d);
      // Each predicted row has one filter-type byte in front.
      const colors = declared ? Number(declared[1]) : Math.round((data.length / height - 1) / width);
      data = unpredict(data, width, colors);
      components = colors;
    }
    return { width, height, components, data };
  }

  // Object number of the "N 0 obj" that contains offset `pos`.
  objectNumberAt(pos) {
    const head = this.text.slice(Math.max(0, pos - 4096), pos);
    const all = [...head.matchAll(/(\d+)\s+\d+\s+obj\b/g)];
    return all.length ? all[all.length - 1][1] : null;
  }

  async largestImage() {
    const images = this.streams().filter((s) => /\/Subtype\s*\/Image/.test(s.dict));
    // Soft masks are images too; skip them when picking the artwork.
    const maskIds = new Set(images.map((s) => (/\/SMask\s+(\d+)\s+\d+\s+R/.exec(s.dict) || [])[1]).filter(Boolean));
    const size = (s) => Number((/\/Width\s+(\d+)/.exec(s.dict) || [0, 0])[1]) * Number((/\/Height\s+(\d+)/.exec(s.dict) || [0, 0])[1]);
    const candidates = images.filter((s) => !maskIds.has(this.objectNumberAt(s.start))).sort((a, b) => size(b) - size(a));
    if (!candidates.length) throw new Error('PDF has no image (vector artwork is not supported; export the skin as PNG)');
    const main = candidates[0];
    const image = await this.decode(main);
    const smaskRef = /\/SMask\s+(\d+)\s+\d+\s+R/.exec(main.dict);
    if (smaskRef) {
      const maskStream = images.find((s) => this.objectNumberAt(s.start) === smaskRef[1]);
      if (maskStream) image.mask = await this.decode(maskStream);
    }
    return image;
  }
}

async function blobToImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('invalid image'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pdfImageToDataUrl(bytes) {
  const image = await new PdfImages(bytes).largestImage();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (image.jpeg) {
    ctx.drawImage(await blobToImage(new Blob([image.jpeg], { type: 'image/jpeg' })), 0, 0);
  } else {
    const rgba = ctx.createImageData(image.width, image.height);
    const n = image.components;
    for (let i = 0, p = 0; i < image.width * image.height; i++, p += n) {
      const o = i * 4;
      rgba.data[o] = image.data[p];
      rgba.data[o + 1] = n >= 3 ? image.data[p + 1] : image.data[p];
      rgba.data[o + 2] = n >= 3 ? image.data[p + 2] : image.data[p];
      rgba.data[o + 3] = 255;
    }
    ctx.putImageData(rgba, 0, 0);
  }
  if (image.mask && image.mask.data && image.mask.width === image.width && image.mask.height === image.height) {
    const px = ctx.getImageData(0, 0, image.width, image.height);
    for (let i = 0; i < image.width * image.height; i++) px.data[i * 4 + 3] = image.mask.data[i];
    ctx.putImageData(px, 0, 0);
  }
  return canvas.toDataURL('image/png');
}

async function assetToDataUrl(zip, file) {
  const entry = zip.file(file);
  if (!entry) throw new Error(`file "${file}" is not in the .deltaskin`);
  const bytes = await entry.async('uint8array');
  if (/\.pdf$/i.test(file)) return pdfImageToDataUrl(bytes);
  const type = /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png';
  const blob = new Blob([bytes], { type });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// file: File/Blob of a .deltaskin. Returns convertInfo() plus { info, images: {o: dataURL} }.
async function importDeltaSkin(file, device) {
  const zip = await JSZip.loadAsync(file);
  const infoEntry = zip.file('info.json');
  if (!infoEntry) throw new Error('info.json not found at the root of the .deltaskin');
  const info = JSON.parse(await infoEntry.async('string'));
  const result = convertInfo(info, device);
  result.info = info;
  result.images = {};
  for (const [o, name] of Object.entries(result.assets)) {
    if (!name) continue;
    try {
      result.images[o] = await assetToDataUrl(zip, name);
    } catch (err) {
      result.warnings.push(`${o}: could not read the artwork (${err.message}); the app will draw the buttons.`);
      result.orientations[o].drawControls = true;
    }
  }
  return result;
}

export { convertInfo, coverTransform, importDeltaSkin, unpredict };
