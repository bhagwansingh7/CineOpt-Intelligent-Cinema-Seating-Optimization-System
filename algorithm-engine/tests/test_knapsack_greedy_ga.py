import itertools

import pytest

from app.algorithms.domain import OptimizationError, SeatData
from app.algorithms.genetic_algorithm import GAConfig, GeneticAlgorithm
from app.algorithms.greedy import greedy_select
from app.algorithms.knapsack import knapsack_select
from app.algorithms.range_search import region_geometry
from app.algorithms.scoring import Scorer
from tests.helpers import make_theatre


def scorer_for(rows=12, cols=18, budget=1500, region="center", pw=0.8, tw=0.9):
    return Scorer(region_geometry(region, rows, cols), rows, cols, budget, pw, tw)


def _valid(selected, pool_ids, k, budget):
    ids = [s.id for s in selected]
    assert len(ids) == k and len(set(ids)) == k
    assert set(ids) <= pool_ids
    assert sum(s.price for s in selected) <= budget + 1e-9


def test_knapsack_is_optimal_against_brute_force():
    seats = make_theatre(rows=3, cols=4)
    value = lambda s: (s.id * 7) % 13 + s.price / 100
    k, budget = 3, 700
    result = knapsack_select(seats, k, budget, value)
    best = max(sum(value(s) for s in combo) for combo in itertools.combinations(seats, k)
               if sum(s.price for s in combo) <= budget)
    assert abs(result["total_value"] - best) < 0.02
    assert result["total_cost"] <= budget
    assert result["budget_remaining"] == budget - result["total_cost"]


def test_knapsack_exact_budget_single_seat_and_infeasible():
    seats = [SeatData(i, f"A{i}", 1, i, float(i), 1.0, p) for i, p in enumerate([100, 200, 300], start=1)]
    exact = knapsack_select(seats, 2, 300, lambda s: s.price)
    assert exact["total_cost"] == 300 and exact["budget_remaining"] == 0
    single = knapsack_select(seats, 1, 250, lambda s: s.price)
    assert [s.price for s in single["selected"]] == [200]
    assert knapsack_select(seats, 2, 250, lambda s: s.price) is None
    assert knapsack_select(seats, 4, 1000, lambda s: s.price) is None


def test_greedy_returns_valid_adjacent_group_within_budget():
    seats = make_theatre()
    ids = {s.id for s in seats}
    result = greedy_select(seats, scorer_for(), 4, 1500)
    _valid(result["selected"], ids, 4, 1500)
    assert len({s.row for s in result["selected"]}) == 1
    assert result["execution_time_ms"] >= 0


def test_greedy_single_seat_and_budget_too_low():
    seats = make_theatre()
    assert len(greedy_select(seats, scorer_for(budget=300), 1, 300)["selected"]) == 1
    assert greedy_select(seats, scorer_for(budget=100), 1, 100) is None


def test_genetic_never_returns_invalid_arrangements():
    seats = make_theatre(booked_ratio=0.3, seed=5)
    ids = {s.id for s in seats}
    for k, budget in ((1, 250), (4, 1200), (6, 1500), (8, 2400)):
        ga = GeneticAlgorithm(seats, scorer_for(budget=budget), k, budget,
                              GAConfig(population_size=30, max_generations=25), rng_seed=3)
        result = ga.run()
        _valid(result["selected"], ids, k, budget)
        assert result["generations"] >= 1 and result["history"][0]["generation"] == 0
        assert result["evaluation"].feasible


def test_genetic_improves_or_keeps_fitness_with_elitism():
    seats = make_theatre()
    result = GeneticAlgorithm(seats, scorer_for(), 5, 1800, GAConfig(population_size=40, max_generations=40),
                              rng_seed=1).run()
    best = [h["best_fitness"] for h in result["history"]]
    assert all(b2 >= b1 - 1e-9 for b1, b2 in zip(best, best[1:]))   # elitism: never gets worse


def test_genetic_repair_enforces_all_constraints():
    seats = make_theatre()
    ga = GeneticAlgorithm(seats, scorer_for(budget=900), 3, 900, rng_seed=1)
    fixed = ga.repair([seats[0].id, seats[0].id, 999999, seats[-1].id, seats[-2].id])
    assert fixed is not None
    assert len(fixed) == 3 and len(set(fixed)) == 3
    assert sum(next(s for s in seats if s.id == g).price for g in fixed) <= 900


def test_genetic_rejects_pool_smaller_than_group():
    with pytest.raises(OptimizationError):
        GeneticAlgorithm(make_theatre(rows=1, cols=2), scorer_for(), 3, 1500)
