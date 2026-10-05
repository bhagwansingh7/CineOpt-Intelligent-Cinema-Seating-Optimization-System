import random

import pytest

from app.algorithms.median import lower_median, median, median_position, select
from tests.helpers import make_theatre


def test_select_matches_sorted_for_random_lists():
    rng = random.Random(7)
    for n in (1, 2, 5, 6, 31, 200, 1001):
        data = [rng.randint(-50, 50) for _ in range(n)]
        for k in {0, n // 2, n - 1}:
            assert select(data, k) == sorted(data)[k]


def test_select_handles_all_equal_and_does_not_mutate_input():
    data = [4] * 40
    original = list(data)
    assert select(data, 17) == 4
    assert data == original


def test_select_rejects_bad_input():
    with pytest.raises(ValueError):
        select([], 0)
    with pytest.raises(IndexError):
        select([1, 2, 3], 3)


def test_median_even_odd_and_lower_median():
    assert median([5, 1, 3]) == 3
    assert median([4, 1, 3, 2]) == 2.5
    assert lower_median([4, 1, 3, 2]) == 2
    with pytest.raises(ValueError):
        median([])


def test_median_position_of_full_theatre():
    result = median_position(make_theatre(rows=11, cols=11))
    assert result["median_x"] == 6 and result["median_y"] == 6
    assert "Median of Medians" in result["explanation"]
    with pytest.raises(ValueError):
        median_position([])
