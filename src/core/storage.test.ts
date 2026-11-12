import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, STORAGE_KEY } from './config';
import { makeRecord, recordAnswer } from './model';
import type { StorageLike } from './storage';
import { defaultSaveData, exportJson, importJson, load, migrate, save } from './storage';

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('storage', () => {
  it('round-trips through storage and export/import', () => {
    const s = fakeStorage();
    const d = defaultSaveData();
    d.settings.durationSeconds = 30;
    d.rankedHistory.push({ date: '2026-11-12T10:00:00.000Z', score: 42 });
    recordAnswer(d.model, makeRecord({ op: 'multiplication', left: 7, right: 8, answer: 56 }, 1500, 'ranked', 1), false);

    save(s, d);
    expect([...s.data.keys()]).toEqual([STORAGE_KEY]);
    expect(load(s)).toEqual(d);
    expect(importJson(exportJson(d))).toEqual(d);
  });

  it('returns defaults for empty or corrupt storage', () => {
    const s = fakeStorage();
    expect(load(s)).toEqual(defaultSaveData());
    s.setItem(STORAGE_KEY, '{not json');
    expect(load(s)).toEqual(defaultSaveData());
  });

  it('migrate() upgrades an old (version 0) save', () => {
    const old = { rankedHistory: [{ date: '2025-01-01T00:00:00.000Z', score: 30 }], settings: { durationSeconds: 60 } };
    const m = migrate(old);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect(m.rankedHistory).toEqual(old.rankedHistory);
    expect(m.settings).toEqual({ ...DEFAULT_SETTINGS, durationSeconds: 60 });
    expect(m.model.typing).toEqual(defaultSaveData().model.typing);
  });

  it('import rejects bad input', () => {
    expect(() => importJson('nope')).toThrow();
    expect(() => importJson('[1,2]')).toThrow();
    expect(() => importJson(JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1 }))).toThrow();
  });
});
