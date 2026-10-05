import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import SeatMap, { SeatLegend } from '../components/SeatMap.jsx';
import OptimizationForm from '../components/OptimizationForm.jsx';
import { ErrorState, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useBookingFlow } from '../context/BookingFlowContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useFetch from '../hooks/useFetch.js';
import { bookingApi, errorMessage, theatreApi } from '../services/api.js';
import { formatPrice } from '../services/format.js';

export default function TheatrePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { flow, setFlow } = useBookingFlow();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => theatreApi.seats(id), [id]);
  const [selected, setSelected] = useState(new Set());
  const [optimizing, setOptimizing] = useState(false);
  const [booking, setBooking] = useState(false);

  const recommended = useMemo(
    () => new Set(flow && String(flow.theatreId) === String(id) ? flow.result.recommended_seats.map((s) => s.id) : []),
    [flow, id],
  );

  if (loading) return <Spinner label="Loading seat map..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const { theatre, seats, summary } = data;
  const selectedSeats = seats.filter((s) => selected.has(s.id));
  const selectedTotal = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  const onSeatClick = (seat) => {
    if (seat.status === 'booked') return toast.info(`Seat ${seat.seat_label} is already booked.`);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.id)) next.delete(seat.id); else next.add(seat.id);
      return next;
    });
    return undefined;
  };

  const onOptimize = async (request) => {
    if (!user) {
      toast.info('Log in to get seat recommendations.');
      return navigate('/login', { state: { from: `/theatres/${id}` } });
    }
    setOptimizing(true);
    try {
      const out = await bookingApi.optimize({ theatre_id: theatre.id, ...request });
      setFlow({ theatreId: theatre.id, request: out.request, result: out.result });
      navigate(`/theatres/${theatre.id}/recommendation`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setOptimizing(false);
    }
    return undefined;
  };

  const bookSelected = async () => {
    if (!user) return navigate('/login', { state: { from: `/theatres/${id}` } });
    setBooking(true);
    try {
      await bookingApi.create({ theatre_id: theatre.id, seat_ids: [...selected], algorithm_used: 'manual' });
      toast.success('Booking confirmed');
      setSelected(new Set());
      navigate('/bookings');
    } catch (err) {
      toast.error(errorMessage(err));
      reload();
      setSelected(new Set());
    } finally {
      setBooking(false);
    }
    return undefined;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section>
        <div className="mb-4">
          <h1 className="text-3xl font-bold">{theatre.name}</h1>
          <p className="mt-1 text-sm text-ink/70">
            {theatre.rows} rows x {theatre.columns} seats - {summary.available} free, {summary.booked} booked
          </p>
        </div>
        <SeatMap theatre={theatre} seats={seats} selectedIds={selected} recommendedIds={recommended} onSeatClick={onSeatClick} />
        <div className="mt-3"><SeatLegend /></div>
        {selectedSeats.length > 0 && (
          <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="text-sm font-semibold">{selectedSeats.map((s) => s.seat_label).join(', ')}</div>
              <div className="text-sm text-ink/70">Estimated total {formatPrice(selectedTotal)} (final price is calculated by the server)</div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setSelected(new Set())}>Clear</button>
              <button type="button" className="btn-primary" disabled={booking} onClick={bookSelected}>{booking ? 'Booking...' : 'Book selected seats'}</button>
            </div>
          </div>
        )}
        {recommended.size > 0 && (
          <p className="mt-3 text-sm text-ink/70">Your last recommendation is highlighted in green. <Link className="font-semibold text-velvet" to={`/theatres/${theatre.id}/recommendation`}>View it</Link></p>
        )}
      </section>
      <aside><OptimizationForm onSubmit={onOptimize} loading={optimizing} defaults={flow?.request} /></aside>
    </div>
  );
}
