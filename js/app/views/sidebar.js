// Left panel: iPhone, console and layout kind, skin settings and artwork.
(function (root) {
  'use strict';

  const { DEVICES, getDevice, customDevice } = root.DeltaDevices;
  const { CONSOLES } = root.DeltaConsoles;
  const Layout = root.DeltaLayout;
  const { STYLE_COLOR_KEYS, refreshIdentifier } = root.DeltaState;
  const { readFileAsDataUrl, loadImage } = root.DeltaImages;
  const { $, el, toast, onFilePicked } = root.DeltaDom;

  const ORIENT_LABEL = { portrait: 'Portrait', landscape: 'Landscape' };

  // Safe-area inputs: [element id, orientation, edge].
  const SAFE_AREA_FIELDS = [
    ['safe-p-top', 'portrait', 'top'],
    ['safe-p-bottom', 'portrait', 'bottom'],
    ['safe-l-left', 'landscape', 'left'],
    ['safe-l-right', 'landscape', 'right'],
    ['safe-l-bottom', 'landscape', 'bottom'],
  ];

  const CUSTOM_DEFAULTS = { w: 402, h: 874, scale: 3 };

  const LAYOUT_KIND_HINTS = {
    standard: () => 'Standard layout: every button on screen.',
    flippad: () =>
      'FlipPad layout: portrait shows only the game screen and Delta’s buttons; the hatched area is covered by the controller. ' +
      'Landscape uses the standard layout. Changing iPhone or console keeps the FlipPad layout.',
    imported: (state) =>
      `Imported from "${(state.importSource && state.importSource.fileName) || 'skin'}": measurements converted to this iPhone, ` +
      'original artwork as the background. Moving elements does not move the artwork. Changing the iPhone converts it again.',
  };

  class SidebarView {
    // deps: { service, redraw(), renderStage(), save() }
    constructor(context, deps) {
      this.context = context;
      this.deps = deps;
    }

    get state() {
      return this.context.state;
    }

    init() {
      this.initDevice();
      this.initConsole();
      this.initSkin();
      this.initArt();
    }

    // Applies a state edit that only needs a canvas redraw and a save.
    edited(apply) {
      return (e) => {
        apply(e);
        this.deps.redraw();
        this.deps.save();
      };
    }

    initDevice() {
      const deviceSelect = $('device-select');
      for (const d of DEVICES) deviceSelect.append(el('option', { value: d.id }, `${d.name} — ${d.points.w}×${d.points.h}pt`));
      deviceSelect.append(el('option', { value: 'custom' }, 'Custom…'));

      deviceSelect.addEventListener('change', () => {
        const id = deviceSelect.value;
        const device = id === 'custom' ? readCustomDevice() : getDevice(id);
        if (!this.deps.service.changeDevice(id, device)) deviceSelect.value = this.state.deviceId;
      });
      for (const id of ['custom-w', 'custom-h', 'custom-scale', 'custom-family']) {
        $(id).addEventListener('change', () => this.deps.service.updateCustomDevice(readCustomDevice()));
      }
      for (const [id, orientation, edge] of SAFE_AREA_FIELDS) {
        $(id).addEventListener('input', this.edited(() => {
          this.state.device.safe[orientation][edge] = Number($(id).value) || 0;
        }));
      }
    }

    initConsole() {
      const consoleSelect = $('console-select');
      for (const c of Object.values(CONSOLES)) consoleSelect.append(el('option', { value: c.id }, c.name));
      consoleSelect.addEventListener('change', () => {
        if (!this.deps.service.changeConsole(consoleSelect.value)) consoleSelect.value = this.state.consoleId;
      });
      $('btn-relayout').addEventListener('click', () => this.deps.service.chooseLayout('standard'));
      $('btn-flippad').addEventListener('click', () => this.deps.service.chooseLayout('flippad'));
      $('btn-reset-layout').addEventListener('click', () => this.deps.service.resetLayout());
    }

    initSkin() {
      $('skin-name').addEventListener('input', this.edited((e) => {
        this.state.name = e.target.value;
        refreshIdentifier(this.state);
        $('skin-identifier').value = this.state.identifier;
      }));
      $('skin-identifier').addEventListener('input', (e) => {
        this.state.identifier = e.target.value;
        this.state.identifierAuto = e.target.value === '';
        this.deps.save();
      });
      $('skin-debug').addEventListener('change', (e) => {
        this.state.debug = e.target.checked;
        this.deps.save();
      });
      for (const orientation of Object.keys(ORIENT_LABEL)) {
        $(`orient-${orientation}`).addEventListener('change', (e) => {
          this.state.orientations[orientation].enabled = e.target.checked;
          this.deps.renderStage();
          this.deps.save();
        });
      }
      $('asset-format').addEventListener('change', (e) => {
        this.state.assetFormat = e.target.value;
        this.deps.save();
      });
    }

    initArt() {
      for (const key of STYLE_COLOR_KEYS) {
        $(`style-${key}`).addEventListener('input', this.edited((e) => {
          this.state.style[key] = e.target.value;
        }));
      }
      $('style-opacity').addEventListener('input', this.edited((e) => {
        this.state.style.landscapeOpacity = Number(e.target.value);
      }));
      $('show-title').addEventListener('change', this.edited((e) => {
        this.state.showTitle = e.target.checked;
      }));
      $('btn-reset-colors').addEventListener('click', () => this.deps.service.resetColors());

      onFilePicked($('bg-upload'), (file) => this.uploadBackground(file));
      $('btn-bg-remove').addEventListener('click', () => this.setBackground(null, null));
      $('draw-controls').addEventListener('change', this.edited((e) => {
        this.context.current().drawControls = e.target.checked;
      }));
    }

    async uploadBackground(file) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        this.setBackground(dataUrl, await loadImage(dataUrl));
      } catch (_) {
        toast('Could not read that image.');
      }
    }

    // Sets (or with nulls, removes) the background image of the current orientation.
    setBackground(dataUrl, image) {
      const orientation = this.context.ui.orientation;
      if (dataUrl) {
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

    render() {
      const state = this.state;
      this.renderDevice(state.device);
      $('console-select').value = state.consoleId;
      const kind = state.layoutKind || 'standard';
      $('btn-relayout').classList.toggle('active', kind === 'standard');
      $('btn-flippad').classList.toggle('active', kind === 'flippad');
      $('layout-kind').textContent = LAYOUT_KIND_HINTS[kind](state);
      $('skin-name').value = state.name;
      $('skin-identifier').value = state.identifier;
      $('skin-debug').checked = state.debug;
      $('orient-portrait').checked = state.orientations.portrait.enabled;
      $('orient-landscape').checked = state.orientations.landscape.enabled;
      $('asset-format').value = state.assetFormat;
      for (const key of STYLE_COLOR_KEYS) $(`style-${key}`).value = state.style[key];
      $('style-opacity').value = state.style.landscapeOpacity;
      $('show-title').checked = state.showTitle;
      this.renderArtPanel();
    }

    renderDevice(device) {
      const isCustom = this.state.deviceId === 'custom';
      $('device-select').value = this.state.deviceId;
      $('custom-device').hidden = !isCustom;
      if (isCustom) {
        $('custom-w').value = device.points.w;
        $('custom-h').value = device.points.h;
        $('custom-scale').value = device.scale;
        $('custom-family').value = device.family;
      }
      $('device-info').textContent =
        `${device.points.w}×${device.points.h} pt · @${device.scale}x · image ${device.pixels.w}×${device.pixels.h} px · "${device.family}" representation`;
      for (const [id, orientation, edge] of SAFE_AREA_FIELDS) $(id).value = device.safe[orientation][edge];
    }

    renderArtPanel() {
      const orientation = this.context.ui.orientation;
      const image = this.context.images[orientation];
      const device = this.state.device;
      const ms = Layout.mappingSizeFor(device, orientation);
      const target = `${Math.round(ms.width * device.scale)}×${Math.round(ms.height * device.scale)} px`;
      $('bg-hint').textContent = image
        ? `Image ${image.width}×${image.height} px (target ${target}); cropped to fill.`
        : `Ideal size: ${target}. Screen areas are transparent in the export.`;
      $('btn-bg-remove').disabled = !image;
      $('draw-controls').checked = this.context.current().drawControls !== false;
      for (const node of document.querySelectorAll('.orient-name')) node.textContent = ORIENT_LABEL[orientation];
    }
  }

  function readCustomDevice() {
    return customDevice(
      Number($('custom-w').value) || CUSTOM_DEFAULTS.w,
      Number($('custom-h').value) || CUSTOM_DEFAULTS.h,
      Number($('custom-scale').value) || CUSTOM_DEFAULTS.scale,
      $('custom-family').value,
    );
  }

  root.DeltaViews = { ...root.DeltaViews, SidebarView, ORIENT_LABEL };
})(window);
