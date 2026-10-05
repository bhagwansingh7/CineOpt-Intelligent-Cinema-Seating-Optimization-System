import { useMemo } from 'react';
import { formatPrice } from '../services/format.js';

const CELL = 34;
const PAD_LEFT = 34;
const PAD_TOP = 74;
const TYPE_STROKE = { standard: '#9A93A8', premium: '#C58A1B', recliner: '#7C2142' };

export function stateOf(seat, selectedIds, recommendedIds) {
  if (seat.status === 'booked') return 'booked';
  if (selectedIds.has(seat.id)) return 'selected';
  if (recommendedIds.has(seat.id)) return 'recommended';
  return 'available';
}

const FILL = { available: '#E9E4F0', booked: '#BDB7C7', recommended: '#12906B', selected: '#2F6FEB' };

/** Interactive SVG seat map. Every seat is focusable and clickable (booked seats report why they cannot be chosen). */
export default function SeatMap({ theatre, seats, selectedIds = new Set(), recommendedIds = new Set(), onSeatClick }) {
  const width = PAD_LEFT + theatre.columns * CELL + 12;
  const height = PAD_TOP + theatre.rows * CELL + 12;
  const rowLabels = useMemo(() => {
    const map = new Map();
    seats.forEach((s) => map.set(s.row_number, s.seat_label.replace(/\d+$/, '')));
    return [...map.entries()];
  }, [seats]);

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto block w-full min-w-[560px] max-w-[900px]" role="group" aria-label={`Seat map of ${theatre.name}`}>
        <path d={`M ${PAD_LEFT + 20} 40 Q ${width / 2} 6 ${width - 32} 40`} fill="none" stroke="#F2B84B" strokeWidth="6" strokeLinecap="round" />
        <text x={width / 2} y="58" textAnchor="middle" fontSize="11" fill="#6B6478">Screen</text>
        {rowLabels.map(([row, label]) => (
          <text key={row} x={PAD_LEFT - 10} y={PAD_TOP + (row - 1) * CELL + CELL / 2 + 4} textAnchor="end" fontSize="11" fill="#6B6478">{label}</text>
        ))}
        {seats.map((seat) => {
          const state = stateOf(seat, selectedIds, recommendedIds);
          const x = PAD_LEFT + (seat.x_coordinate - 1) * CELL;
          const y = PAD_TOP + (seat.y_coordinate - 1) * CELL;
          const label = `${seat.seat_label}, ${seat.seat_type}, ${formatPrice(seat.price)}, ${state}`;
          return (
            <g
              key={seat.id}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={state === 'selected'}
              className="cursor-pointer outline-none focus-visible:[&>rect]:stroke-ink"
              onClick={() => onSeatClick && onSeatClick(seat)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeatClick && onSeatClick(seat); } }}
            >
              <title>{label}</title>
              <rect x={x + 3} y={y + 3} width={CELL - 6} height={CELL - 6} rx="6" fill={FILL[state]} stroke={TYPE_STROKE[seat.seat_type]} strokeWidth="2" />
              {state === 'booked' && (
                <path d={`M ${x + 11} ${y + 11} L ${x + CELL - 11} ${y + CELL - 11} M ${x + CELL - 11} ${y + 11} L ${x + 11} ${y + CELL - 11}`} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              )}
              {(state === 'recommended' || state === 'selected') && (
                <text x={x + CELL / 2} y={y + CELL / 2 + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{seat.seat_label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function SeatLegend() {
  const state = [['Available', FILL.available], ['Booked', FILL.booked], ['Recommended', FILL.recommended], ['Selected', FILL.selected]];
  const type = [['Standard', TYPE_STROKE.standard], ['Premium', TYPE_STROKE.premium], ['Recliner', TYPE_STROKE.recliner]];
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink/70" aria-label="Seat legend">
      <div className="flex flex-wrap gap-3">
        {state.map(([name, color]) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded" style={{ background: color }} />{name}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {type.map(([name, color]) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-4 w-4 rounded border-2 bg-seat-available" style={{ borderColor: color }} />{name}
          </span>
        ))}
      </div>
    </div>
  );
}
