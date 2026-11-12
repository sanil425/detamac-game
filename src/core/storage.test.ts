import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, EWMA_ALPHA, PRACTICE_WEIGHT, SCHEMA_VERSION, STORAGE_KEY } from './config';
import type { AnswerRecord } from './model';
import { makeRecord, recordAnswer } from './model';
import type { StorageLike } from './storage';
import { defaultSaveData, exportJson, importJson, flushRankedBuffer, load, migrate, save } from './storage';

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

  it('flushRankedBuffer (pagehide / quit) saves buffered ranked answers as practice, no score', () => {
    const s = fakeStorage();
    const data = defaultSaveData();
    const q = { op: 'addition' as const, left: 27, right: 38, answer: 65 };
    const buffer: AnswerRecord[] = [
      makeRecord(q, 5000, 'ranked', 1), // first of round: skipped
      makeRecord(q, 1000, 'ranked', 2),
      makeRecord(q, 2000, 'ranked', 3),
    ];
    flushRankedBuffer(s, data, buffer);

    expect(buffer).toEqual([]); // emptied, so a second flush can't double count
    const saved = load(s);
    expect(saved.rankedHistory).toEqual([]);
    expect(saved.model.totalAnswers).toBe(2);
    const g = saved.model.groups['add:carry:2+2:le100'];
    expect(g.fast).toBeCloseTo(1000 + EWMA_ALPHA * PRACTICE_WEIGHT * 1000);

    flushRankedBuffer(s, data, buffer);
    expect(load(s).model.totalAnswers).toBe(2);
  });

  it('migrate() v1 → v2 keeps stats and history but restarts the old single-line typing fit', () => {
    const v1 = {
      schemaVersion: 1,
      settings: { ...DEFAULT_SETTINGS, durationSeconds: 300 },
      rankedHistory: [{ date: '2026-11-01T00:00:00.000Z', score: 40 }],
      model: {
        groups: { 'mul:7:le12': { fast: 3000, slow: 3100, count: 9, lastSeen: 5 } },
        facts: {},
        operations: { multiplication: { fast: 2000, slow: 2000, count: 9, lastSeen: 5 } },
        typing: { n: 3, sumX: 6, sumY: 3000, sumXX: 14, sumXY: 6200, digitCounts: { 2: 3 } },
        totalAnswers: 9,
      },
    };
    const m = migrate(v1);
    expect(m.schemaVersion).toBe(2);
    expect(m.model.typing).toEqual(defaultSaveData().model.typing);
    expect(m.model.groups['mul:7:le12'].count).toBe(9);
    expect(m.model.totalAnswers).toBe(9);
    expect(m.rankedHistory).toEqual(v1.rankedHistory);
    expect(m.settings.durationSeconds).toBe(300);
  });

  it('import rejects bad input', () => {
    expect(() => importJson('nope')).toThrow();
    expect(() => importJson('[1,2]')).toThrow();
    expect(() => importJson(JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1 }))).toThrow();
  });
});
