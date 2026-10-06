// Selection references: `{ type: 'item', id }` for buttons, `{ type: 'screen', index }` for
// game screens. Shared by the canvas editor and the inspector.

import type { Frame, Item, OrientationLayout, Ref, Screen } from './types';

export type Resolved = { item: Item; screen?: undefined; frame: Frame } | { item?: undefined; screen: Screen; frame: Frame };

const itemRef = (id: string): Ref => ({ type: 'item', id });
const screenRef = (index: number): Ref => ({ type: 'screen', index });
const refKey = (ref: Ref): string => (ref.type === 'item' ? `i:${ref.id}` : `s:${ref.index}`);

function containsRef(refs: Ref[], ref: Ref): boolean {
  const key = refKey(ref);
  return refs.some((r) => refKey(r) === key);
}

// Adds `ref` to the selection, or removes it when already selected (Shift/Ctrl+click).
function toggleRef(refs: Ref[], ref: Ref): Ref[] {
  const key = refKey(ref);
  return containsRef(refs, ref) ? refs.filter((r) => refKey(r) !== key) : [...refs, ref];
}

// { item, frame } or { screen, frame } for a ref in the orientation, or null if it is gone.
function resolveRef(orient: OrientationLayout, ref: Ref): Resolved | null {
  if (ref.type === 'item') {
    const item = orient.items.find((i) => i.id === ref.id);
    return item ? { item, frame: item.frame } : null;
  }
  const screen = orient.screens[ref.index];
  return screen ? { screen, frame: screen.outputFrame } : null;
}

// Every selectable element: buttons (the DS touch item follows its screen) and screens.
function selectableRefs(orient: OrientationLayout): Ref[] {
  const items = orient.items.filter((i) => i.kind !== 'touch').map((i) => itemRef(i.id));
  const screens = orient.screens.map((_, index) => screenRef(index));
  return [...items, ...screens];
}

export { itemRef, screenRef, refKey, containsRef, toggleRef, resolveRef, selectableRefs };
