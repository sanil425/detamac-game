import type { Settings } from './config';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, STORAGE_KEY } from './config';
import type { ModelState } from './model';
import { emptyModel } from './model';

export interface RankedEntry {
  date: string; // ISO timestamp
  score: number;
}

export interface SaveData {
  schemaVersion: number;
  settings: Settings; // practice settings
  model: ModelState;
  rankedHistory: RankedEntry[];
}

// Anything with getItem/setItem (window.localStorage, or a fake in tests).
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultSaveData(): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    model: emptyModel(),
    rankedHistory: [],
  };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

// Bring saved data from any older schema up to the current one.
// Version 0 = data written before schemaVersion existed (or with parts missing);
// it is upgraded by filling missing parts with defaults.
// Future versions add steps: `if (version < 2) { ...; version = 2; }`
export function migrate(raw: unknown): SaveData {
  if (!isObject(raw)) throw new Error('Save data is not an object');
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > SCHEMA_VERSION) throw new Error(`Save data is from a newer version (${version})`);

  const base = defaultSaveData();
  if (version < 1) {
    version = 1;
  }

  const model = isObject(raw.model) ? raw.model : {};
  return {
    schemaVersion: version,
    settings: isObject(raw.settings) ? { ...base.settings, ...(raw.settings as Partial<Settings>) } : base.settings,
    model: { ...base.model, ...(model as Partial<ModelState>) },
    rankedHistory: Array.isArray(raw.rankedHistory) ? (raw.rankedHistory as RankedEntry[]) : [],
  };
}

export function load(storage: StorageLike): SaveData {
  const text = storage.getItem(STORAGE_KEY);
  if (!text) return defaultSaveData();
  try {
    return migrate(JSON.parse(text));
  } catch {
    return defaultSaveData();
  }
}

export function save(storage: StorageLike, data: SaveData): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportJson(data: SaveData): string {
  return JSON.stringify(data, null, 2);
}

// Throws on invalid JSON or unusable data, so the UI can show an error.
export function importJson(text: string): SaveData {
  return migrate(JSON.parse(text));
}
