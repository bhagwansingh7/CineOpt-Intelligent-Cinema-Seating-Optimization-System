"""Orthogonal 2-D range searching on the KD-tree.

A query rectangle is matched against the splitting planes of the tree: a
subtree is only visited when the rectangle can intersect the half-plane it
covers.  For a balanced 2-D tree this costs O(sqrt(n) + k) where k is the
number of reported seats, instead of the O(n) of a full scan.

Regions (front/center/back/left/right) are expressed as rectangles built from
thirds of the theatre, so every region is a single range query.
"""
from typing import Any, Dict, List, Tuple

from .kd_tree import KDNode, KDTree

REGIONS = ("front", "center", "back", "left", "right", "anywhere")


def range_search(tree: KDTree, x_min: float, x_max: float, y_min: float, y_max: float):
    """Return (payloads inside the rectangle, number of tree nodes visited)."""
    found: List[Any] = []
    visited = [0]

    def search(node: KDNode) -> None:
        if node is None:
            return
        visited[0] += 1
        if x_min <= node.x <= x_max and y_min <= node.y <= y_max:
            found.append(node.item)
        coord = node.coord(node.axis)
        low, high = (x_min, x_max) if node.axis == 0 else (y_min, y_max)
        # left subtree holds coordinates <= split value, right subtree >= split value
        if low <= coord:
            search(node.left)
        if high >= coord:
            search(node.right)

    search(tree.root)
    return found, visited[0]


def _thirds(n: int) -> Tuple[Tuple[int, int], Tuple[int, int], Tuple[int, int]]:
    if n < 3:
        return (1, n), (1, n), (1, n)
    a, b = round(n / 3), round(2 * n / 3)
    return (1, a), (a + 1, b), (b + 1, n)


def region_geometry(region: str, rows: int, cols: int) -> Dict[str, Any]:
    """Rectangle (half-cell padded) and target point for a named region."""
    if region not in REGIONS:
        raise ValueError(f"Unknown region '{region}'")
    (f0, f1), (c0, c1), (b0, b1) = _thirds(rows)
    (l0, l1), (m0, m1), (r0, r1) = _thirds(cols)
    full_x, full_y = (1, cols), (1, rows)
    sweet_y = 1 + (rows - 1) * 0.6  # cinemas are usually best about 60% of the way back
    mid_x = (cols + 1) / 2

    table = {
        "front": (full_x, (f0, f1), (mid_x, (f0 + f1) / 2)),
        "center": ((m0, m1), (c0, c1), ((m0 + m1) / 2, (c0 + c1) / 2)),
        "back": (full_x, (b0, b1), (mid_x, (b0 + b1) / 2)),
        "left": ((l0, l1), full_y, ((l0 + l1) / 2, sweet_y)),
        "right": ((r0, r1), full_y, ((r0 + r1) / 2, sweet_y)),
        "anywhere": (full_x, full_y, (mid_x, sweet_y)),
    }
    (x0, x1), (y0, y1), target = table[region]
    return {
        "region": region,
        "x_min": x0 - 0.5, "x_max": x1 + 0.5,
        "y_min": y0 - 0.5, "y_max": y1 + 0.5,
        "target_x": target[0], "target_y": target[1],
    }
