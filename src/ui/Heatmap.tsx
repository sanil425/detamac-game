import { FACT_MAX, FACT_MIN, MIN_ATTEMPTS } from '../core/config';
import type { ModelState } from '../core/model';
import { factRatio } from '../core/model';

const CELL = 34;
const PAD = 26; // room for axis labels
const FASTER: [number, number, number] = [43, 108, 176]; // blue
const SLOWER: [number, number, number] = [194, 65, 12]; // orange
const MIDDLE: [number, number, number] = [244, 244, 244]; // neutral, same speed as average
const NO_DATA = '#d4d4d4';

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Diverging scale on log2(ratio): 2× slower is full orange, 2× faster is full blue.
function colorFor(ratio: number): { fill: string; strength: number } {
  const t = Math.max(-1, Math.min(1, Math.log2(ratio)));
  return { fill: t < 0 ? mix(MIDDLE, FASTER, -t) : mix(MIDDLE, SLOWER, t), strength: Math.abs(t) };
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
          <g key={`label-${v}`} fontSize="12" fill="#555" textAnchor="middle">
            <text x={PAD + i * CELL + CELL / 2} y={PAD - 9}>
              {v}
            </text>
            <text x={PAD / 2} y={PAD + i * CELL + CELL / 2 + 4}>
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
            const enough = stat !== undefined && stat.count >= MIN_ATTEMPTS && ratio !== null;
            const x = PAD + col * CELL;
            const y = PAD + row * CELL;
            const count = stat?.count ?? 0;
            if (!enough) {
              return (
                <rect key={id} x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2} rx={3} fill={NO_DATA}>
                  <title>{`${a} × ${b}: ${count} of ${MIN_ATTEMPTS} answers needed`}</title>
                </rect>
              );
            }
            const { fill, strength } = colorFor(ratio);
            return (
              <g key={id}>
                <rect x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2} rx={3} fill={fill}>
                  <title>{`${a} × ${b}: ${ratio.toFixed(2)}× your multiplication average (${count} answers)`}</title>
                </rect>
                <text
                  x={x + CELL / 2}
                  y={y + CELL / 2 + 4}
                  fontSize="11"
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
      <p className="muted small">
        Time per fact relative to your multiplication average: 1.0 = average, blue = faster, orange = slower. Grey =
        fewer than {MIN_ATTEMPTS} answers.
      </p>
    </div>
  );
}
