"""Proximity algorithms for group seating.

closest_pair(): classic divide-and-conquer closest pair of points, O(n log n).
    Points are split by x, each half is solved recursively, and the strip around
    the dividing line is scanned in y order (each point is compared with at most
    7 successors).  Used to locate the densest pair of available seats.

group_metrics(): proximity metrics of one candidate group (O(k^2) for k seats):
    pairwise distances, maximum / average internal distance, gap penalty and a
    0-100 togetherness score.

consecutive_windows(): enumerates every group of k physically adjacent seats in
    a row (O(n) after grouping by row).
"""
import math
from collections import defaultdict
from itertools import combinations
from typing import Any, Dict, List, Optional, Sequence, Tuple

ROW_CHANGE_GAP = 2.0  # sitting in another row counts like two empty seats between people


def _dist(a, b) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def closest_pair(entries: Sequence[Tuple[float, float, Any]]):
    """Return (distance, entry_a, entry_b) for the closest pair or None if < 2 points."""
    if len(entries) < 2:
        return None
    px = [(e[0], e[1], e[2], r) for r, e in enumerate(sorted(entries, key=lambda e: (e[0], e[1])))]
    py = sorted(px, key=lambda e: (e[1], e[0]))

    def brute(points):
        best = (math.inf, None, None)
        for a, b in combinations(points, 2):
            d = _dist(a, b)
            if d < best[0]:
                best = (d, a, b)
        return best

    def rec(sx, sy):
        n = len(sx)
        if n <= 3:
            return brute(sx)
        mid = n // 2
        split_rank = sx[mid][3]
        split_x = sx[mid][0]
        ly = [p for p in sy if p[3] < split_rank]
        ry = [p for p in sy if p[3] >= split_rank]
        best = min(rec(sx[:mid], ly), rec(sx[mid:], ry), key=lambda t: t[0])
        strip = [p for p in sy if abs(p[0] - split_x) < best[0]]
        for i, p in enumerate(strip):
            for q in strip[i + 1:i + 8]:
                if q[1] - p[1] >= best[0]:
                    break
                d = _dist(p, q)
                if d < best[0]:
                    best = (d, p, q)
        return best

    d, a, b = rec(px, py)
    return d, (a[0], a[1], a[2]), (b[0], b[1], b[2])


def group_metrics(seats: Sequence[Any]) -> Dict[str, float]:
    """Proximity metrics of a group of seats (objects with row, column, x, y)."""
    k = len(seats)
    if k <= 1:
        return {"pairwise_count": 0, "max_distance": 0.0, "avg_distance": 0.0, "ideal_avg_distance": 0.0,
                "excess_avg": 0.0, "excess_max": 0.0, "gap_penalty": 0.0, "togetherness": 100.0}
    distances = [math.hypot(a.x - b.x, a.y - b.y) for a, b in combinations(seats, 2)]
    max_d = max(distances)
    avg_d = sum(distances) / len(distances)
    ideal_avg = (k + 1) / 3.0      # mean pairwise distance of k seats side by side
    ideal_max = float(k - 1)
    excess_avg = max(0.0, avg_d - ideal_avg)
    excess_max = max(0.0, max_d - ideal_max)

    by_row: Dict[int, List[float]] = defaultdict(list)
    for s in seats:
        by_row[s.row].append(s.x)
    holes = 0.0
    for xs in by_row.values():
        xs.sort()
        holes += sum(max(0.0, b - a - 1.0) for a, b in zip(xs, xs[1:]))
    gap_penalty = holes + ROW_CHANGE_GAP * (len(by_row) - 1)

    togetherness = 100.0 * math.exp(-(0.35 * excess_avg + 0.15 * excess_max + 0.25 * gap_penalty))
    return {"pairwise_count": len(distances), "max_distance": max_d, "avg_distance": avg_d,
            "ideal_avg_distance": ideal_avg, "excess_avg": excess_avg, "excess_max": excess_max,
            "gap_penalty": gap_penalty, "togetherness": togetherness}


def consecutive_windows(seats: Sequence[Any], k: int) -> List[List[Any]]:
    """All groups of k seats that sit directly next to each other in the same row."""
    rows: Dict[int, List[Any]] = defaultdict(list)
    for s in seats:
        rows[s.row].append(s)
    windows: List[List[Any]] = []
    for row in sorted(rows):
        ordered = sorted(rows[row], key=lambda s: s.x)
        run: List[Any] = []
        for s in ordered:
            if run and abs(s.x - run[-1].x - 1.0) > 1e-9:
                run = []
            run.append(s)
            if len(run) >= k:
                windows.append(run[-k:])
    return windows
