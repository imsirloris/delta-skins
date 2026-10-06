// Undo/redo over serialized snapshots. It knows nothing about the DOM or the project shape:
// the owner says how to take a snapshot and how to restore one.

const DEFAULT_LIMIT = 100;

class History {
  // snapshot(): string; restore(snapshot); onChange(): after the stacks change.
  constructor({ snapshot, restore, limit = DEFAULT_LIMIT, onChange = () => {} }) {
    this.snapshot = snapshot;
    this.restore = restore;
    this.limit = limit;
    this.onChange = onChange;
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo() {
    return this.undoStack.length > 1;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  reset() {
    this.undoStack = [this.snapshot()];
    this.redoStack = [];
    this.onChange();
  }

  // Returns false when nothing changed since the last snapshot.
  record() {
    const snap = this.snapshot();
    if (snap === this.undoStack[this.undoStack.length - 1]) return false;
    this.undoStack.push(snap);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.onChange();
    return true;
  }

  undo() {
    if (!this.canUndo) return false;
    this.redoStack.push(this.undoStack.pop());
    this.restore(this.undoStack[this.undoStack.length - 1]);
    this.onChange();
    return true;
  }

  redo() {
    if (!this.canRedo) return false;
    const snap = this.redoStack.pop();
    this.undoStack.push(snap);
    this.restore(snap);
    this.onChange();
    return true;
  }
}

export { History };
