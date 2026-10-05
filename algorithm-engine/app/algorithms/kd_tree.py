"""2-D KD-tree implemented from scratch.

* Build: O(n log n). The splitting element at every level is found with the
  linear-time Median of Medians selection, so the tree is perfectly balanced.
  Keys are (coordinate, other coordinate, index) tuples, which are unique, so
  even rows of seats that share a y value split cleanly.
* Insert: O(h) (may unbalance the tree, rebuild if many inserts are expected).
* Nearest neighbour: O(log n) expected for well-spread points, O(n) worst case.
* k nearest neighbours: O(k log n) expected using a bounded max-heap.
"""
import heapq
import math
from dataclasses import dataclass
from typing import Any, List, Optional, Sequence, Tuple

from .median import select

Entry = Tuple[float, float, Any]  # (x, y, payload)


@dataclass
class KDNode:
    x: float
    y: float
    item: Any
    axis: int
    left: Optional["KDNode"] = None
    right: Optional["KDNode"] = None

    def coord(self, axis: int) -> float:
        return self.x if axis == 0 else self.y


def distance(ax: float, ay: float, bx: float, by: float) -> float:
    return math.hypot(ax - bx, ay - by)


class KDTree:
    def __init__(self) -> None:
        self.root: Optional[KDNode] = None
        self.size = 0

    @classmethod
    def build(cls, entries: Sequence[Entry]) -> "KDTree":
        tree = cls()
        tree.size = len(entries)
        tree.root = tree._build(list(entries), 0)
        return tree

    def _build(self, entries: List[Entry], depth: int) -> Optional[KDNode]:
        if not entries:
            return None
        axis = depth % 2
        keyed = [((e[axis], e[1 - axis], i), e) for i, e in enumerate(entries)]
        pivot_key = select([k for k, _ in keyed], len(keyed) // 2)
        left, right, pivot = [], [], None
        for key, entry in keyed:
            if key < pivot_key:
                left.append(entry)
            elif key > pivot_key:
                right.append(entry)
            else:
                pivot = entry
        node = KDNode(pivot[0], pivot[1], pivot[2], axis)
        node.left = self._build(left, depth + 1)
        node.right = self._build(right, depth + 1)
        return node

    def insert(self, x: float, y: float, item: Any) -> None:
        self.size += 1
        if self.root is None:
            self.root = KDNode(x, y, item, 0)
            return
        node = self.root
        while True:
            axis = node.axis
            value = x if axis == 0 else y
            go_left = value < node.coord(axis)
            nxt = node.left if go_left else node.right
            if nxt is None:
                child = KDNode(x, y, item, 1 - axis)
                if go_left:
                    node.left = child
                else:
                    node.right = child
                return
            node = nxt

    def height(self) -> int:
        def h(node: Optional[KDNode]) -> int:
            if node is None:
                return 0
            return 1 + max(h(node.left), h(node.right))
        return h(self.root)

    def nearest(self, qx: float, qy: float):
        """Return (node, distance, nodes_visited) or (None, inf, 0) for an empty tree."""
        best = [None, math.inf]  # node, squared distance
        visited = [0]

        def search(node: Optional[KDNode]) -> None:
            if node is None:
                return
            visited[0] += 1
            d2 = (node.x - qx) ** 2 + (node.y - qy) ** 2
            if d2 < best[1]:
                best[0], best[1] = node, d2
            diff = (qx if node.axis == 0 else qy) - node.coord(node.axis)
            near, far = (node.left, node.right) if diff < 0 else (node.right, node.left)
            search(near)
            if diff * diff < best[1]:  # splitting plane closer than best match: other side may win
                search(far)

        search(self.root)
        return best[0], math.sqrt(best[1]) if best[0] else math.inf, visited[0]

    def k_nearest(self, qx: float, qy: float, k: int):
        """Return up to k (distance, node) pairs sorted by increasing distance."""
        if k <= 0 or self.root is None:
            return []
        heap: List[Tuple[float, int, KDNode]] = []  # max-heap through negated distance
        counter = [0]

        def search(node: Optional[KDNode]) -> None:
            if node is None:
                return
            d2 = (node.x - qx) ** 2 + (node.y - qy) ** 2
            counter[0] += 1
            if len(heap) < k:
                heapq.heappush(heap, (-d2, -counter[0], node))
            elif d2 < -heap[0][0]:
                heapq.heapreplace(heap, (-d2, -counter[0], node))
            diff = (qx if node.axis == 0 else qy) - node.coord(node.axis)
            near, far = (node.left, node.right) if diff < 0 else (node.right, node.left)
            search(near)
            if len(heap) < k or diff * diff < -heap[0][0]:
                search(far)

        search(self.root)
        ordered = sorted(((-nd2, -c, n) for nd2, c, n in heap), key=lambda t: (t[0], -t[1]))
        return [(math.sqrt(d2), node) for d2, _, node in ordered]

    def stats(self) -> dict:
        return {"nodes": self.size, "height": self.height(), "balanced_build": True}
