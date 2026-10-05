import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ROWS = 6; const COLS = 12; const CELL = 30;
const BOOKED = new Set(['0-3', '0-4', '1-8', '2-1', '2-2', '2-9', '3-5', '3-6', '3-10', '4-0', '4-7', '5-3', '5-4']);
const CHOSEN = [[2, 4], [2, 5], [2, 6], [2, 7]];

function DemoMap() {
  return (
    <svg viewBox={`0 0 ${COLS * CELL + 20} ${ROWS * CELL + 56}`} className="w-full max-w-md" role="img" aria-label="Example seat map where four adjacent centre seats are recommended">
      <path d={`M 30 28 Q ${(COLS * CELL + 20) / 2} 0 ${COLS * CELL - 10} 28`} stroke="#F2B84B" strokeWidth="5" fill="none" strokeLinecap="round" />
      {Array.from({ length: ROWS }).flatMap((_, r) => Array.from({ length: COLS }).map((__, c) => {
        const key = `${r}-${c}`;
        const idx = CHOSEN.findIndex(([rr, cc]) => rr === r && cc === c);
        const booked = BOOKED.has(key);
        return (
          <rect key={key} x={10 + c * CELL + 3} y={46 + r * CELL + 3} width={CELL - 6} height={CELL - 6} rx="5"
            className={idx >= 0 ? 'seat-light' : undefined}
            style={idx >= 0 ? { animationDelay: `${0.5 + idx * 0.25}s` } : undefined}
            fill={booked ? '#BDB7C7' : '#E9E4F0'} />
        );
      }))}
    </svg>
  );
}

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="grid items-center gap-10 py-6 md:grid-cols-2">
      <div>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">CineOpt intelligently finds the best cinema seats based on your preferences.</h1>
        <p className="mt-4 max-w-prose text-lg text-ink/70">
          Tell us how many people are coming, what you can spend and where you like to sit. We search every free seat,
          compare three optimisation methods and show you the arrangement that keeps your group together.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/theatres" className="btn-primary">Book seats</Link>
          {!user && <Link to="/login" className="btn-secondary">Log in</Link>}
          {!user && <Link to="/register" className="btn-secondary">Register</Link>}
        </div>
      </div>
      <div className="card flex justify-center bg-white p-6"><DemoMap /></div>
      <ul className="grid gap-4 md:col-span-2 md:grid-cols-3">
        {[
          ['Stays within budget', 'A 0/1 knapsack search maximises seat quality without passing your limit.'],
          ['Keeps groups together', 'Closest-pair distances and gap penalties favour C5 C6 C7 C8 over C5 C6 C12 C13.'],
          ['Shows its work', 'Greedy, knapsack and genetic results are compared side by side with timings.'],
        ].map(([title, text]) => (
          <li key={title} className="card p-5"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-ink/70">{text}</p></li>
        ))}
      </ul>
    </div>
  );
}
