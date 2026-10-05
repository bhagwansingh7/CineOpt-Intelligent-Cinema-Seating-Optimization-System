import math
import random

from app.algorithms.closest_pair import closest_pair, consecutive_windows, group_metrics
from app.algorithms.kd_tree import KDTree
from app.algorithms.range_search import range_search, region_geometry
from tests.helpers import make_theatre


def _points(n, seed=3):
    rng = random.Random(seed)
    return [(rng.uniform(0, 50), rng.uniform(0, 50), i) for i in range(n)]


def test_kd_nearest_matches_brute_force():
    pts = _points(300)
    tree = KDTree.build(pts)
    rng = random.Random(11)
    for _ in range(50):
        qx, qy = rng.uniform(-5, 55), rng.uniform(-5, 55)
        node, dist, visited = tree.nearest(qx, qy)
        expected = min(math.hypot(x - qx, y - qy) for x, y, _ in pts)
        assert abs(dist - expected) < 1e-9
        assert visited < len(pts)


def test_kd_k_nearest_sorted_and_correct():
    pts = _points(200)
    tree = KDTree.build(pts)
    result = tree.k_nearest(25, 25, 7)
    brute = sorted(math.hypot(x - 25, y - 25) for x, y, _ in pts)[:7]
    assert [round(d, 9) for d, _ in result] == [round(d, 9) for d in brute]


def test_kd_tree_is_balanced_with_duplicate_coordinates():
    seats = make_theatre(rows=20, cols=20)
    tree = KDTree.build([(s.x, s.y, s) for s in seats])
    assert tree.size == 400
    assert tree.height() <= math.ceil(math.log2(401)) + 1


def test_kd_empty_and_insert():
    tree = KDTree.build([])
    assert tree.nearest(1, 1)[0] is None
    assert tree.k_nearest(1, 1, 3) == []
    tree.insert(2, 2, "a")
    tree.insert(5, 5, "b")
    assert tree.nearest(4, 4)[0].item == "b"


def test_range_search_matches_filter_and_prunes():
    seats = make_theatre(rows=30, cols=30)
    tree = KDTree.build([(s.x, s.y, s) for s in seats])
    found, visited = range_search(tree, 5, 10, 8, 12)
    expected = {s.id for s in seats if 5 <= s.x <= 10 and 8 <= s.y <= 12}
    assert {s.id for s in found} == expected
    assert visited < len(seats) / 2


def test_region_geometry_covers_expected_seats():
    seats = make_theatre(rows=12, cols=18)
    tree = KDTree.build([(s.x, s.y, s) for s in seats])
    front = region_geometry("front", 12, 18)
    found, _ = range_search(tree, front["x_min"], front["x_max"], front["y_min"], front["y_max"])
    assert {s.row for s in found} == {1, 2, 3, 4}
    everything = region_geometry("anywhere", 12, 18)
    found, _ = range_search(tree, everything["x_min"], everything["x_max"], everything["y_min"], everything["y_max"])
    assert len(found) == len(seats)


def test_closest_pair_matches_brute_force():
    for seed in range(5):
        pts = _points(120, seed)
        d, a, b = closest_pair(pts)
        brute = min(math.hypot(p[0] - q[0], p[1] - q[1]) for i, p in enumerate(pts) for q in pts[i + 1:])
        assert abs(d - brute) < 1e-9
    assert closest_pair([(1, 1, "x")]) is None


def test_group_metrics_adjacent_beats_split_group():
    seats = {s.label: s for s in make_theatre(rows=5, cols=20)}
    together = group_metrics([seats[f"C{c}"] for c in (5, 6, 7, 8)])
    split = group_metrics([seats[l] for l in ("C5", "C6", "C12", "C13")])
    assert together["togetherness"] == 100.0 and together["gap_penalty"] == 0
    assert together["max_distance"] == 3
    assert split["max_distance"] > 7 and split["gap_penalty"] >= 5
    assert split["togetherness"] < 10
    assert group_metrics([seats["A1"]])["togetherness"] == 100.0


def test_consecutive_windows():
    seats = [s for s in make_theatre(rows=2, cols=6) if s.column != 3]
    windows = consecutive_windows(seats, 3)
    assert len(windows) == 2 * 1          # only columns 4-6 form a run of 3 per row
    assert all(w[-1].column == 6 for w in windows)
