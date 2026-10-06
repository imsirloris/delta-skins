// Browser persistence: the autosaved project and the editor view preferences, plus the debounced
// autosave. Storage can be unavailable (private mode, full quota), so every access is guarded.

const PROJECT_KEY = 'delta-skin-generator:v1';
const VIEW_KEY = 'delta-skin-generator:view';
const AUTOSAVE_DELAY_MS = 400;

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

class ProjectStorage {
  // onQuotaExceeded: called once when background images don't fit and only the layout is saved.
  constructor({ onQuotaExceeded = () => {} } = {}) {
    this.onQuotaExceeded = onQuotaExceeded;
    this.warnedQuota = false;
  }

  loadProject() {
    return readJson(PROJECT_KEY);
  }

  saveProject(state) {
    if (writeJson(PROJECT_KEY, state)) return;
    // Quota exceeded by large background images: keep at least the layout.
    writeJson(PROJECT_KEY, { ...state, bgImages: {} });
    if (this.warnedQuota) return;
    this.warnedQuota = true;
    this.onQuotaExceeded();
  }

  loadView(defaults) {
    return { ...defaults, ...readJson(VIEW_KEY) };
  }

  // Only guides and grid persist; the overlay toggles reset with each visit.
  saveView(view) {
    writeJson(VIEW_KEY, { guides: view.guides, grid: view.grid });
  }
}

// Debounced save. While `isBusy()` (a drag in progress) it waits, so a snapshot never lands
// halfway through a gesture; the pointer-up change schedules the final one.
class Autosave {
  constructor({ save, isBusy = () => false, delay = AUTOSAVE_DELAY_MS }) {
    this.save = save;
    this.isBusy = isBusy;
    this.delay = delay;
    this.timer = null;
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
  }

  flush() {
    clearTimeout(this.timer);
    if (this.isBusy()) {
      this.schedule();
      return;
    }
    this.save();
  }
}

export { ProjectStorage, Autosave };
