// Project use cases: switching iPhone/console/layout, importing skins, opening projects and
// resetting to defaults. Mutates the shared context and reports back through injected hooks,
// so it never touches the DOM itself.

import * as State from './state';
import { CONSOLES } from '../consoles';
import * as DeltaImporter from '../importer';
import { loadImages } from './images';
import { ORIENTATIONS } from '../skinjson';
import type { ConvertedSkin } from '../importer';
import type { AppContext, ConsoleId, Device, LayoutKind, Orientation, Orientations } from '../types';

// The parts of the shared context the service uses.
type ProjectContext = Pick<AppContext, 'state' | 'ui' | 'images'>;

export interface ProjectHooks {
  render(): void;
  save(): void;
  // Records pending edits right away, so a reset is always its own undo step.
  checkpoint(): void;
  persist(): void;
  resetHistory(): void;
  saveView(): void;
  notify(message: string): void;
  ask(message: string): boolean;
}

const MESSAGES = {
  discardLayout: 'This rebuilds the layout and discards your position edits. Continue?',
  resetColors: 'Reset the art colors and landscape opacity to the defaults?',
  resetLayout: 'Reset every element to its default position and restore the iPhone safe areas? Colors and images are kept.',
  resetAll:
    'Reset everything (iPhone, console, layout, colors, skin settings and view options) to the defaults? ' +
    'Uploaded and imported images are removed and cannot be brought back with Undo.',
};

class ProjectService {
  context: ProjectContext;
  hooks: ProjectHooks;

  constructor(context: ProjectContext, hooks: ProjectHooks) {
    this.context = context;
    this.hooks = hooks;
  }

  get state() {
    return this.context.state;
  }

  confirmLayoutReplace(): boolean {
    return !this.state.layoutEdited || this.hooks.ask(MESSAGES.discardLayout);
  }

  // ---- layout ----------------------------------------------------------------

  // kind: 'standard' | 'flippad'; omitted keeps the current one (device/console changes).
  relayout(kind?: LayoutKind): void {
    const state = this.state;
    if (kind) state.layoutKind = kind;
    if (state.layoutKind === 'imported' && !state.importSource) state.layoutKind = 'standard';
    if (state.layoutKind === 'imported') {
      state.orientations = this.importedOrientations();
    } else {
      this.leaveImport();
      state.orientations = this.freshLayout(state.layoutKind || 'standard', state.consoleId);
    }
    this.layoutReplaced();
  }

  // Returns false when the user keeps the current layout.
  chooseLayout(kind: LayoutKind): boolean {
    if (!this.confirmLayoutReplace()) return false;
    this.relayout(kind);
    return true;
  }

  changeDevice(deviceId: string, device: Device): boolean {
    if (!this.confirmLayoutReplace()) return false;
    this.state.deviceId = deviceId;
    this.state.device = device;
    State.refreshIdentifier(this.state);
    this.relayout();
    return true;
  }

  updateCustomDevice(device: Device): void {
    this.state.device = device;
    this.relayout();
  }

  changeConsole(consoleId: ConsoleId): boolean {
    if (!this.confirmLayoutReplace()) return false;
    const state = this.state;
    const previous = state.consoleId;
    state.consoleId = consoleId;
    // An imported skin belongs to its console; switching console starts from the standard layout.
    if (state.layoutKind === 'imported') state.layoutKind = 'standard';
    if (State.isDefaultSkinName(state.name, previous)) state.name = State.defaultSkinName(consoleId);
    State.refreshIdentifier(state);
    this.relayout();
    return true;
  }

  freshLayout(kind: LayoutKind, consoleId: ConsoleId): Orientations {
    return State.freshOrientations(this.state.device, consoleId, kind, this.state.orientations, (o) => this.keepsHiddenControls(o));
  }

  // Hidden controls only make sense over the user's own art, which survives a fresh layout.
  keepsHiddenControls(orientation: Orientation): boolean {
    const importedArt = (this.state.importSource && this.state.importSource.artOrientations) || [];
    return Boolean(this.context.images[orientation]) && !importedArt.includes(orientation);
  }

