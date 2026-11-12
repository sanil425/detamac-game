import { useState } from 'react';
import type { Range, Settings as SettingsType } from '../core/config';
import { DURATIONS, RANKED_DURATION } from '../core/config';

interface Props {
  initial: SettingsType;
  onChange: (settings: SettingsType) => void;
  onStartPractice: (settings: SettingsType) => void;
  onStartRanked: () => void;
  onStats: () => void;
}

// Range inputs are kept as text while editing so the player can clear a box and retype.
interface RangeText {
  min: string;
  max: string;
}

type RangeKey = 'addLeft' | 'addRight' | 'mulLeft' | 'mulRight';
const RANGE_KEYS: RangeKey[] = ['addLeft', 'addRight', 'mulLeft', 'mulRight'];
const MAX_VALUE = 99999;

function toText(r: Range): RangeText {
  return { min: String(r.min), max: String(r.max) };
}

function parseRange(t: RangeText): Range | null {
  const min = Number(t.min);
  const max = Number(t.max);
  const ok = (n: number) => t.min.trim() !== '' && t.max.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= MAX_VALUE;
  return ok(min) && ok(max) && min <= max ? { min, max } : null;
}

export function Settings({ initial, onChange, onStartPractice, onStartRanked, onStats }: Props) {
  const [form, setForm] = useState<SettingsType>(initial);
  const [ranges, setRanges] = useState<Record<RangeKey, RangeText>>({
    addLeft: toText(initial.addLeft),
    addRight: toText(initial.addRight),
    mulLeft: toText(initial.mulLeft),
    mulRight: toText(initial.mulRight),
  });

  // Build valid settings from the form, or explain what's wrong.
  function validate(f: SettingsType, r: Record<RangeKey, RangeText>): SettingsType | string {
    if (!f.addition && !f.subtraction && !f.multiplication && !f.division) return 'Pick at least one operation.';
    const parsed = { ...f };
    for (const key of RANGE_KEYS) {
      const range = parseRange(r[key]);
      if (!range) return `Ranges must be whole numbers from 1 to ${MAX_VALUE}, low to high.`;
      parsed[key] = range;
    }
    return parsed;
  }

  const result = validate(form, ranges);
  const error = typeof result === 'string' ? result : null;

  function update(f: SettingsType, r: Record<RangeKey, RangeText>) {
    setForm(f);
    setRanges(r);
    const v = validate(f, r);
    if (typeof v !== 'string') onChange(v);
  }

  const toggle = (op: 'addition' | 'subtraction' | 'multiplication' | 'division') =>
    update({ ...form, [op]: !form[op] }, ranges);

  const rangeInput = (key: RangeKey, end: 'min' | 'max') => (
    <input
      className="range"
      type="text"
      inputMode="numeric"
      aria-label={`${key} ${end}`}
      value={ranges[key][end]}
      onChange={(e) => update(form, { ...ranges, [key]: { ...ranges[key], [end]: e.target.value } })}
    />
  );

  return (
    <div className="page">
      <h1>Detamac</h1>
      <p>A quick arithmetic drill: answer as many problems as you can before the clock runs out.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (typeof result !== 'string') onStartPractice(result);
        }}
      >
        <div className="op">
          <label>
            <input type="checkbox" checked={form.addition} onChange={() => toggle('addition')} /> Addition
          </label>
          <div className="op-detail">
            Range: ({rangeInput('addLeft', 'min')} to {rangeInput('addLeft', 'max')}) + ({rangeInput('addRight', 'min')}{' '}
            to {rangeInput('addRight', 'max')})
          </div>
        </div>

        <div className="op">
          <label>
            <input type="checkbox" checked={form.subtraction} onChange={() => toggle('subtraction')} /> Subtraction
          </label>
          <div className="op-detail">Addition problems in reverse.</div>
        </div>

        <div className="op">
          <label>
            <input type="checkbox" checked={form.multiplication} onChange={() => toggle('multiplication')} />{' '}
            Multiplication
          </label>
          <div className="op-detail">
            Range: ({rangeInput('mulLeft', 'min')} to {rangeInput('mulLeft', 'max')}) × ({rangeInput('mulRight', 'min')}{' '}
            to {rangeInput('mulRight', 'max')})
          </div>
        </div>

        <div className="op">
          <label>
            <input type="checkbox" checked={form.division} onChange={() => toggle('division')} /> Division
          </label>
          <div className="op-detail">Multiplication problems in reverse.</div>
        </div>

        <div className="op">
          Duration:{' '}
          <select
            value={form.durationSeconds}
            onChange={(e) => update({ ...form, durationSeconds: Number(e.target.value) }, ranges)}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} seconds
              </option>
            ))}
          </select>
        </div>

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={error !== null}>
          Start practice
        </button>
      </form>

      <hr />
      <p>
        <button type="button" onClick={onStartRanked}>
          Play ranked
        </button>{' '}
        <span className="muted">Default settings, {RANKED_DURATION} seconds. Scores are saved.</span>
      </p>
      <p>
        <button type="button" className="link" onClick={onStats}>
          Stats
        </button>
      </p>
    </div>
  );
}
