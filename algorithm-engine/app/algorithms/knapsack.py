"""Cardinality-constrained 0/1 knapsack (dynamic programming).

weight = seat price, value = preference score, capacity = maximum budget.
A booking needs exactly k seats, so the DP state tracks how many items were
taken:  dp[j][b] = best value using exactly j seats with total weight <= b.

Prices are converted to integer units.  The unit is the GCD of all prices in
cents; if that still gives more than MAX_UNITS budget cells the unit is
enlarged and weights are rounded UP, so the real cost can never exceed the
budget (the result is then optimal for the rounded problem).

Time O(n * k * B_units), memory O(n * k * B_units) bytes for the reconstruction table.
"""
import math
import time
from functools import reduce
from typing import Callable, List, Optional, Sequence

MAX_UNITS = 1500
NEG = -1


def knapsack_select(candidates: Sequence, k: int, budget: float,
                    value_fn: Callable[[object], float]) -> Optional[dict]:
    started = time.perf_counter()
    n = len(candidates)
    if k <= 0 or k > n or budget <= 0:
        return None

    cents = [int(round(s.price * 100)) for s in candidates]
    budget_cents = int(math.floor(budget * 100 + 1e-6))
    unit = reduce(math.gcd, [c for c in cents if c > 0], 0) or 1
    cap = budget_cents // unit
    if cap > MAX_UNITS:
        unit *= math.ceil(cap / MAX_UNITS)
        cap = budget_cents // unit
    weights = [max(0, math.ceil(c / unit)) for c in cents]
    values = [int(round(value_fn(s) * 100)) for s in candidates]

    # dp[j][b]; -1 marks an unreachable state
    dp = [[NEG] * (cap + 1) for _ in range(k + 1)]
    dp[0] = [0] * (cap + 1)
    took = [[bytearray(cap + 1) for _ in range(k + 1)] for _ in range(n)]

    for i in range(n):
        w, v = weights[i], values[i]
        if w > cap:
            continue
        for j in range(min(i + 1, k), 0, -1):
            prev, cur, flag = dp[j - 1], dp[j], took[i][j]
            for b in range(cap, w - 1, -1):
                base = prev[b - w]
                if base != NEG and base + v > cur[b]:
                    cur[b] = base + v
                    flag[b] = 1

    if dp[k][cap] == NEG:
        return None

    chosen: List[int] = []
    j, b = k, cap
    for i in range(n - 1, -1, -1):
        if j > 0 and took[i][j][b]:
            chosen.append(i)
            b -= weights[i]
            j -= 1
    selected = [candidates[i] for i in reversed(chosen)]
    total_cost = sum(s.price for s in selected)
    return {
        "selected": selected,
        "total_cost": total_cost,
        "total_value": sum(values[i] for i in chosen) / 100.0,
        "budget_remaining": budget - total_cost,
        "cost_unit": unit / 100.0,
        "budget_cells": cap,
        "execution_time_ms": (time.perf_counter() - started) * 1000.0,
    }