  // Standard layout for the orientations the converted skin lacks.
  withConverted(result: ConvertedSkin): Orientations {
    return Object.assign(this.freshLayout('standard', result.consoleId), result.orientations);
  }

  // Imported skin re-converted to the current iPhone.
  importedOrientations(): Orientations {
    const result = DeltaImporter.convertInfo(this.state.importSource!.info, this.state.device);
    if (result.warnings.length) this.hooks.notify(result.warnings.join(' '));
    return this.withConverted(result);
  }

  // Leaving an imported layout drops its artwork too: it no longer matches the frames.
  leaveImport(): void {
    const source = this.state.importSource;
    if (!source) return;
    for (const orientation of source.artOrientations || []) {
      delete this.state.bgImages[orientation];
      delete this.context.images[orientation];
    }
    this.state.importSource = null;
  }

  layoutReplaced(): void {
    this.state.layoutEdited = false;
    this.context.ui.selection = [];
    this.hooks.render();
    this.hooks.save();
  }

  // ---- files -----------------------------------------------------------------

  async reloadImages(): Promise<void> {
    this.context.images = await loadImages(this.state.bgImages);
  }

  // Returns false when the user keeps the current layout; throws on unreadable skins.
  async importSkin(file: File): Promise<boolean> {
    if (!this.confirmLayoutReplace()) return false;
    const state = this.state;
    const result = await DeltaImporter.importDeltaSkin(file, state.device);
    this.leaveImport();
    state.consoleId = result.consoleId;
    state.name = result.name;
    State.refreshIdentifier(state);
    state.layoutKind = 'imported';
    state.importSource = { fileName: file.name, info: result.info, artOrientations: ORIENTATIONS.filter((o) => result.images[o]) };
    state.orientations = this.withConverted(result);
    Object.assign(state.bgImages, result.images);
    this.context.ui.orientation = result.orientations.portrait ? 'portrait' : 'landscape';
    await this.reloadImages();
    this.layoutReplaced();
    this.hooks.notify(importSummary(result));
    return true;
  }

  async openProject(data: unknown): Promise<void> {
    if (!State.isProjectData(data)) throw new Error('this file is not a project');
    this.context.state = State.restoreState(data);
    this.context.ui.selection = [];
    await this.reloadImages();
    this.hooks.render();
    this.hooks.persist();
    this.hooks.resetHistory();
  }

  // ---- resets ----------------------------------------------------------------
  // Each asks first and goes through the autosave, so Undo brings the state back.

  confirmReset(message: string): boolean {
    if (!this.hooks.ask(message)) return false;
    this.hooks.checkpoint();
    return true;
  }

  resetColors(): boolean {
    if (!this.confirmReset(MESSAGES.resetColors)) return false;
    this.state.style = State.defaultStyle();
    this.hooks.render();
    this.hooks.save();
    return true;
  }

  resetLayout(): boolean {
    if (!this.confirmReset(MESSAGES.resetLayout)) return false;
    this.state.device = State.presetDevice(this.state);
    this.relayout();
    return true;
  }

  resetAll(): boolean {
    if (!this.confirmReset(MESSAGES.resetAll)) return false;
    const ui = this.context.ui;
    this.context.state = State.defaultState();
    this.context.images = {};
    Object.assign(ui, State.defaultView(), { orientation: 'portrait', selection: [], alignRef: null });
    this.hooks.saveView();
    this.hooks.render();
    this.hooks.save();
    return true;
  }
}

function importSummary(result: ConvertedSkin): string {
  const notes = [...result.warnings];
  const missing = ORIENTATIONS.filter((o) => !result.orientations[o]);
  if (missing.length) notes.push(`The skin has no ${missing.join(' or ')} layout, so the standard one is used.`);
  return `Skin imported (${CONSOLES[result.consoleId].name}). ${notes.join(' ')}`.trim();
}

export { ProjectService, MESSAGES };
