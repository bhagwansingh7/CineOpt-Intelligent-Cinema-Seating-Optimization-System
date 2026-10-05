import random

from app.algorithms.domain import SeatData


def make_theatre(rows=12, cols=18, booked_ratio=0.0, seed=1, prices=(200, 300, 450)):
    """Rows x cols theatre; returns the *available* seats only."""
    rng = random.Random(seed)
    seats, sid = [], 0
    for row in range(1, rows + 1):
        for col in range(1, cols + 1):
            sid += 1
            if rng.random() < booked_ratio:
                continue
            band = min(len(prices) - 1, (row - 1) * len(prices) // rows)
            seats.append(SeatData(sid, f"{chr(64 + row)}{col}", row, col, float(col), float(row), float(prices[band])))
    return seats
