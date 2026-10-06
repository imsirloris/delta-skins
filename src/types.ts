// Shared data model: the editor's project state, the iPhone and console presets, and the shape
// of Delta's info.json. Everything is in points (logical resolution) unless noted.

export type Orientation = 'portrait' | 'landscape';

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Frame extends Point, Size {}

export type EdgeKey = 'top' | 'bottom' | 'left' | 'right';

export type FullEdges = Record<EdgeKey, number>;

// Item-level extendedEdges: a missing edge inherits the orientation default.
export type Edges = Partial<FullEdges>;

// ---- presets ----------------------------------------------------------------------

export type DeviceFamily = 'edgeToEdge' | 'standard';

export interface PortraitSafeArea {
  top: number;
  bottom: number;
}

export interface LandscapeSafeArea {
  left: number;
  right: number;
  bottom: number;
}

export interface Device {
  id: string;
  name: string;
  points: { w: number; h: number };
  scale: number;
  pixels: { w: number; h: number };
  family: DeviceFamily;
  safe: { portrait: PortraitSafeArea; landscape: LandscapeSafeArea };
}

export type ConsoleId = 'gbc' | 'gba' | 'nes' | 'snes' | 'n64' | 'ds' | 'genesis';

export interface ConsoleDef {
  id: ConsoleId;
  name: string;
  gameTypeIdentifier: string;
  inputFrame: Size;
  buttons: string[];
  dualScreen?: boolean;
  omitInputFrame?: boolean;
}

// A CoreImage filter (CIFilter) applied to a game screen.
export interface ScreenFilter {
  name: string;
  parameters?: Record<string, unknown>;
}

// ---- editor layout ----------------------------------------------------------------

export type Shape = 'circle' | 'pill' | 'rect' | 'text' | 'dpad' | 'stick' | 'none';

export interface Thumbstick {
  name: string;
  width: number;
  height: number;
}

interface ItemBase {
  id: string;
  label: string;
  shape: Shape;
  frame: Frame;
  extendedEdges?: Edges;
}

// Buttons map to a list of inputs pressed together.
export interface ButtonItem extends ItemBase {
  kind: 'button';
  inputs: string[];
}

// D-Pad, thumbstick and DS touch screen map directions (or axes) to inputs.
export interface DirectionalItem extends ItemBase {
  kind: 'dpad' | 'thumbstick' | 'touch';
  inputs: Record<string, string>;
  thumbstick?: Thumbstick;
}

export type Item = ButtonItem | DirectionalItem;

export type ItemKind = Item['kind'];

export interface Screen {
  inputFrame: Frame;
  outputFrame: Frame;
  // Saves from older versions may lack it.
  filters?: ScreenFilter[];
}

export interface OrientationLayout {
  enabled: boolean;
  mappingSize: Size;
  items: Item[];
  screens: Screen[];
  extendedEdges: FullEdges;
  translucent?: boolean;
  // false hides the drawn controls (the background art already has them).
  drawControls?: boolean;
}

export type Orientations = Record<Orientation, OrientationLayout>;

// ---- project ----------------------------------------------------------------------

export interface Style {
  bg: string;
  bg2: string;
  bezel: string;
  button: string;
  accent: string;
  text: string;
  landscapeOpacity: number;
}

export type StyleColorKey = Exclude<keyof Style, 'landscapeOpacity'>;

export type LayoutKind = 'standard' | 'flippad' | 'imported';

export type AssetFormat = 'pdf' | 'png';

export interface ImportSource {
  fileName: string;
  info: SkinInfo;
  artOrientations: Orientation[];
}

export type OrientationMap<T> = Partial<Record<Orientation, T>>;

export interface ProjectState {
  version: number;
  name: string;
  identifier: string;
  identifierAuto: boolean;
  deviceId: string;
  device: Device;
  consoleId: ConsoleId;
  debug: boolean;
  assetFormat: AssetFormat;
  showTitle: boolean;
  style: Style;
  orientations: Orientations;
  layoutKind: LayoutKind;
  // Background images as data URLs.
  bgImages: OrientationMap<string>;
  layoutEdited: boolean;
  importSource?: ImportSource | null;
}

// What info.json and the exported assets are built from.
export type SkinSource = Pick<ProjectState, 'name' | 'identifier' | 'consoleId' | 'device' | 'debug' | 'assetFormat' | 'orientations'>;

// ---- editor UI --------------------------------------------------------------------

export interface GridPrefs {
  show: boolean;
  snap: boolean;
  size: number;
}

// Editor view preferences (not part of the project file).
export interface ViewPrefs {
  guides: boolean;
  grid: GridPrefs;
  showSafe: boolean;
  showDebug: boolean;
}

// Selection reference: a button by id or a game screen by index.
export type Ref = { type: 'item'; id: string } | { type: 'screen'; index: number };

export interface UiState extends ViewPrefs {
  orientation: Orientation;
  selection: Ref[];
  // Selection box from before the first align click (see InspectorView.multiPanel).
  alignRef: Frame | null;
}

export interface ChangeOptions {
  // While dragging: only the frame inputs need refreshing.
  geometryOnly?: boolean;
  // Edits made in the inspector, which already shows the new values.
  fromPanel?: boolean;
  // Align clicks keep the align reference.
  fromAlign?: boolean;
}

// Everything the editor and the views share (built in main.ts).
export interface AppContext {
  state: ProjectState;
  ui: UiState;
  images: OrientationMap<HTMLImageElement>;
  current(): OrientationLayout;
  select(refs: Ref[]): void;
  changed(opts?: ChangeOptions): void;
  removeSelected(): void;
}

// ---- Delta info.json (https://noah978.gitbook.io/delta-docs/skins) ----------------

export interface InfoAssets {
  resizable?: string;
  small?: string;
  medium?: string;
  large?: string;
}

export interface InfoItem {
  inputs: string[] | Record<string, string>;
  frame: Frame;
  extendedEdges?: Edges;
  thumbstick?: Thumbstick;
}

export interface InfoScreen {
  inputFrame?: Frame;
  outputFrame: Frame;
  filters?: ScreenFilter[];
}

export interface InfoRepresentation {
  assets: InfoAssets;
  items: InfoItem[];
  screens: InfoScreen[];
  mappingSize: Size;
  extendedEdges: Edges;
  translucent?: boolean;
}

export type InfoFamily = OrientationMap<InfoRepresentation>;

export interface SkinInfo {
  name: string;
  identifier: string;
  gameTypeIdentifier: string;
  debug?: boolean;
  representations: { iphone?: Partial<Record<DeviceFamily, InfoFamily>> };
}
