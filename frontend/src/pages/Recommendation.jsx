import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import SeatMap, { SeatLegend } from '../components/SeatMap.jsx';
import { ErrorState, Metric, PageHeader, Spinner } from '../components/ui.jsx';
import { useBookingFlow } from '../context/BookingFlowContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useFetch from '../hooks/useFetch.js';
import { bookingApi, errorMessage, theatreApi } from '../services/api.js';
import { ALGORITHM_LABELS, formatMs, formatPrice } from '../services/format.js';

export default function Recommendation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { flow, clear } = useBookingFlow();
  const { data, loading, error, reload } = useFetch(() => theatreApi.seats(id), [id]);
  const [confirming, setConfirming] = useState(false);

  if (!flow || String(flow.theatreId) !== String(id)) return <Navigate to={`/theatres/${id}`} replace />;
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { result, request } = flow;
  const ids = new Set(result.recommended_seats.map((s) => s.id));

  const confirm = async () => {
    setConfirming(true);
    try {
      await bookingApi.create({
        theatre_id: Number(id), seat_ids: [...ids], algorithm_used: result.algorithm,
        fitness_score: result.fitness_score, max_budget: request.max_budget,
      });
      toast.success('Booking confirmed. Enjoy the film!');
      clear();
      navigate('/bookings');
    } catch (err) {
      toast.error(errorMessage(err));
      navigate(`/theatres/${id}`);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <PageHeader title="Recommended seats">
        <Link to={`/theatres/${id}/compare`} className="btn-secondary">Compare algorithms</Link>
        <Link to={`/theatres/${id}`} className="btn-secondary" onClick={clear}>Try again</Link>
        <button type="button" className="btn-primary" onClick={confirm} disabled={confirming}>{confirming ? 'Confirming...' : 'Confirm booking'}</button>
      </PageHeader>

      <div className="card mb-6 p-5">
        <div className="flex flex-wrap gap-2">
          {result.recommended_seats.map((s) => (
            <span key={s.id} className="rounded-lg bg-seat-recommended px-3 py-1.5 font-display text-lg font-bold text-white" title={`${s.seat_type}, ${formatPrice(s.price)}`}>{s.label}</span>
          ))}
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink/80">
          {result.explanation.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Metric label="Total price" value={formatPrice(result.total_cost)} hint={`${formatPrice(result.budget_remaining)} left of ${formatPrice(request.max_budget)}`} />
        <Metric label="Fitness score" value={result.fitness_score} hint="out of 100" />
        <Metric label="Preference score" value={result.preference_score} />
        <Metric label="Togetherness" value={result.group_togetherness} />
        <Metric label="Distance penalty" value={result.distance_penalty} hint={`gap penalty ${result.gap_penalty}`} />
        <Metric label="Algorithm" value={ALGORITHM_LABELS[result.algorithm]} hint="best fitness" />
        <Metric label="Execution time" value={formatMs(result.execution_time_ms)} hint="whole pipeline" />
      </div>

      <SeatMap theatre={data.theatre} seats={data.seats} recommendedIds={ids} />
      <div className="mt-3"><SeatLegend /></div>
    </>
  );
}
