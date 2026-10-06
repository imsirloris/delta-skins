// Left panel: iPhone, console and layout kind, skin settings and artwork.

import { DEVICES, getDevice, customDevice } from '../../devices';
import { CONSOLES } from '../../consoles';
import * as Layout from '../../layout';
import { STYLE_COLOR_KEYS, refreshIdentifier } from '../state';
import { readFileAsDataUrl, loadImage } from '../images';
import { $, el, toast, onFilePicked } from '../dom';
import type { ProjectService } from '../project';
import type { AppContext, AssetFormat, ConsoleId, Device, DeviceFamily, LayoutKind, Orientation, ProjectState } from '../../types';

interface SidebarDeps {
  service: ProjectService;
  redraw(): void;
  renderStage(): void;
  save(): void;
}

const ORIENT_LABEL: Record<Orientation, string> = { portrait: 'Portrait', landscape: 'Landscape' };

// Safe-area inputs: [element id, orientation, edge].
type SafeAreaField = [string, 'portrait', 'top' | 'bottom'] | [string, 'landscape', 'left' | 'right' | 'bottom'];

const SAFE_AREA_FIELDS: SafeAreaField[] = [
  ['safe-p-top', 'portrait', 'top'],
  ['safe-p-bottom', 'portrait', 'bottom'],
  ['safe-l-left', 'landscape', 'left'],
  ['safe-l-right', 'landscape', 'right'],
  ['safe-l-bottom', 'landscape', 'bottom'],
];

const CUSTOM_DEFAULTS = { w: 402, h: 874, scale: 3 };

const LAYOUT_KIND_HINTS: Record<LayoutKind, (state: ProjectState) => string> = {
  standard: () => 'Standard layout: every button on screen.',
  flippad: () =>
    'FlipPad layout: portrait shows only the game screen and Delta’s buttons; the hatched area is covered by the controller. ' +
    'Landscape uses the standard layout. Changing iPhone or console keeps the FlipPad layout.',
  imported: (state) =>
    `Imported from "${(state.importSource && state.importSource.fileName) || 'skin'}": measurements converted to this iPhone, ` +
    'original artwork as the background. Moving elements does not move the artwork. Changing the iPhone converts it again.',
};

const input = (id: string) => $<HTMLInputElement>(id);
const select = (id: string) => $<HTMLSelectElement>(id);

function setSafeArea(device: Device, [, orientation, edge]: SafeAreaField, value: number): void {
  if (orientation === 'portrait') device.safe.portrait[edge] = value;
  else device.safe.landscape[edge] = value;
}

function safeArea(device: Device, [, orientation, edge]: SafeAreaField): number {
  return orientation === 'portrait' ? device.safe.portrait[edge] : device.safe.landscape[edge];
}

class SidebarView {
  context: AppContext;
  deps: SidebarDeps;

  constructor(context: AppContext, deps: SidebarDeps) {
    this.context = context;
    this.deps = deps;
  }

  get state(): ProjectState {
    return this.context.state;
  }

  init(): void {
    this.initDevice();
    this.initConsole();
    this.initSkin();
    this.initArt();
  }

  // Applies a state edit that only needs a canvas redraw and a save.
  edited(apply: () => void): () => void {
    return () => {
      apply();
      this.deps.redraw();
      this.deps.save();
    };
  }

  initDevice(): void {
    const deviceSelect = select('device-select');
    for (const d of DEVICES) deviceSelect.append(el('option', { value: d.id }, `${d.name} — ${d.points.w}×${d.points.h}pt`));
    deviceSelect.append(el('option', { value: 'custom' }, 'Custom…'));

    deviceSelect.addEventListener('change', () => {
      const id = deviceSelect.value;
      const device = (id !== 'custom' && getDevice(id)) || readCustomDevice();
      if (!this.deps.service.changeDevice(id, device)) deviceSelect.value = this.state.deviceId;
    });
    for (const id of ['custom-w', 'custom-h', 'custom-scale', 'custom-family']) {
      $(id).addEventListener('change', () => this.deps.service.updateCustomDevice(readCustomDevice()));
    }
    for (const field of SAFE_AREA_FIELDS) {
      const node = input(field[0]);
      node.addEventListener('input', this.edited(() => setSafeArea(this.state.device, field, Number(node.value) || 0)));
    }
  }

  initConsole(): void {
    const consoleSelect = select('console-select');
    for (const c of Object.values(CONSOLES)) consoleSelect.append(el('option', { value: c.id }, c.name));
    consoleSelect.addEventListener('change', () => {
      if (!this.deps.service.changeConsole(consoleSelect.value as ConsoleId)) consoleSelect.value = this.state.consoleId;
    });
    $('btn-relayout').addEventListener('click', () => this.deps.service.chooseLayout('standard'));
    $('btn-flippad').addEventListener('click', () => this.deps.service.chooseLayout('flippad'));
    $('btn-reset-layout').addEventListener('click', () => this.deps.service.resetLayout());
  }

