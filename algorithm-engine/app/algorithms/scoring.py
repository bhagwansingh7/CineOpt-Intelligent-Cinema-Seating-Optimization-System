"""Shared objective function used by greedy, knapsack evaluation and the genetic algorithm.

fitness = (w_pref * preference + w_tog * togetherness + w_budget * budget_satisfaction)
          / (w_pref + w_tog + w_budget)
          - distance_penalty - gap_penalty                         (clamped to 0..100)

w_pref and w_tog come from the booking request, w_budget is a small constant.
Both penalties are scaled by the togetherness weight: a user who does not care
about sitting together is not punished for being spread out.
"""
import math
from dataclasses import dataclass
from typing import Dict, Sequence

from .closest_pair import group_metrics

BUDGET_WEIGHT = 0.2
DISTANCE_PENALTY_PER_UNIT = 2.0
GAP_PENALTY_PER_UNIT = 3.0
MAX_PENALTY = 40.0


@dataclass
class Evaluation:
    fitness: float
    preference_score: float
    togetherness: float
    distance_penalty: float
    gap_penalty: float
    budget_satisfaction: float
    cost: float
    avg_distance: float
    max_distance: float
    feasible: bool

    def as_dict(self) -> Dict[str, float]:
        return {k: (round(v, 3) if isinstance(v, float) else v) for k, v in self.__dict__.items()}


class Scorer:
    def __init__(self, region: dict, rows: int, cols: int, budget: float,
                 preference_weight: float, togetherness_weight: float):
        self.region = region
        self.budget = budget
        self.w_pref = preference_weight
        self.w_tog = togetherness_weight
        self.diag = max(1.0, math.hypot(cols - 1, rows - 1))
        self._pref_cache: Dict[int, float] = {}

    def in_region(self, seat) -> bool:
        r = self.region
        return r["x_min"] <= seat.x <= r["x_max"] and r["y_min"] <= seat.y <= r["y_max"]

    def preference(self, seat) -> float:
        """0-100: closeness to the preferred position (70) plus being inside the region (30)."""
        cached = self._pref_cache.get(seat.id)
        if cached is not None:
            return cached
        d = math.hypot(seat.x - self.region["target_x"], seat.y - self.region["target_y"])
        value = 70.0 * math.exp(-d / (0.25 * self.diag)) + (30.0 if self.in_region(seat) else 0.0)
        self._pref_cache[seat.id] = value
        return value

    def evaluate(self, seats: Sequence) -> Evaluation:
        cost = sum(s.price for s in seats)
        feasible = bool(seats) and cost <= self.budget + 1e-9
        pref = sum(self.preference(s) for s in seats) / max(1, len(seats))
        m = group_metrics(seats)
        budget_sat = max(0.0, 100.0 * (1.0 - 0.5 * cost / self.budget)) if self.budget > 0 else 0.0
        total_w = self.w_pref + self.w_tog + BUDGET_WEIGHT
        base = (self.w_pref * pref + self.w_tog * m["togetherness"] + BUDGET_WEIGHT * budget_sat) / total_w
        dist_pen = min(MAX_PENALTY, self.w_tog * DISTANCE_PENALTY_PER_UNIT * m["excess_avg"])
        gap_pen = min(MAX_PENALTY, self.w_tog * GAP_PENALTY_PER_UNIT * m["gap_penalty"])
        fitness = max(0.0, min(100.0, base - dist_pen - gap_pen)) if feasible else 0.0
        return Evaluation(fitness, pref, m["togetherness"], dist_pen, gap_pen, budget_sat, cost,
                          m["avg_distance"], m["max_distance"], feasible)
