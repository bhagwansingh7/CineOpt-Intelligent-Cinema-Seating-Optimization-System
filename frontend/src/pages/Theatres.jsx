import { Link } from 'react-router-dom';
import { theatreApi } from '../services/api.js';
import { formatPrice } from '../services/format.js';
import useFetch from '../hooks/useFetch.js';
import { EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui.jsx';

export default function Theatres() {
  const { data, loading, error, reload } = useFetch(() => theatreApi.list(), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data.theatres.length) return <EmptyState title="No theatres yet" text="An administrator needs to add a theatre first." />;
  return (
    <>
      <PageHeader title="Choose a theatre" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.theatres.map((t) => (
          <Link key={t.id} to={`/theatres/${t.id}`} className="card block p-5 transition-shadow hover:shadow-md">
            <h2 className="text-lg font-bold">{t.name}</h2>
            <p className="mt-1 text-sm text-ink/70">{t.rows} rows x {t.columns} seats</p>
            <p className="mt-3 text-sm"><span className="font-semibold">{t.available_seats}</span> of {t.total_seats} seats free</p>
            {t.min_price !== null && <p className="text-sm text-ink/70">Prices {formatPrice(t.min_price)} to {formatPrice(t.max_price)}</p>}
          </Link>
        ))}
      </div>
    </>
  );
}
