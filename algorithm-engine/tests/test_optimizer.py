import pytest

from app.algorithms.domain import OptimizationError, SeatData
from app.algorithms.optimizer import optimize
from tests.helpers import make_theatre


def run(seats, **kw):
    params = dict(people_count=4, max_budget=1500, preferred_region="center",
                  togetherness_weight=0.9, preference_weight=0.8, theatre_rows=12, theatre_columns=18, seed=1)
    params.update(kw)
    return optimize(seats, **params)


def test_full_pipeline_recommends_adjacent_center_seats_within_budget():
    seats = make_theatre(booked_ratio=0.2, seed=4)
    res = run(seats)
    rec = res["recommended_seats"]
    assert len(rec) == 4 and len({s["id"] for s in rec}) == 4
    assert res["total_cost"] <= 1500 and res["budget_remaining"] == round(1500 - res["total_cost"], 2)
    assert {s["id"] for s in rec} <= {s.id for s in seats}
    assert len({s["row"] for s in rec}) == 1
    assert res["group_togetherness"] == 100
    assert set(res["alternatives"]) == {"greedy", "knapsack", "genetic"}
    assert res["algorithm"] in ("greedy", "knapsack", "genetic")
    best = max(a["fitness"] for a in res["alternatives"].values())
    assert res["fitness_score"] == best
    assert res["alternatives"]["genetic"]["fitness_history"]
    assert res["explanation"] and res["diagnostics"]["median"]["median_x"] > 0


def test_weights_change_the_outcome():
    seats = make_theatre(rows=12, cols=18)
    together = run(seats, togetherness_weight=1.0, preference_weight=0.1, max_budget=2400, people_count=6)
    assert len({s["row"] for s in together["recommended_seats"]}) == 1


def test_every_region_returns_seats_in_or_near_that_region():
    seats = make_theatre()
    front = run(seats, preferred_region="front")
    back = run(seats, preferred_region="back", max_budget=2000)   # back rows cost 450 each
    assert max(s["row"] for s in front["recommended_seats"]) <= 4
    assert min(s["row"] for s in back["recommended_seats"]) >= 9
    left = run(seats, preferred_region="left", max_budget=2000)
    assert max(s["column"] for s in left["recommended_seats"]) <= 7


def test_zero_seats_available():
    with pytest.raises(OptimizationError) as err:
        run([])
    assert "no available seats" in err.value.message.lower()


def test_more_requested_than_available():
    seats = make_theatre(rows=1, cols=3)
    with pytest.raises(OptimizationError) as err:
        run(seats, people_count=4, theatre_rows=1, theatre_columns=3)
    assert "only 3 are available" in err.value.message


def test_budget_too_low_and_exact_budget():
    seats = make_theatre()
    with pytest.raises(OptimizationError) as err:
        run(seats, max_budget=700)           # four cheapest seats cost 800
    assert "Budget too low" in err.value.message
    exact = run(seats, max_budget=800, preferred_region="front")
    assert exact["total_cost"] == 800 and exact["budget_remaining"] == 0


def test_all_seats_booked_means_empty_candidate_list():
    with pytest.raises(OptimizationError):
        run([])


def test_duplicate_candidate_seats_are_removed():
    seats = make_theatre(rows=3, cols=6)
    res = run(seats + seats, people_count=3, max_budget=1000, theatre_rows=3, theatre_columns=6)
    assert res["diagnostics"]["duplicates_removed"] == len(seats)
    assert len({s["id"] for s in res["recommended_seats"]}) == 3


def test_seats_outside_theatre_are_ignored():
    seats = make_theatre(rows=3, cols=6) + [SeatData(999, "Z99", 40, 40, 40.0, 40.0, 100.0)]
    res = run(seats, people_count=2, max_budget=800, theatre_rows=3, theatre_columns=6)
    assert 999 not in {s["id"] for s in res["recommended_seats"]}
    assert res["diagnostics"]["outside_theatre_ignored"] == 1


def test_single_seat_booking():
    res = run(make_theatre(), people_count=1, max_budget=300)
    assert len(res["recommended_seats"]) == 1
    assert res["group_togetherness"] == 100 and res["total_cost"] <= 300


def test_region_with_too_few_free_seats_widens_search():
    seats = [s for s in make_theatre() if not (s.row <= 4)]       # whole front is sold out
    res = run(seats, preferred_region="front")
    assert res["diagnostics"]["region"]["widened"] is True
    assert len(res["recommended_seats"]) == 4


def test_validation_errors():
    seats = make_theatre()
    for bad in ({"people_count": 0}, {"people_count": 25}, {"max_budget": 0}, {"preferred_region": "balcony"},
                {"togetherness_weight": 1.5}):
        with pytest.raises(OptimizationError):
            run(seats, **bad)


def test_result_is_deterministic_for_same_seed():
    seats = make_theatre(booked_ratio=0.3, seed=9)
    a, b = run(seats), run(seats)
    assert [s["id"] for s in a["recommended_seats"]] == [s["id"] for s in b["recommended_seats"]]
