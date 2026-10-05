import { useState } from 'react';
import SeatMap, { SeatLegend } from '../components/SeatMap.jsx';
import { ErrorState, PageHeader, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useFetch from '../hooks/useFetch.js';
import { adminApi, errorMessage } from '../services/api.js';
import { ALGORITHM_LABELS, formatDate, formatPrice } from '../services/format.js';

const TABS = [['theatres', 'Theatres'], ['seats', 'Seats'], ['bookings', 'Bookings'], ['users', 'Users']];

function Table({ head, rows }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line bg-paper text-xs text-ink/60"><tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td className="px-4 py-6 text-center text-ink/60" colSpan={head.length}>Nothing to show yet.</td></tr>}
          {rows.map((cells, i) => <tr key={i} className="border-b border-line last:border-0">{cells.map((c, j) => <td key={j} className="px-4 py-3">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function TheatresTab() {
  const { data, loading, error, reload } = useFetch(() => adminApi.theatres(), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return <Table head={['ID', 'Name', 'Layout', 'Seats', 'Available', 'Booked']}
    rows={data.theatres.map((t) => [t.id, t.name, `${t.rows} x ${t.columns}`, t.total_seats, t.available_seats, t.booked_seats])} />;
}

function SeatsTab() {
  const theatres = useFetch(() => adminApi.theatres(), []);
  const [theatreId, setTheatreId] = useState('');
  const current = theatreId || theatres.data?.theatres[0]?.id;
  const seats = useFetch(() => (current ? adminApi.seats(current) : Promise.resolve(null)), [current]);
  if (theatres.loading) return <Spinner />;
  if (theatres.error) return <ErrorState message={theatres.error} onRetry={theatres.reload} />;
  return (
    <div className="space-y-4">
      <select className="input max-w-xs" value={current || ''} onChange={(e) => setTheatreId(e.target.value)} aria-label="Theatre">
        {theatres.data.theatres.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {seats.loading && <Spinner />}
      {seats.error && <ErrorState message={seats.error} onRetry={seats.reload} />}
      {seats.data && (
        <>
          <p className="text-sm text-ink/70">{seats.data.summary.total} seats: {seats.data.summary.available} available, {seats.data.summary.booked} booked</p>
          <SeatMap theatre={seats.data.theatre} seats={seats.data.seats} />
          <SeatLegend />
        </>
      )}
    </div>
  );
}

function BookingsTab() {
  const { data, loading, error, reload } = useFetch(() => adminApi.bookings(), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return <Table head={['ID', 'User', 'Theatre', 'Seats', 'Total', 'Algorithm', 'Created']}
    rows={data.bookings.map((b) => [b.id, `${b.user_name} (${b.user_email})`, b.theatre_name, b.seats.map((s) => s.seat_label).join(' '),
      formatPrice(b.total_price), ALGORITHM_LABELS[b.algorithm_used], formatDate(b.created_at)])} />;
}

function UsersTab() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => adminApi.users(), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const change = async (u, role) => {
    try { await adminApi.setRole(u.id, role); toast.success(`${u.name} is now ${role === 'admin' ? 'an admin' : 'a regular user'}`); reload(); }
    catch (err) { toast.error(errorMessage(err)); }
  };
  return <Table head={['ID', 'Name', 'Email', 'Role', 'Bookings', 'Change role']}
    rows={data.users.map((u) => [u.id, u.name, u.email, <span className="chip" key="r">{u.role}</span>, u.booking_count,
      u.id === me.id ? <span className="text-ink/50" key="c">This is you</span>
        : <button key="c" type="button" className="btn-secondary px-3 py-1.5" onClick={() => change(u, u.role === 'admin' ? 'user' : 'admin')}>Make {u.role === 'admin' ? 'user' : 'admin'}</button>])} />;
}

export default function Admin() {
  const [tab, setTab] = useState('theatres');
  const Panel = { theatres: TheatresTab, seats: SeatsTab, bookings: BookingsTab, users: UsersTab }[tab];
  return (
    <>
      <PageHeader title="Admin dashboard" />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={tab === key ? 'btn-primary' : 'btn-secondary'}>{label}</button>
        ))}
      </div>
      <Panel />
    </>
  );
}
