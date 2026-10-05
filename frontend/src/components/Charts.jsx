import { ALGORITHM_COLORS, ALGORITHM_LABELS } from '../services/format.js';

/** Simple accessible SVG bar chart: items = [{ key, value }] */
export function BarChart({ title, items, format = (v) => v, unit = '' }) {
  const max = Math.max(...items.map((i) => i.value), 0.0001);
  const W = 300; const H = 170; const base = 130; const barW = 54; const gap = (W - items.length * barW) / (items.length + 1);
  return (
    <figure className="card p-4">
      <figcaption className="mb-2 text-sm font-semibold">{title}{unit && <span className="font-normal text-ink/50"> ({unit})</span>}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}: ${items.map((i) => `${ALGORITHM_LABELS[i.key]} ${format(i.value)}`).join(', ')}`}>
        <line x1="0" y1={base} x2={W} y2={base} stroke="#E2DDE8" />
        {items.map((item, idx) => {
          const h = Math.max(2, (item.value / max) * 100);
          const x = gap + idx * (barW + gap);
          return (
            <g key={item.key}>
              <rect x={x} y={base - h} width={barW} height={h} rx="5" fill={ALGORITHM_COLORS[item.key]} />
              <text x={x + barW / 2} y={base - h - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1F1A2B">{format(item.value)}</text>
              <text x={x + barW / 2} y={base + 16} textAnchor="middle" fontSize="10" fill="#6B6478">{item.key === 'genetic' ? 'Genetic' : ALGORITHM_LABELS[item.key]}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Genetic algorithm progress: best and mean fitness per generation. */
export function FitnessLineChart({ history }) {
  if (!history || history.length < 2) return null;
  const W = 420; const H = 190; const L = 36; const R = 10; const T = 10; const B = 28;
  const values = history.flatMap((h) => [h.best_fitness, h.mean_fitness]);
  const lo = Math.floor(Math.min(...values) / 5) * 5; const hi = Math.ceil(Math.max(...values) / 5) * 5 || 100;
  const span = Math.max(1, hi - lo);
  const x = (i) => L + (i / (history.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / span) * (H - T - B);
  const path = (key) => history.map((h, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(h[key]).toFixed(1)}`).join(' ');
  return (
    <figure className="card p-4">
      <figcaption className="mb-2 text-sm font-semibold">Genetic algorithm: fitness per generation</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Line chart of best and mean fitness per generation">
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E2DDE8" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#6B6478">{Math.round(v)}</text>
          </g>
        ))}
        <path d={path('mean_fitness')} fill="none" stroke="#9A93A8" strokeWidth="2" strokeDasharray="4 3" />
        <path d={path('best_fitness')} fill="none" stroke="#7C2142" strokeWidth="2.5" />
        <text x={L} y={H - 8} fontSize="10" fill="#6B6478">Generation 0</text>
        <text x={W - R} y={H - 8} textAnchor="end" fontSize="10" fill="#6B6478">{history[history.length - 1].generation}</text>
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-ink/60">
        <span><span className="mr-1 inline-block h-0.5 w-4 bg-velvet align-middle" />Best</span>
        <span><span className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dashed border-seat-standard align-middle" />Population mean</span>
      </div>
    </figure>
  );
}
