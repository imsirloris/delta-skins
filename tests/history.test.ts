// Undo/redo stacks (src/app/history.ts).

import { describe, expect, it } from 'vitest';
import { History } from '../src/app/history';

// History over a plain counter: snapshot = its value as a string.
function setup(limit?: number) {
  const model = { value: 0, changes: 0 };
  const history = new History({
    snapshot: () => String(model.value),
    restore: (snap) => (model.value = Number(snap)),
    onChange: () => model.changes++,
    limit,
  });
  history.reset();
  return { model, history };
}

describe('History', () => {
  it('starts with nothing to undo or redo', () => {
    const { history } = setup();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBe(false);
    expect(history.redo()).toBe(false);
  });

  it('skips unchanged snapshots', () => {
    const { model, history } = setup();
    expect(history.record()).toBe(false);
    model.value = 1;
    expect(history.record()).toBe(true);
    expect(history.record()).toBe(false);
    expect(history.undoStack).toHaveLength(2);
  });

  it('walks the snapshots with undo and redo', () => {
    const { model, history } = setup();
    for (const v of [1, 2, 3]) {
      model.value = v;
      history.record();
    }
    history.undo();
    expect(model.value).toBe(2);
    history.undo();
    expect(model.value).toBe(1);
    history.redo();
    expect(model.value).toBe(2);
    expect(history.canRedo).toBe(true);
  });

  it('clears the redo stack on a new edit', () => {
    const { model, history } = setup();
    model.value = 1;
    history.record();
    history.undo();
    model.value = 5;
    history.record();
    expect(history.canRedo).toBe(false);
  });

  it('keeps at most `limit` snapshots', () => {
    const { model, history } = setup(3);
    for (let v = 1; v <= 10; v++) {
      model.value = v;
      history.record();
    }
    expect(history.undoStack).toEqual(['8', '9', '10']);
  });

  it('notifies on every stack change', () => {
    const { model, history } = setup();
    const before = model.changes;
    model.value = 1;
    history.record();
    history.undo();
    history.redo();
    expect(model.changes - before).toBe(3);
  });
});
