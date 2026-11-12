import type { Settings } from './config';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, STORAGE_KEY } from './config';
import type { AnswerRecord, ModelState } from './model';
import { applyRankedRound, emptyModel } from './model';
import type { TypingFit } from './typing';

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

// Bring saved data from any older schema up to the current one, one step at a time.
//   v0: data written before schemaVersion existed (or with parts missing); missing
//       parts are filled with defaults.
//   v1 → v2: the typing fit went from one set of sums to sums per operation. Old sums
//       can't be split, so the typing fit starts over (it relearns within ~30 answers).
export function migrate(raw: unknown): SaveData {
  if (!isObject(raw)) throw new Error('Save data is not an object');
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > SCHEMA_VERSION) throw new Error(`Save data is from a newer version (${version})`);

  const base = defaultSaveData();
  const model = isObject(raw.model) ? { ...raw.model } : {};
  if (version < 1) {
    version = 1;
  }
  if (version < 2) {
    delete model.typing;
    version = 2;
  }

  const typing = isObject(model.typing) ? model.typing : {};
  return {
    schemaVersion: version,
    settings: isObject(raw.settings) ? { ...base.settings, ...(raw.settings as Partial<Settings>) } : base.settings,
    model: {
      ...base.model,
      ...(model as Partial<ModelState>),
      typing: { ...base.model.typing, ...(typing as Partial<TypingFit>) },
    },
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

// Called when a ranked round is abandoned (quit, page hidden or closed). The buffered
// answers go into the model as practice, no score is recorded, and everything is saved
// right away because the page may be about to disappear. Empties the buffer.
export function flushRankedBuffer(storage: StorageLike, data: SaveData, buffer: AnswerRecord[]): void {
  applyRankedRound(data.model, buffer, false);
  buffer.length = 0;
  save(storage, data);
}
