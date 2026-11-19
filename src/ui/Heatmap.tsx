import { FACT_MAX, FACT_MIN, MIN_ATTEMPTS } from '../core/config';
import type { ModelState } from '../core/model';
import { factRatio } from '../core/model';

const CELL = 40;
const PAD = 30; // room for axis labels
const FASTER: [number, number, number] = [43, 108, 176]; // blue
const SLOWER: [number, number, number] = [194, 65, 12]; // orange
const MIDDLE: [number, number, number] = [255, 255, 255]; // white, same speed as average
const BORDER = '#bbb';

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Diverging scale: 0.8× or faster is full blue, 1.0 is white, 1.5× or slower is full orange.
// `opacity` fades the colour toward white for facts with too few answers to trust.
function colorFor(ratio: number, opacity: number): { fill: string; strength: number } {
  const t = ratio < 1 ? -Math.min(1, (1 - ratio) / 0.2) : Math.min(1, (ratio - 1) / 0.5);
  const strength = Math.abs(t) * opacity;
  return { fill: mix(MIDDLE, t < 0 ? FASTER : SLOWER, strength), strength };
}

// One cell per unordered fact (a ≤ b), so 7×8 and 8×7 share a cell.
export function Heatmap({ model }: { model: ModelState }) {
  const values: number[] = [];
  for (let v = FACT_MIN; v <= FACT_MAX; v++) values.push(v);
  const size = PAD + values.length * CELL;

  return (
    <div>
      <svg className="heatmap" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Multiplication fact speeds">
        {values.map((v, i) => (
          <g key={`label-${v}`} fontSize="16" fill="#555" textAnchor="middle">
            <text x={PAD + i * CELL + CELL / 2} y={PAD - 10}>
              {v}
            </text>
            <text x={PAD / 2} y={PAD + i * CELL + CELL / 2 + 5}>
              {v}
            </text>
          </g>
        ))}
        {values.map((a, row) =>
          values.map((b, col) => {
            if (b < a) return null;
            const id = `${a}x${b}`;
            const stat = model.facts[id];
            const ratio = factRatio(model, id);
            const x = PAD + col * CELL;
            const y = PAD + row * CELL;
            const count = stat?.count ?? 0;
            if (count === 0 || ratio === null) {
              return (
                <rect
                  key={id}
                  x={x + 1}
                  y={y + 1}
                  width={CELL - 2}
                  height={CELL - 2}
                  rx={3}
                  fill="#fff"
                  stroke="#ccc"
                  strokeDasharray="2 2"
                >
                  <title>{`${a} × ${b}: no answers yet`}</title>
                </rect>
              );
            }
            if (count < MIN_ATTEMPTS) {
              return (
                <rect
                  key={id}
                  x={x + 1}
                  y={y + 1}
                  width={CELL - 2}
                  height={CELL - 2}
                  rx={3}
                  fill={colorFor(ratio, count / MIN_ATTEMPTS).fill}
                  stroke={BORDER}
                >
                  <title>{`${a} × ${b}: ${count} of ${MIN_ATTEMPTS} answers needed`}</title>
                </rect>
              );
            }
            const { fill, strength } = colorFor(ratio, 1);
            return (
              <g key={id}>
                <rect x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2} rx={3} fill={fill} stroke={BORDER}>
                  <title>{`${a} × ${b}: ${ratio.toFixed(2)}× your multiplication average (${count} answers)`}</title>
                </rect>
                <text
                  x={x + CELL / 2}
                  y={y + CELL / 2 + 6}
                  fontSize="17"
                  textAnchor="middle"
                  fill={strength > 0.6 ? '#fff' : '#222'}
                  pointerEvents="none"
                >
                  {ratio.toFixed(1)}
                </text>
              </g>
            );
          }),
        )}
      </svg>
      <p className="legend small">
        <span className="swatch" style={{ background: mix(MIDDLE, FASTER, 1) }} /> faster{' '}
        <span className="swatch" style={{ background: mix(MIDDLE, FASTER, 0) }} /> average{' '}
        <span className="swatch" style={{ background: mix(MIDDLE, SLOWER, 1) }} /> slower
      </p>
      <p className="muted small">
        Time per fact relative to your multiplication average. Faded = fewer than {MIN_ATTEMPTS} answers; dotted = none
        yet.
      </p>
    </div>
  );
}