  initSkin(): void {
    const name = input('skin-name');
    const identifier = input('skin-identifier');
    name.addEventListener('input', this.edited(() => {
      this.state.name = name.value;
      refreshIdentifier(this.state);
      identifier.value = this.state.identifier;
    }));
    identifier.addEventListener('input', () => {
      this.state.identifier = identifier.value;
      this.state.identifierAuto = identifier.value === '';
      this.deps.save();
    });
    const debug = input('skin-debug');
    debug.addEventListener('change', () => {
      this.state.debug = debug.checked;
      this.deps.save();
    });
    for (const orientation of Object.keys(ORIENT_LABEL) as Orientation[]) {
      const toggle = input(`orient-${orientation}`);
      toggle.addEventListener('change', () => {
        this.state.orientations[orientation].enabled = toggle.checked;
        this.deps.renderStage();
        this.deps.save();
      });
    }
    const format = select('asset-format');
    format.addEventListener('change', () => {
      this.state.assetFormat = format.value as AssetFormat;
      this.deps.save();
    });
  }

  initArt(): void {
    for (const key of STYLE_COLOR_KEYS) {
      const color = input(`style-${key}`);
      color.addEventListener('input', this.edited(() => {
        this.state.style[key] = color.value;
      }));
    }
    const opacity = input('style-opacity');
    opacity.addEventListener('input', this.edited(() => {
      this.state.style.landscapeOpacity = Number(opacity.value);
    }));
    const showTitle = input('show-title');
    showTitle.addEventListener('change', this.edited(() => {
      this.state.showTitle = showTitle.checked;
    }));
    $('btn-reset-colors').addEventListener('click', () => this.deps.service.resetColors());

    onFilePicked(input('bg-upload'), (file) => this.uploadBackground(file));
    $('btn-bg-remove').addEventListener('click', () => this.setBackground(null, null));
    const drawControls = input('draw-controls');
    drawControls.addEventListener('change', this.edited(() => {
      this.context.current().drawControls = drawControls.checked;
    }));
  }

  async uploadBackground(file: File): Promise<void> {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      this.setBackground(dataUrl, await loadImage(dataUrl));
    } catch (_) {
      toast('Could not read that image.');
    }
  }

  // Sets (or with nulls, removes) the background image of the current orientation.
  setBackground(dataUrl: string | null, image: HTMLImageElement | null): void {
    const orientation = this.context.ui.orientation;
    if (dataUrl && image) {
      this.state.bgImages[orientation] = dataUrl;
      this.context.images[orientation] = image;
    } else {
      delete this.state.bgImages[orientation];
      delete this.context.images[orientation];
    }
    this.renderArtPanel();
    this.deps.redraw();
    this.deps.save();
  }

  render(): void {
    const state = this.state;
    this.renderDevice(state.device);
    select('console-select').value = state.consoleId;
    const kind = state.layoutKind || 'standard';
    $('btn-relayout').classList.toggle('active', kind === 'standard');
    $('btn-flippad').classList.toggle('active', kind === 'flippad');
    $('layout-kind').textContent = LAYOUT_KIND_HINTS[kind](state);
    input('skin-name').value = state.name;
    input('skin-identifier').value = state.identifier;
    input('skin-debug').checked = state.debug;
    input('orient-portrait').checked = state.orientations.portrait.enabled;
    input('orient-landscape').checked = state.orientations.landscape.enabled;
    select('asset-format').value = state.assetFormat;
    for (const key of STYLE_COLOR_KEYS) input(`style-${key}`).value = state.style[key];
    input('style-opacity').value = String(state.style.landscapeOpacity);
    input('show-title').checked = state.showTitle;
    this.renderArtPanel();
  }

  renderDevice(device: Device): void {
    const isCustom = this.state.deviceId === 'custom';
    select('device-select').value = this.state.deviceId;
    $('custom-device').hidden = !isCustom;
    if (isCustom) {
      input('custom-w').value = String(device.points.w);
      input('custom-h').value = String(device.points.h);
      input('custom-scale').value = String(device.scale);
      select('custom-family').value = device.family;
    }
    $('device-info').textContent =
      `${device.points.w}×${device.points.h} pt · @${device.scale}x · image ${device.pixels.w}×${device.pixels.h} px · "${device.family}" representation`;
    for (const field of SAFE_AREA_FIELDS) input(field[0]).value = String(safeArea(device, field));
  }

  renderArtPanel(): void {
    const orientation = this.context.ui.orientation;
    const image = this.context.images[orientation];
    const device = this.state.device;
    const ms = Layout.mappingSizeFor(device, orientation);
    const target = `${Math.round(ms.width * device.scale)}×${Math.round(ms.height * device.scale)} px`;
    $('bg-hint').textContent = image
      ? `Image ${image.width}×${image.height} px (target ${target}); cropped to fill.`
      : `Ideal size: ${target}. Screen areas are transparent in the export.`;
    $<HTMLButtonElement>('btn-bg-remove').disabled = !image;
    input('draw-controls').checked = this.context.current().drawControls !== false;
    for (const node of document.querySelectorAll('.orient-name')) node.textContent = ORIENT_LABEL[orientation];
  }
}

function readCustomDevice(): Device {
  return customDevice(
    Number(input('custom-w').value) || CUSTOM_DEFAULTS.w,
    Number(input('custom-h').value) || CUSTOM_DEFAULTS.h,
    Number(input('custom-scale').value) || CUSTOM_DEFAULTS.scale,
    select('custom-family').value as DeviceFamily,
  );
}

export { SidebarView, ORIENT_LABEL };
