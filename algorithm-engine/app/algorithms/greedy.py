"""Greedy approximation used as the fast baseline.

For each of the best-scoring anchor seats a group is grown one seat at a time:
the next seat is the one with the best marginal score
    w_pref * preference(seat) + w_tog * closeness_to_group(seat)
among seats that still leave enough budget for the remaining people (checked
against the cheapest unused seats).  The best group over all anchors wins.

Time O(A * k * P * k) for A anchors, pool size P and group size k - roughly linear in P.
No optimality guarantee: seats are never swapped once chosen.
"""
import math
import time
from typing import List, Optional, Sequence

MAX_ANCHORS = 15
ROW_FACTOR = 2.5  # moving to another row counts like moving several seats sideways


def _mean_distance(seat, group) -> float:
    return sum(math.hypot(seat.x - g.x, ROW_FACTOR * (seat.y - g.y)) for g in group) / len(group)


def _cheapest_sum(by_price: Sequence, excluded_ids: set, count: int) -> Optional[float]:
    """Cost of the `count` cheapest seats not in excluded_ids (None if there are not enough)."""
    if count <= 0:
        return 0.0
    total, taken = 0.0, 0
    for s in by_price:
        if s.id in excluded_ids:
            continue
        total += s.price
        taken += 1
        if taken == count:
            return total
    return None


def _grow(anchor, pool, by_price, scorer, k, budget) -> Optional[List]:
    group = [anchor]
    used = {anchor.id}
    if k > 1 and (_cheapest_sum(by_price, used, k - 1) is None
                  or anchor.price + _cheapest_sum(by_price, used, k - 1) > budget + 1e-9):
        return None
    spent = anchor.price
    while len(group) < k:
        remaining_after = k - len(group) - 1
        best, best_score = None, -math.inf
        for c in pool:
            if c.id in used:
                continue
            reserve = _cheapest_sum(by_price, used | {c.id}, remaining_after)
            if reserve is None or spent + c.price + reserve > budget + 1e-9:
                continue
            closeness = 100.0 * math.exp(-0.6 * (_mean_distance(c, group) - 1.0))
            score = scorer.w_pref * scorer.preference(c) + scorer.w_tog * closeness
            if score > best_score:
                best, best_score = c, score
        if best is None:
            return None
        group.append(best)
        used.add(best.id)
        spent += best.price
    return group


def greedy_select(pool: Sequence, scorer, k: int, budget: float) -> Optional[dict]:
    started = time.perf_counter()
    if k <= 0 or k > len(pool):
        return None
    by_price = sorted(pool, key=lambda s: (s.price, s.id))
    anchors = sorted(pool, key=lambda s: (-scorer.preference(s), s.id))[:MAX_ANCHORS]
    best_group, best_eval = None, None
    for anchor in anchors:
        group = _grow(anchor, pool, by_price, scorer, k, budget)
        if group is None:
            continue
        ev = scorer.evaluate(group)
        if ev.feasible and (best_eval is None or ev.fitness > best_eval.fitness):
            best_group, best_eval = group, ev
    if best_group is None:
        return None
    return {"selected": best_group, "evaluation": best_eval,
            "execution_time_ms": (time.perf_counter() - started) * 1000.0}
