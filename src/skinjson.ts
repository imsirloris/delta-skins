// Builds Delta's info.json from the editor state. Pure (no DOM) so Node scripts can reuse it.

import * as Consoles from './consoles';
import type {
  AssetFormat,
  ConsoleDef,
  DirectionalItem,
  Edges,
  InfoAssets,
  InfoFamily,
  InfoItem,
  InfoRepresentation,
  InfoScreen,
  Item,
  Thumbstick,
  Orientation,
  Screen,
  SkinInfo,
  SkinSource,
} from './types';

const ORIENTATIONS: Orientation[] = ['portrait', 'landscape'];

type ThumbstickItem = DirectionalItem & { thumbstick: Thumbstick };

export type AssetPlanEntry =
  | { file: string; type: 'skin'; orientation: Orientation }
  | { file: string; type: 'thumbstick'; orientation: Orientation; item: ThumbstickItem };

function hasThumbstick(item: Item): item is ThumbstickItem {
  return item.kind === 'thumbstick' && Boolean(item.thumbstick);
}

function slug(text: string): string {
  return (
    String(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skin'
  );
}

function assetNames(orientation: Orientation, format: AssetFormat): InfoAssets {
  if (format === 'png') {
    const file = `iphone_${orientation}.png`;
    return { small: file, medium: file, large: file };
  }
  return { resizable: `iphone_${orientation}.pdf` };
}

function thumbstickFile(item: ThumbstickItem, format: AssetFormat): string {
  return `${item.thumbstick.name}.${format === 'png' ? 'png' : 'pdf'}`;
}

function hasEdges(edges: Edges | undefined): edges is Edges {
  return Boolean(edges) && (['top', 'bottom', 'left', 'right'] as const).some((k) => typeof edges?.[k] === 'number');
}

function exportItem(item: Item, format: AssetFormat): InfoItem {
  const out: Partial<InfoItem> = { inputs: Array.isArray(item.inputs) ? [...item.inputs] : { ...item.inputs } };
  if (hasThumbstick(item)) {
    out.thumbstick = {
      name: thumbstickFile(item, format),
      width: item.thumbstick.width,
      height: item.thumbstick.height,
    };
  }
  out.frame = { ...item.frame };
  if (hasEdges(item.extendedEdges)) out.extendedEdges = { ...item.extendedEdges };
  return out as InfoItem;
}

function exportScreen(screen: Screen, con: ConsoleDef): InfoScreen {
  const out: Partial<InfoScreen> = {};
  if (!con.omitInputFrame) out.inputFrame = { ...screen.inputFrame };
  out.outputFrame = { ...screen.outputFrame };
  if (screen.filters && screen.filters.length) out.filters = structuredClone(screen.filters);
  return out as InfoScreen;
}

function buildInfoJson(state: SkinSource): SkinInfo {
  const con = Consoles.CONSOLES[state.consoleId];
  const family: InfoFamily = {};
  for (const orientation of ORIENTATIONS) {
    const o = state.orientations[orientation];
    if (!o || !o.enabled) continue;
    const rep: InfoRepresentation = {
      assets: assetNames(orientation, state.assetFormat),
      items: o.items.map((item) => exportItem(item, state.assetFormat)),
      screens: o.screens.map((s) => exportScreen(s, con)),
      mappingSize: { ...o.mappingSize },
      extendedEdges: { ...o.extendedEdges },
    };
    if (o.translucent) rep.translucent = true;
    family[orientation] = rep;
  }
  return {
    name: state.name,
    identifier: state.identifier,
    gameTypeIdentifier: con.gameTypeIdentifier,
    debug: !!state.debug,
    representations: { iphone: { [state.device.family]: family } },
  };
}

// Files referenced by info.json, keyed by file name, with what to render for each.
function assetPlan(state: SkinSource): AssetPlanEntry[] {
  const plan: AssetPlanEntry[] = [];
  for (const orientation of ORIENTATIONS) {
    const o = state.orientations[orientation];
    if (!o || !o.enabled) continue;
    const names = assetNames(orientation, state.assetFormat);
    plan.push({ file: (names.resizable || names.large)!, type: 'skin', orientation });
    for (const item of o.items) {
      if (hasThumbstick(item)) {
        plan.push({ file: thumbstickFile(item, state.assetFormat), type: 'thumbstick', orientation, item });
      }
    }
  }
  return plan;
}

export { buildInfoJson, assetPlan, slug, ORIENTATIONS };
