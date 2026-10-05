import { useState } from 'react';

const REGIONS = [['front', 'Front'], ['center', 'Center'], ['back', 'Back'], ['left', 'Left'], ['right', 'Right'], ['anywhere', 'Anywhere']];

export default function OptimizationForm({ onSubmit, loading, defaults }) {
  const [form, setForm] = useState({
    people_count: 4, max_budget: 1500, preferred_region: 'center',
    togetherness_weight: 0.9, preference_weight: 0.8, ...defaults,
  });
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const people = Number(form.people_count);
    const budget = Number(form.max_budget);
    if (!Number.isInteger(people) || people < 1 || people > 20) return setError('Choose between 1 and 20 people.');
    if (!Number.isFinite(budget) || budget <= 0) return setError('Enter a budget greater than 0.');
    setError('');
    return onSubmit({
      people_count: people, max_budget: budget, preferred_region: form.preferred_region,
      togetherness_weight: Number(form.togetherness_weight), preference_weight: Number(form.preference_weight),
    });
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
      <h2 className="text-lg font-bold">Find the best seats</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="people">Number of people</label>
          <input id="people" className="input" type="number" min="1" max="20" value={form.people_count} onChange={set('people_count')} />
        </div>
        <div>
          <label className="label" htmlFor="budget">Maximum budget</label>
          <input id="budget" className="input" type="number" min="1" step="any" value={form.max_budget} onChange={set('max_budget')} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="region">Preferred region</label>
        <select id="region" className="input" value={form.preferred_region} onChange={set('preferred_region')}>
          {REGIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {[['togetherness_weight', 'Sitting together'], ['preference_weight', 'Location preference']].map(([key, label]) => (
        <div key={key}>
          <label className="label flex justify-between" htmlFor={key}><span>{label} matters</span><span className="font-semibold text-velvet">{Number(form[key]).toFixed(2)}</span></label>
          <input id={key} type="range" min="0" max="1" step="0.05" value={form[key]} onChange={set(key)} className="w-full accent-velvet" />
          <div className="flex justify-between text-xs text-ink/50"><span>Not at all</span><span>Very much</span></div>
        </div>
      ))}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Optimising...' : 'Find best seats'}</button>
    </form>
  );
}
