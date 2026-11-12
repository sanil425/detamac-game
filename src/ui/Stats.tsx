import { useRef, useState } from 'react';
import { groupLabel } from '../core/groups';
import type { Trend } from '../core/model';
import { weakestGroups } from '../core/model';
import type { SaveData } from '../core/storage';
import { exportJson, importJson } from '../core/storage';
import { Heatmap } from './Heatmap';
import { ScoreChart } from './ScoreChart';

interface Props {
  data: SaveData;
  onImport: (data: SaveData) => void;
  onBack: () => void;
}

const WEAKEST_COUNT = 10;

// Fast vs slow average: lower recent times mean improvement.
const TREND_ARROW: Record<Trend, { arrow: string; text: string }> = {
  improving: { arrow: '↑', text: 'improving' },
  worsening: { arrow: '↓', text: 'getting slower' },
  flat: { arrow: '→', text: 'steady' },
};

function ratioText(w: number): string {
  return w >= 1 ? `${w.toFixed(1)}× slower` : `${(1 / w).toFixed(1)}× faster`;
}

export function Stats({ data, onImport, onBack }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const weakest = weakestGroups(data.model, WEAKEST_COUNT);

  function download() {
    const blob = new Blob([exportJson(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detamac-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(file: File) {
    try {
      const imported = importJson(await file.text());
      if (!window.confirm('Replace all your current Detamac data with this file?')) return;
      onImport(imported);
      setMessage('Imported.');
    } catch (e) {
      setMessage(`Import failed: ${e instanceof Error ? e.message : 'unreadable file'}`);
    }
  }

  return (
    <div className="page">
      <p>
        <button type="button" className="link" onClick={onBack}>
          ← Back
        </button>
      </p>
      <h1>Stats</h1>

      <h2>Ranked scores</h2>
      {data.rankedHistory.length > 0 ? (
        <ScoreChart history={data.rankedHistory} />
      ) : (
        <p className="muted">No ranked games yet.</p>
      )}

      <h2>Multiplication facts</h2>
      <Heatmap model={data.model} />

      <h2>Weakest groups</h2>
      {weakest.length > 0 ? (
        <ol className="weakest">
          {weakest.map((g) => (
            <li key={g.id}>
              {groupLabel(g.id)}: <strong>{ratioText(g.weakness)}</strong>{' '}
              <span title={TREND_ARROW[g.trend].text} className="muted">
                {TREND_ARROW[g.trend].arrow} {TREND_ARROW[g.trend].text}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Play a few rounds to see which question types slow you down.</p>
      )}
      <p className="muted small">Compared with your average speed for the same operation.</p>

      <h2>Your data</h2>
      <p className="muted small">Everything is stored in this browser only.</p>
      <p>
        <button type="button" onClick={download}>
          Export JSON
        </button>{' '}
        <button type="button" onClick={() => fileInput.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void upload(file);
          }}
        />
      </p>
      {message && <p>{message}</p>}
    </div>
  );
}
