const { validateOptimize, validateBookingCreate, parseId } = require('../src/utils/validators');
const { parseDurationMs } = require('../src/utils/duration');

describe('validators', () => {
  const base = { theatre_id: 1, people_count: 4, max_budget: 1500, preferred_region: 'center', togetherness_weight: 0.9, preference_weight: 0.8 };

  test('validateOptimize normalises valid input and applies defaults', () => {
    expect(validateOptimize({ ...base, max_budget: '1500', people_count: '4' })).toEqual(base);
    expect(validateOptimize({ theatre_id: 1, people_count: 1, max_budget: 100 })).toMatchObject({
      preferred_region: 'anywhere', togetherness_weight: 0.5, preference_weight: 0.5,
    });
  });

  test('validateOptimize edge cases', () => {
    expect(() => validateOptimize(null)).toThrow(/JSON object/);
    expect(() => validateOptimize({ ...base, max_budget: Infinity })).toThrow(/max_budget/);
    expect(() => validateOptimize({ ...base, preferred_region: 'FRONT' })).toThrow(/preferred_region/);
  });

  test('validateBookingCreate sorts ids and ignores client supplied prices', () => {
    const out = validateBookingCreate({ theatre_id: 1, seat_ids: [5, 3], total_price: 1 });
    expect(out).toEqual({ theatre_id: 1, seat_ids: [3, 5], algorithm_used: 'manual', fitness_score: null, max_budget: null });
    expect(out.total_price).toBeUndefined();
  });

  test('parseId and parseDurationMs', () => {
    expect(parseId('7')).toBe(7);
    expect(() => parseId('0')).toThrow();
    expect(parseDurationMs('7d')).toBe(7 * 86400000);
    expect(parseDurationMs('15m')).toBe(900000);
    expect(parseDurationMs('3600')).toBe(3600000);
    expect(parseDurationMs('nonsense')).toBe(7 * 86400000);
  });
});
