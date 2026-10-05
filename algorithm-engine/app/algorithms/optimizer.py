"""Master optimisation pipeline.

 1. validate input, de-duplicate seats, drop seats outside the theatre
 2. median of the available seats (linear-time selection)
 3. KD-tree over the available seats
 4. range search for the preferred region (named region -> rectangle)
 5. nearest-neighbour / k-nearest search around the preferred position -> candidate pool
 6. candidate groups: windows of adjacent seats, ranked, budget-filtered
 7. closest pair of seats in the pool -> extra seed group
 8. greedy approximation (baseline)
 9. 0/1 knapsack (max preference under the budget)
10. genetic algorithm seeded with the heuristics plus random individuals
11. compare solutions with the shared fitness function
12. recommend the best one and explain why
"""
import heapq
import time
from typing import Any, Dict, List, Optional, Sequence

from .closest_pair import closest_pair, consecutive_windows
from .domain import OptimizationError, SeatData
from .genetic_algorithm import GAConfig, GeneticAlgorithm
from .greedy import greedy_select
from .kd_tree import KDTree
from .knapsack import knapsack_select
from .median import median_position
from .range_search import REGIONS, range_search, region_geometry
from .scoring import Scorer

MAX_PEOPLE = 20
TOP_WINDOWS_EVALUATED = 40
NAMES = {"greedy": "Greedy", "knapsack": "Knapsack", "genetic": "Genetic algorithm"}


def _ms(started: float) -> float:
    return (time.perf_counter() - started) * 1000.0


def _summary(ev, selected, time_ms) -> Dict[str, Any]:
    ordered = sorted(selected, key=lambda s: (s.row, s.column))
    return {
        "feasible": True,
        "fitness": round(ev.fitness, 2),
        "cost": round(ev.cost, 2),
        "execution_time_ms": round(time_ms, 3),
        "preference_score": round(ev.preference_score, 2),
        "group_togetherness": round(ev.togetherness, 2),
        "distance_penalty": round(ev.distance_penalty, 2),
        "gap_penalty": round(ev.gap_penalty, 2),
        "seats": [s.label for s in ordered],
    }


def _validate(seats, k, budget, region, tw, pw):
    if not isinstance(k, int) or isinstance(k, bool) or k < 1:
        raise OptimizationError("people_count must be a whole number of at least 1")
    if k > MAX_PEOPLE:
        raise OptimizationError(f"At most {MAX_PEOPLE} seats can be optimised at once")
    if budget is None or budget <= 0:
        raise OptimizationError("max_budget must be greater than 0")
    if region not in REGIONS:
        raise OptimizationError(f"preferred_region must be one of {', '.join(REGIONS)}")
    if not (0 <= tw <= 1 and 0 <= pw <= 1):
        raise OptimizationError("togetherness_weight and preference_weight must be between 0 and 1")


def _unique_seats(seats: Sequence[SeatData], rows: Optional[int], cols: Optional[int]):
    seen, unique, duplicates, outside = set(), [], 0, 0
    for s in seats:
        if s.id in seen:
            duplicates += 1
            continue
        seen.add(s.id)
        if (rows and s.row > rows) or (cols and s.column > cols) or s.row < 1 or s.column < 1:
            outside += 1
            continue
        unique.append(s)
    return unique, duplicates, outside


def _explain(region, geometry, widened, final, selected, budget, k, results, chosen, in_region, rv, n):
    lines = []
    if widened:
        lines.append(f"The {region} region had too few free seats, so the search was widened to the whole theatre "
                     f"around the centre of the available seats.")
    elif region == "anywhere":
        lines.append("No region was requested, so seats were ranked by closeness to the theatre's sweet spot.")
    elif in_region == k:
        lines.append(f"All seats are located in the preferred {region} region.")
    else:
        lines.append(f"{in_region} of {k} seats are in the preferred {region} region; the rest are as close to it as the budget allows.")
    ordered = sorted(selected, key=lambda s: (s.row, s.column))
    rows = {s.row for s in ordered}
    if k == 1:
        lines.append("A single seat was requested, so togetherness does not apply.")
    elif len(rows) == 1 and all(abs(b.x - a.x - 1) < 1e-9 for a, b in zip(ordered, ordered[1:])):
        lines.append(f"All requested seats are adjacent in row {ordered[0].row}.")
    elif len(rows) == 1:
        lines.append(f"All seats are in row {ordered[0].row}, with gaps of {final.gap_penalty:.1f} seat(s) between them.")
    else:
        lines.append(f"The group spans {len(rows)} rows (largest distance between two seats: {final.max_distance:.1f}).")
    lines.append(f"The total cost of {final.cost:g} is within the budget of {budget:g} ({budget - final.cost:g} left).")
    others = ", ".join(f"{NAMES[k_]} {v['fitness']}" for k_, v in results.items() if v.get("feasible") and k_ != chosen)
    lines.append(f"{NAMES[chosen]} gave the best fitness ({round(final.fitness, 2)})" + (f" versus {others}." if others else "."))
    lines.append(f"Range search visited {rv} of {n} KD-tree nodes to collect the region's seats.")
    return lines


