import { useEffect, useRef } from 'react';
import { CategoryScale, Chart, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';
import type { RankedEntry } from '../core/storage';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);
Chart.defaults.font.size = 15;

const LINE = '#4a5568';
const BEST = '#c2410c';

// Ranked scores in the order played; the personal best is a larger orange point.
export function ScoreChart({ history }: { history: RankedEntry[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  const scores = history.map((h) => h.score);
  const best = Math.max(...scores);
  const bestIndex = scores.indexOf(best);

  useEffect(() => {
    if (!canvas.current) return;
    const chart = new Chart(canvas.current, {
      type: 'line',
      data: {
        labels: history.map((h) => new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
        datasets: [
          {
            data: scores,
            borderColor: LINE,
            borderWidth: 2,
            pointRadius: scores.map((_, i) => (i === bestIndex ? 6 : 3)),
            pointHoverRadius: 7,
            pointBackgroundColor: scores.map((_, i) => (i === bestIndex ? BEST : LINE)),
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
          },
        ],
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => new Date(history[items[0].dataIndex].date).toLocaleString(),
              label: (item) => `Score: ${item.parsed.y}${item.dataIndex === bestIndex ? ' (best)' : ''}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0, color: '#666' } },
          y: { beginAtZero: true, grid: { color: '#eee' }, ticks: { precision: 0, color: '#666' } },
        },
      },
    });
    return () => chart.destroy();
  }, [history]);

  return (
    <div>
      <p>
        Personal best: <strong>{best}</strong> <span className="muted">({history.length} ranked {history.length === 1 ? 'game' : 'games'})</span>
      </p>
      <div className="chart">
        <canvas ref={canvas} role="img" aria-label={`Ranked scores over time. Personal best ${best}.`} />
      </div>
    </div>
  );
}
