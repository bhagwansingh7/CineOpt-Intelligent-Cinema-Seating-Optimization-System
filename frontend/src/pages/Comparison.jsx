import { Link, Navigate, useParams } from 'react-router-dom';
import { BarChart, FitnessLineChart } from '../components/Charts.jsx';
import { PageHeader } from '../components/ui.jsx';
import { useBookingFlow } from '../context/BookingFlowContext.jsx';
import { ALGORITHM_LABELS, formatMs, formatPrice } from '../services/format.js';

const ORDER = ['greedy', 'knapsack', 'genetic'];

export default function Comparison() {
  const { id } = useParams();
  const { flow } = useBookingFlow();
  if (!flow || String(flow.theatreId) !== String(id)) return <Navigate to={`/theatres/${id}`} replace />;
  const { result } = flow;
  const alts = result.alternatives;
  const feasible = ORDER.filter((k) => alts[k]?.feasible);
  const chart = (field) => feasible.map((key) => ({ key, value: alts[key][field] }));
  const d = result.diagnostics;

  return (
    <>
      <PageHeader title="Algorithm comparison">
        <Link to={`/theatres/${id}/recommendation`} className="btn-secondary">Back to recommendation</Link>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        {ORDER.map((key) => {
          const a = alts[key];
          const winner = result.algorithm === key;
          return (
            <section key={key} className={`card p-5 ${winner ? 'ring-2 ring-velvet' : ''}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{ALGORITHM_LABELS[key]}</h2>
                {winner && <span className="chip">Recommended</span>}
              </div>
              {a.feasible ? (
                <>
                  <p className="mt-2 font-display text-3xl font-bold">{a.fitness}</p>
                  <p className="text-xs text-ink/50">fitness</p>
                  <p className="mt-3 text-sm font-semibold">{a.seats.join(' ')}</p>
                </>
              ) : <p className="mt-3 text-sm text-ink/60">No valid arrangement found within the budget.</p>}
            </section>
          );
        })}
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-line bg-paper text-xs text-ink/60">
            <tr>{['Algorithm', 'Fitness', 'Cost', 'Time', 'Preference', 'Togetherness', 'Seats'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {ORDER.map((key) => {
              const a = alts[key];
              return (
                <tr key={key} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold">{ALGORITHM_LABELS[key]}</td>
                  {a.feasible ? (
                    <>
                      <td className="px-4 py-3">{a.fitness}</td><td className="px-4 py-3">{formatPrice(a.cost)}</td>
                      <td className="px-4 py-3">{formatMs(a.execution_time_ms)}</td><td className="px-4 py-3">{a.preference_score}</td>
                      <td className="px-4 py-3">{a.group_togetherness}</td><td className="px-4 py-3">{a.seats.join(' ')}</td>
                    </>
                  ) : <td colSpan={6} className="px-4 py-3 text-ink/60">Not feasible</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <BarChart title="Fitness score" items={chart('fitness')} format={(v) => v} />
        <BarChart title="Total cost" items={chart('cost')} format={formatPrice} />
        <BarChart title="Execution time" unit="ms" items={chart('execution_time_ms')} format={(v) => Number(v).toFixed(1)} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <FitnessLineChart history={alts.genetic?.fitness_history} />
        <section className="card p-5 text-sm">
          <h2 className="text-base font-bold">How the pipeline searched</h2>
          <ul className="mt-3 space-y-2 text-ink/80">
            <li><b>Median of Medians:</b> centre of free seats at column {d.median.median_x}, row {d.median.median_y}.</li>
            <li><b>Range search:</b> {d.region.seats_found} free seats in the {d.region.name} region, {d.region.nodes_visited} of {d.kd_tree.nodes} tree nodes visited.</li>
            <li><b>KD-tree:</b> nearest seat to the preferred position is {d.kd_tree.nearest_seat}; candidate pool of {d.kd_tree.candidate_pool_size} seats.</li>
            <li><b>Closest pair:</b> {d.closest_pair ? `${d.closest_pair.seats.join(' and ')} (distance ${d.closest_pair.distance})` : 'not applicable'}; {d.candidate_groups.within_budget} adjacent groups fit the budget.</li>
            {d.knapsack && <li><b>Knapsack:</b> {d.knapsack.candidates} candidates, {d.knapsack.budget_cells} budget cells of {formatPrice(d.knapsack.cost_unit)}.</li>}
            <li><b>Genetic algorithm:</b> {d.genetic.generations} generations, {d.genetic.evaluations} fitness evaluations, stopped on {d.genetic.termination_reason.replace('_', ' ')}.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