def optimize(seats: Sequence[SeatData], people_count: int, max_budget: float,
             preferred_region: str = "anywhere", togetherness_weight: float = 0.5,
             preference_weight: float = 0.5, theatre_rows: Optional[int] = None,
             theatre_columns: Optional[int] = None, seed: Optional[int] = None,
             ga_config: Optional[GAConfig] = None) -> Dict[str, Any]:
    started = time.perf_counter()
    stages: Dict[str, float] = {}
    k = people_count
    _validate(seats, k, max_budget, preferred_region, togetherness_weight, preference_weight)

    unique, duplicates, outside = _unique_seats(seats, theatre_rows, theatre_columns)
    n = len(unique)
    if n == 0:
        raise OptimizationError("There are no available seats to choose from")
    if k > n:
        raise OptimizationError(f"{k} seats were requested but only {n} are available")
    cheapest = heapq.nsmallest(k, unique, key=lambda s: (s.price, s.id))
    min_cost = sum(s.price for s in cheapest)
    if min_cost > max_budget + 1e-9:
        raise OptimizationError(f"Budget too low: the cheapest {k} available seat(s) cost {min_cost:g}, "
                                f"but the budget is {max_budget:g}")

    rows = theatre_rows or max(s.row for s in unique)
    cols = theatre_columns or max(s.column for s in unique)

    # 2. median
    t = time.perf_counter()
    med = median_position(unique)
    stages["median"] = _ms(t)

    # 3. KD-tree
    t = time.perf_counter()
    tree = KDTree.build([(s.x, s.y, s) for s in unique])
    stages["kd_tree_build"] = _ms(t)

    # 4. range search
    t = time.perf_counter()
    geometry = region_geometry(preferred_region, rows, cols)
    region_seats, range_visited = range_search(tree, geometry["x_min"], geometry["x_max"],
                                               geometry["y_min"], geometry["y_max"])
    region_found = len(region_seats)
    widened = region_found < k
    if widened:
        geometry = dict(geometry, x_min=0.5, x_max=cols + 0.5, y_min=0.5, y_max=rows + 0.5,
                        target_x=med["median_x"], target_y=med["median_y"])
        region_seats = list(unique)
    stages["range_search"] = _ms(t)
    scorer = Scorer(geometry, rows, cols, max_budget, preference_weight, togetherness_weight)

    # 5. nearest neighbour + candidate pool
    t = time.perf_counter()
    target_x, target_y = geometry["target_x"], geometry["target_y"]
    nearest_node, nearest_dist, nearest_visited = tree.nearest(target_x, target_y)
    pool_size = min(n, max(60, 12 * k))
    pool: Dict[int, SeatData] = {}
    near_seats: List[SeatData] = []
    for _, node in tree.k_nearest(target_x, target_y, pool_size):
        pool[node.item.id] = node.item
        near_seats.append(node.item)
    for s in cheapest:  # guarantees that a within-budget group always exists in the pool
        pool.setdefault(s.id, s)
    stages["nearest_neighbour"] = _ms(t)

    # 6. candidate groups (adjacent windows) + 7. budget constraint
    t = time.perf_counter()
    windows = consecutive_windows(region_seats, k)
    windows_total = len(windows)
    windows = [w for w in windows if sum(s.price for s in w) <= max_budget + 1e-9]
    windows_in_budget = len(windows)
    windows.sort(key=lambda w: -sum(scorer.preference(s) for s in w))
    ranked = sorted(((scorer.evaluate(w).fitness, i) for i, w in enumerate(windows[:TOP_WINDOWS_EVALUATED])),
                    key=lambda t_: -t_[0])
    top_windows = [windows[i] for _, i in ranked[:5]]
    for w in top_windows:
        for s in w:
            pool.setdefault(s.id, s)
    stages["candidate_groups"] = _ms(t)

    # closest pair among the seats nearest to the preferred position -> seed group grown around it
    t = time.perf_counter()
    pair = closest_pair([(s.x, s.y, s) for s in near_seats])
    pair_seed: List[int] = []
    pair_info = None
    if pair:
        d, a, b = pair
        pair_info = {"seats": sorted([a[2].label, b[2].label]), "distance": round(d, 3)}
        mid_x, mid_y = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        pair_seed = [nd.item.id for _, nd in tree.k_nearest(mid_x, mid_y, k)]
    stages["closest_pair"] = _ms(t)

    pool_list = list(pool.values())

    # 8. greedy
    greedy = greedy_select(pool_list, scorer, k, max_budget)

    # 9. knapsack on the best-preference seats plus the cheapest ones
    knap_n = min(len(pool_list), max(40, 4 * k), 80)
    knap_pool = {s.id: s for s in sorted(pool_list, key=lambda s: (-scorer.preference(s), s.id))[:knap_n]}
    for s in cheapest:
        knap_pool.setdefault(s.id, s)
    knap_raw = knapsack_select(list(knap_pool.values()), k, max_budget, scorer.preference)
    knap = None
    if knap_raw:
        knap = {"selected": knap_raw["selected"], "evaluation": scorer.evaluate(knap_raw["selected"]),
                "execution_time_ms": knap_raw["execution_time_ms"], "raw": knap_raw}

    # 10. genetic algorithm
    seeds = [[s.id for s in w] for w in top_windows]
    if pair_seed:
        seeds.append(pair_seed)
    if greedy:
        seeds.append([s.id for s in greedy["selected"]])
    if knap:
        seeds.append([s.id for s in knap["selected"]])
    ga = GeneticAlgorithm(pool_list, scorer, k, max_budget, ga_config, seeds, rng_seed=seed).run()

    # 11. compare
    runs = {"greedy": greedy, "knapsack": knap, "genetic": ga}
    alternatives: Dict[str, Any] = {}
    for name, run in runs.items():
        if run is None or not run["evaluation"].feasible:
            alternatives[name] = {"feasible": False, "fitness": 0, "cost": 0, "execution_time_ms": 0, "seats": []}
        else:
            alternatives[name] = _summary(run["evaluation"], run["selected"], run["execution_time_ms"])
    alternatives["genetic"]["generations"] = ga["generations"]
    alternatives["genetic"]["fitness_history"] = ga["history"]

    order = ["greedy", "knapsack", "genetic"]
    feasible = [nm for nm in order if alternatives[nm]["feasible"]]
    chosen = max(feasible, key=lambda nm: (runs[nm]["evaluation"].fitness, -runs[nm]["evaluation"].cost, order.index(nm)))
    final_run = runs[chosen]
    selected = sorted(final_run["selected"], key=lambda s: (s.row, s.column))
    final = final_run["evaluation"]

    # final safety net: never return an invalid seating
    ids = [s.id for s in selected]
    valid_ids = {s.id for s in unique}
    if len(ids) != k or len(set(ids)) != k or not set(ids) <= valid_ids or final.cost > max_budget + 1e-9:
        raise OptimizationError("Internal error: optimiser produced an invalid seating", status=500)

    in_region = sum(1 for s in selected if scorer.in_region(s))
    explanation = _explain(preferred_region, geometry, widened, final, selected, max_budget, k,
                           alternatives, chosen, in_region, range_visited, tree.size)

    total_ms = _ms(started)
    return {
        "recommended_seats": [s.as_dict() for s in selected],
        "total_cost": round(final.cost, 2),
        "budget_remaining": round(max_budget - final.cost, 2),
        "fitness_score": round(final.fitness, 2),
        "preference_score": round(final.preference_score, 2),
        "group_togetherness": round(final.togetherness, 2),
        "distance_penalty": round(final.distance_penalty, 2),
        "gap_penalty": round(final.gap_penalty, 2),
        "algorithm": chosen,
        "execution_time_ms": round(total_ms, 3),
        "alternatives": alternatives,
        "explanation": explanation,
        "diagnostics": {
            "median": med,
            "region": {"name": preferred_region, "x_min": geometry["x_min"], "x_max": geometry["x_max"],
                       "y_min": geometry["y_min"], "y_max": geometry["y_max"],
                       "seats_found": region_found, "widened": widened, "nodes_visited": range_visited},
            "target": {"x": round(target_x, 3), "y": round(target_y, 3)},
            "kd_tree": {**tree.stats(), "nearest_seat": nearest_node.item.label if nearest_node else None,
                        "nearest_distance": round(nearest_dist, 3), "nearest_nodes_visited": nearest_visited,
                        "candidate_pool_size": len(pool_list)},
            "candidate_groups": {"adjacent_windows": windows_total, "within_budget": windows_in_budget,
                                 "best": [s.label for s in top_windows[0]] if top_windows else None},
            "closest_pair": pair_info,
            "knapsack": ({"total_value": knap["raw"]["total_value"], "cost_unit": knap["raw"]["cost_unit"],
                          "budget_cells": knap["raw"]["budget_cells"], "candidates": len(knap_pool)}
                         if knap else None),
            "genetic": {"generations": ga["generations"], "population_size": ga["population_size"],
                        "evaluations": ga["evaluations"], "termination_reason": ga["termination_reason"]},
            "stage_timings_ms": {k_: round(v, 3) for k_, v in stages.items()},
            "available_seats": n, "duplicates_removed": duplicates, "outside_theatre_ignored": outside,
        },
    }
