#!/usr/bin/env node
// Unit checks for js/app/history.js (undo/redo stacks). Usage: node scripts/history-test.js
import assert from 'node:assert';
import { History } from '../src/app/history.js';

// History over a plain counter: snapshot = its value as a string.
function setup(limit) {
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

const tests = {
  'starts with nothing to undo or redo'() {
    const { history } = setup();
    assert.ok(!history.canUndo);
    assert.ok(!history.canRedo);
    assert.strictEqual(history.undo(), false);
    assert.strictEqual(history.redo(), false);
  },

  'record skips unchanged snapshots'() {
    const { model, history } = setup();
    assert.strictEqual(history.record(), false);
    model.value = 1;
    assert.strictEqual(history.record(), true);
    assert.strictEqual(history.record(), false);
    assert.strictEqual(history.undoStack.length, 2);
  },

  'undo and redo walk the snapshots'() {
    const { model, history } = setup();
    for (const v of [1, 2, 3]) {
      model.value = v;
      history.record();
    }
    history.undo();
    assert.strictEqual(model.value, 2);
    history.undo();
    assert.strictEqual(model.value, 1);
    history.redo();
    assert.strictEqual(model.value, 2);
    assert.ok(history.canRedo);
  },

  'a new edit clears the redo stack'() {
    const { model, history } = setup();
    model.value = 1;
    history.record();
    history.undo();
    model.value = 5;
    history.record();
    assert.ok(!history.canRedo);
  },

  'keeps at most `limit` snapshots'() {
    const { model, history } = setup(3);
    for (let v = 1; v <= 10; v++) {
      model.value = v;
      history.record();
    }
    assert.deepStrictEqual(history.undoStack, ['8', '9', '10']);
  },

  'notifies on every stack change'() {
    const { model, history } = setup();
    const before = model.changes;
    model.value = 1;
    history.record();
    history.undo();
    history.redo();
    assert.strictEqual(model.changes - before, 3);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}\n     ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);
