// Browser persistence: the autosaved project and the editor view preferences, plus the debounced
// autosave. Storage can be unavailable (private mode, full quota), so every access is guarded.

import type { ProjectState, ViewPrefs } from '../types';

const PROJECT_KEY = 'delta-skin-generator:v1';
const VIEW_KEY = 'delta-skin-generator:view';
const AUTOSAVE_DELAY_MS = 400;

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

class ProjectStorage {
  onQuotaExceeded: () => void;
  warnedQuota = false;

  // onQuotaExceeded: called once when background images don't fit and only the layout is saved.
  constructor({ onQuotaExceeded = () => {} }: { onQuotaExceeded?: () => void } = {}) {
    this.onQuotaExceeded = onQuotaExceeded;
  }

  // Unvalidated: pass it through restoreState().
  loadProject(): unknown {
    return readJson(PROJECT_KEY);
  }

  saveProject(state: ProjectState): void {
    if (writeJson(PROJECT_KEY, state)) return;
    // Quota exceeded by large background images: keep at least the layout.
    writeJson(PROJECT_KEY, { ...state, bgImages: {} });
    if (this.warnedQuota) return;
    this.warnedQuota = true;
    this.onQuotaExceeded();
  }

  loadView(defaults: ViewPrefs): ViewPrefs {
    const saved = readJson(VIEW_KEY);
    return { ...defaults, ...(saved && typeof saved === 'object' ? saved : {}) };
  }

  // Only guides and grid persist; the overlay toggles reset with each visit.
  saveView(view: ViewPrefs): void {
    writeJson(VIEW_KEY, { guides: view.guides, grid: view.grid });
  }
}

// Debounced save. While `isBusy()` (a drag in progress) it waits, so a snapshot never lands
// halfway through a gesture; the pointer-up change schedules the final one.
interface AutosaveOptions {
  save: () => void;
  isBusy?: () => boolean;
  delay?: number;
}

class Autosave {
  save: () => void;
  isBusy: () => boolean;
  delay: number;
  timer: ReturnType<typeof setTimeout> | undefined;

  constructor({ save, isBusy = () => false, delay = AUTOSAVE_DELAY_MS }: AutosaveOptions) {
    this.save = save;
    this.isBusy = isBusy;
    this.delay = delay;
  }

  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
  }

  flush(): void {
    clearTimeout(this.timer);
    if (this.isBusy()) {
      this.schedule();
      return;
    }
    this.save();
  }
}

export { ProjectStorage, Autosave };
