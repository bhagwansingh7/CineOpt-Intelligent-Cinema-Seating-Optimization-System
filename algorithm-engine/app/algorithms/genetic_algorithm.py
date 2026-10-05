"""Genetic algorithm for seat selection.

Chromosome : list of k distinct seat ids, e.g. [C5, C6, C7, C8] (candidate pool only).
Fitness    : Scorer.evaluate() - preference, togetherness, budget satisfaction,
             distance and gap penalties, weighted by the booking request.
Selection  : tournament selection.
Crossover  : set-preserving - a random slice of parent A is kept and completed
             with genes of parent B.
Mutation   : replace a gene with a seat next to another gene (local move) or,
             rarely, with any pool seat (exploration).
Repair     : every child is repaired, so individuals are ALWAYS valid:
             duplicates removed, exactly k genes, only pool seats (= available
             seats inside the theatre), total cost <= budget.
Elitism    : the best `elitism` individuals are copied unchanged.
Termination: max generations or `patience` generations without improvement.

Time O(P * G * F): population P, generations G, F = cost of one fitness
evaluation (O(k^2) because of the pairwise distances), plus O(P_pool^2 log P_pool)
once to build the neighbour lists.
"""
import math
import random
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

from .domain import OptimizationError


@dataclass
class GAConfig:
    population_size: int = 60
    max_generations: int = 80
    crossover_rate: float = 0.9
    mutation_rate: float = 0.35
    elitism: int = 2
    tournament_size: int = 3
    patience: int = 25
    neighbor_count: int = 10


