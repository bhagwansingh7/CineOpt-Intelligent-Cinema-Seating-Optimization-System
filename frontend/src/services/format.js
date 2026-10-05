const CURRENCY = import.meta.env.VITE_CURRENCY || '$';

export const formatPrice = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${CURRENCY}${Number.isInteger(n) ? n : n.toFixed(2)}`;
};

export const formatDate = (value) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const formatMs = (ms) => (ms >= 100 ? `${Math.round(ms)} ms` : `${Number(ms).toFixed(ms < 10 ? 2 : 1)} ms`);

export const ALGORITHM_LABELS = { greedy: 'Greedy', knapsack: 'Knapsack', genetic: 'Genetic algorithm', manual: 'Manual selection' };
export const ALGORITHM_COLORS = { greedy: '#7C7889', knapsack: '#C58A1B', genetic: '#7C2142' };
