import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui.jsx';
import useFetch from '../hooks/useFetch.js';
import { bookingApi } from '../services/api.js';
import { ALGORITHM_LABELS, formatDate, formatPrice } from '../services/format.js';

export default function Bookings() {
  const { data, loading, error, reload } = useFetch(() => bookingApi.list(), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { bookings } = data;
  return (
    <>
      <PageHeader title="My bookings" />
      {bookings.length === 0 ? (
        <EmptyState title="No bookings yet" text="Pick a theatre and let CineOpt find your seats." action={<Link to="/theatres" className="btn-primary">Book seats</Link>} />
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <article key={b.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold">{b.theatre_name}</h2>
                  <p className="text-sm text-ink/60">Booking #{b.id} - {formatDate(b.created_at)}</p>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl font-bold">{formatPrice(b.total_price)}</div>
                  <div className="text-xs text-ink/60">{ALGORITHM_LABELS[b.algorithm_used]}{b.fitness_score !== null ? `, fitness ${b.fitness_score}` : ''}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {b.seats.map((s) => <span key={s.id} className="chip" title={`${s.seat_type}, ${formatPrice(s.price)}`}>{s.seat_label}</span>)}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
