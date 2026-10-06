// Undo/redo over serialized snapshots. It knows nothing about the DOM or the project shape:
// the owner says how to take a snapshot and how to restore one.

const DEFAULT_LIMIT = 100;

interface HistoryOptions {
  snapshot: () => string;
  restore: (snapshot: string) => void;
  limit?: number;
  // Called after the stacks change.
  onChange?: () => void;
}

class History {
  snapshot: () => string;
  restore: (snapshot: string) => void;
  limit: number;
  onChange: () => void;
  undoStack: string[] = [];
  redoStack: string[] = [];

  constructor({ snapshot, restore, limit = DEFAULT_LIMIT, onChange = () => {} }: HistoryOptions) {
    this.snapshot = snapshot;
    this.restore = restore;
    this.limit = limit;
    this.onChange = onChange;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  reset(): void {
    this.undoStack = [this.snapshot()];
    this.redoStack = [];
    this.onChange();
  }

  // Returns false when nothing changed since the last snapshot.
  record(): boolean {
    const snap = this.snapshot();
    if (snap === this.undoStack[this.undoStack.length - 1]) return false;
    this.undoStack.push(snap);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.onChange();
    return true;
  }

  undo(): boolean {
    const top = this.undoStack.at(-1);
    if (!this.canUndo || top === undefined) return false;
    this.undoStack.pop();
    this.redoStack.push(top);
    this.restore(this.undoStack[this.undoStack.length - 1]);
    this.onChange();
    return true;
  }

  redo(): boolean {
    const snap = this.redoStack.pop();
    if (snap === undefined) return false;
    this.undoStack.push(snap);
    this.restore(snap);
    this.onChange();
    return true;
  }
}

export { History };