class GeneticAlgorithm:
    def __init__(self, pool: Sequence, scorer, k: int, budget: float,
                 config: Optional[GAConfig] = None, seeds: Optional[Sequence[Sequence[int]]] = None,
                 rng_seed: Optional[int] = None):
        self.cfg = config or GAConfig()
        self.scorer = scorer
        self.k = k
        self.budget = budget
        self.seeds = list(seeds or [])
        self.rng = random.Random(rng_seed if rng_seed is not None else 42)
        self.by_id: Dict[int, object] = {s.id: s for s in pool}
        if k > len(self.by_id):
            raise OptimizationError("Candidate pool is smaller than the requested group size")
        self.by_price_ids = [s.id for s in sorted(pool, key=lambda s: (s.price, s.id))]
        self.by_pref_ids = [s.id for s in sorted(pool, key=lambda s: (-scorer.preference(s), s.id))]
        self.neighbors: Dict[int, List[int]] = {}
        for s in pool:
            others = sorted((o for o in pool if o.id != s.id),
                            key=lambda o: (math.hypot(o.x - s.x, o.y - s.y), o.id))
            self.neighbors[s.id] = [o.id for o in others[:max(self.cfg.neighbor_count, 2 * k)]]
        self._cache: Dict[frozenset, object] = {}
        self.evaluations = 0

    # ---------- fitness ----------
    def _evaluate(self, genes: Sequence[int]):
        key = frozenset(genes)
        ev = self._cache.get(key)
        if ev is None:
            ev = self.scorer.evaluate([self.by_id[g] for g in genes])
            self._cache[key] = ev
            self.evaluations += 1
        return ev

    def fitness(self, genes: Sequence[int]) -> float:
        return self._evaluate(genes).fitness

    # ---------- repair ----------
    def _fill_candidate(self, current: List[int], used: set) -> Optional[int]:
        if not current:
            return self.by_pref_ids[0]
        candidates = {nb for g in current for nb in self.neighbors[g][:self.cfg.neighbor_count] if nb not in used}
        if not candidates:
            return next((sid for sid in self.by_pref_ids if sid not in used), None)
        cx = sum(self.by_id[g].x for g in current) / len(current)
        cy = sum(self.by_id[g].y for g in current) / len(current)
        return min(candidates, key=lambda c: (math.hypot(self.by_id[c].x - cx, self.by_id[c].y - cy), c))

    def repair(self, genes: Sequence[int]) -> Optional[List[int]]:
        """Turn any gene list into a valid chromosome (or None if no valid one exists)."""
        out: List[int] = []
        used = set()
        for g in genes:
            if g in self.by_id and g not in used:
                out.append(g)
                used.add(g)
        while len(out) > self.k:
            worst = min(out, key=lambda g: (self.scorer.preference(self.by_id[g]), g))
            out.remove(worst)
            used.discard(worst)
        while len(out) < self.k:
            cand = self._fill_candidate(out, used)
            if cand is None:
                return None
            out.append(cand)
            used.add(cand)
        cost = sum(self.by_id[g].price for g in out)
        while cost > self.budget + 1e-9:
            replaced = False
            for g in sorted(out, key=lambda g: (-self.by_id[g].price, g)):
                price = self.by_id[g].price
                repl = next((nb for nb in self.neighbors[g] if nb not in used and self.by_id[nb].price < price), None)
                if repl is None:
                    repl = next((sid for sid in self.by_price_ids if sid not in used and self.by_id[sid].price < price), None)
                if repl is not None:
                    out[out.index(g)] = repl
                    used.discard(g)
                    used.add(repl)
                    cost += self.by_id[repl].price - price
                    replaced = True
                    break
            if not replaced:
                return None
        return out

    # ---------- population ----------
    def _random_neighbourhood(self) -> List[int]:
        weights = [self.scorer.preference(self.by_id[i]) + 1.0 for i in self.by_id]
        anchor = self.rng.choices(list(self.by_id), weights=weights, k=1)[0]
        near = self.neighbors[anchor][:max(self.k * 2, self.k)]
        picks = self.rng.sample(near, min(self.k - 1, len(near)))
        return [anchor] + picks

    def _random_weighted(self) -> List[int]:
        ids = list(self.by_id)
        weights = [self.scorer.preference(self.by_id[i]) + 1.0 for i in ids]
        chosen: List[int] = []
        while len(chosen) < self.k:
            pick = self.rng.choices(ids, weights=weights, k=1)[0]
            if pick not in chosen:
                chosen.append(pick)
        return chosen

    def _initial_population(self) -> List[List[int]]:
        pop: List[List[int]] = []
        for seed in self.seeds:
            repaired = self.repair(seed)
            if repaired:
                pop.append(repaired)
        attempts = 0
        while len(pop) < self.cfg.population_size and attempts < self.cfg.population_size * 20:
            attempts += 1
            genes = self._random_neighbourhood() if attempts % 2 else self._random_weighted()
            repaired = self.repair(genes)
            if repaired:
                pop.append(repaired)
        if not pop:
            fallback = self.repair(self.by_price_ids[:self.k])
            if fallback:
                pop.append(fallback)
        return pop

    # ---------- operators ----------
    def _tournament(self, scored) -> List[int]:
        contenders = self.rng.sample(scored, min(self.cfg.tournament_size, len(scored)))
        return max(contenders, key=lambda t: t[0])[1]

    def _crossover(self, a: List[int], b: List[int]) -> List[int]:
        if self.k == 1 or self.rng.random() > self.cfg.crossover_rate:
            return list(a)
        cut = self.rng.randint(1, self.k - 1)
        start = self.rng.randint(0, self.k - cut)
        child = a[start:start + cut]
        child += [g for g in b if g not in child]
        return child

    def _mutate(self, genes: List[int]) -> List[int]:
        genes = list(genes)
        if self.rng.random() > self.cfg.mutation_rate:
            return genes
        idx = self.rng.randrange(len(genes))
        used = set(genes)
        if self.rng.random() < 0.1:
            options = [i for i in self.by_id if i not in used]
        else:
            source = self.rng.choice(genes)
            options = [nb for nb in self.neighbors[source] if nb not in used]
        if options:
            genes[idx] = self.rng.choice(options)
        return genes

    # ---------- main loop ----------
    def run(self) -> dict:
        started = time.perf_counter()
        population = self._initial_population()
        if not population:
            raise OptimizationError("Genetic algorithm could not build a valid seating within the budget")
        history = []
        best_genes, best_fit = None, -1.0
        stagnant, generation, reason = 0, 0, "max_generations"
        while True:
            scored = sorted(((self.fitness(g), g) for g in population), key=lambda t: -t[0])
            gen_best = scored[0][0]
            history.append({"generation": generation, "best_fitness": round(gen_best, 3),
                            "mean_fitness": round(sum(f for f, _ in scored) / len(scored), 3)})
            if gen_best > best_fit + 1e-9:
                best_fit, best_genes, stagnant = gen_best, list(scored[0][1]), 0
            else:
                stagnant += 1
            if generation >= self.cfg.max_generations:
                break
            if stagnant >= self.cfg.patience:
                reason = "no_improvement"
                break
            nxt = [list(g) for _, g in scored[:self.cfg.elitism]]
            guard = 0
            while len(nxt) < self.cfg.population_size and guard < self.cfg.population_size * 20:
                guard += 1
                child = self._mutate(self._crossover(self._tournament(scored), self._tournament(scored)))
                repaired = self.repair(child)
                if repaired:
                    nxt.append(repaired)
            population = nxt
            generation += 1
        selected = [self.by_id[g] for g in best_genes]
        return {
            "selected": selected,
            "evaluation": self._evaluate(best_genes),
            "generations": generation,
            "history": history,
            "population_size": self.cfg.population_size,
            "evaluations": self.evaluations,
            "termination_reason": reason,
            "execution_time_ms": (time.perf_counter() - started) * 1000.0,
        }
