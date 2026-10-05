"""Linear-time selection using the Median of Medians algorithm (BFPRT).

Worst-case O(n): the pivot is the median of the medians of groups of five,
which guarantees that at least ~30% of the elements are discarded on every
round, so the work forms a geometric series  n + 0.7n + 0.49n + ... = O(n).

The functions work on any list of mutually comparable items (numbers or
tuples).  The input list is never sorted as a whole - only groups of at most
five elements are sorted, which costs O(1) per group.
"""
from typing import Any, Dict, List, Sequence

GROUP_SIZE = 5


def _median_of_medians_pivot(items: List[Any]) -> Any:
    medians = []
    for i in range(0, len(items), GROUP_SIZE):
        group = sorted(items[i:i + GROUP_SIZE])  # constant-size sort
        medians.append(group[len(group) // 2])
    return select(medians, len(medians) // 2)


def select(items: Sequence[Any], k: int) -> Any:
    """Return the k-th smallest element (0-indexed) in worst-case O(n)."""
    working = list(items)
    if not working:
        raise ValueError("select() requires a non-empty sequence")
    if not 0 <= k < len(working):
        raise IndexError("k out of range")

    while True:
        if len(working) <= GROUP_SIZE:
            return sorted(working)[k]
        pivot = _median_of_medians_pivot(working)
        lows = [x for x in working if x < pivot]
        highs = [x for x in working if x > pivot]
        equal_count = len(working) - len(lows) - len(highs)
        if k < len(lows):
            working = lows
        elif k < len(lows) + equal_count:
            return pivot
        else:
            k -= len(lows) + equal_count
            working = highs


def lower_median(values: Sequence[Any]) -> Any:
    """Lower median: the element of rank floor((n-1)/2). Always an element of the input."""
    return select(values, (len(values) - 1) // 2)


def median(values: Sequence[float]) -> float:
    """Statistical median (mean of the two middle values for even n)."""
    n = len(values)
    if n == 0:
        raise ValueError("median() requires a non-empty sequence")
    if n % 2 == 1:
        return float(select(values, n // 2))
    return (select(values, n // 2 - 1) + select(values, n // 2)) / 2.0


def median_position(seats) -> Dict[str, Any]:
    """Central position of the candidate seats computed with linear-time selection."""
    if not seats:
        raise ValueError("median_position() requires at least one seat")
    mx = median([s.x for s in seats])
    my = median([s.y for s in seats])
    return {
        "median_x": mx,
        "median_y": my,
        "candidate_count": len(seats),
        "explanation": (
            f"Median of Medians (linear-time selection) over {len(seats)} available seats "
            f"puts the centre of the available seating at column {mx:g}, row {my:g}."
        ),
    }
