"""Benchmark Greedy vs Knapsack vs Genetic Algorithm on synthetic theatres.

    python -m app.services.benchmark                    # 100, 500, 1000, 5000, 10000 seats
    python -m app.services.benchmark --sizes 100 1000 --people 6 --repeat 3

Writes benchmarks/results.csv and benchmarks/results.md next to this project.
Every size is generated with ~30% of the seats already booked, so the number of
available seats is lower than the theatre size.
"""
import argparse
import csv
import math
import os
import random
import statistics
from typing import List

from ..algorithms.domain import SeatData
from ..algorithms.optimizer import optimize

DEFAULT_SIZES = [100, 500, 1000, 5000, 10000]
ALGORITHMS = ("greedy", "knapsack", "genetic")


def generate_theatre(total_seats: int, booked_ratio: float = 0.3, seed: int = 11):
    rng = random.Random(seed)
    rows = max(3, int(math.sqrt(total_seats / 1.5)))
    cols = math.ceil(total_seats / rows)
    seats: List[SeatData] = []
    sid = 0
    for row in range(1, rows + 1):
        for col in range(1, cols + 1):
            sid += 1
            if sid > total_seats or rng.random() < booked_ratio:
                continue
            price = (200, 300, 450)[min(2, (row - 1) * 3 // rows)]
            seats.append(SeatData(sid, f"R{row}S{col}", row, col, float(col), float(row), float(price)))
    return seats, rows, cols


def run_benchmark(sizes, people=6, budget=2400, region="center", repeat=1):
    records = []
    for size in sizes:
        seats, rows, cols = generate_theatre(size)
        runs = [optimize(seats, people, budget, region, 0.8, 0.8, rows, cols, seed=r + 1) for r in range(repeat)]
        base = runs[0]
        for name in ALGORITHMS:
            alt = [r["alternatives"][name] for r in runs]
            records.append({
                "theatre_size": size, "available_seats": len(seats), "algorithm": name,
                "execution_time_ms": round(statistics.mean(a["execution_time_ms"] for a in alt), 3),
                "fitness": round(statistics.mean(a["fitness"] for a in alt), 2),
                "cost": alt[0]["cost"], "preference_score": alt[0]["preference_score"],
                "togetherness": alt[0]["group_togetherness"],
                "pipeline_ms": round(statistics.mean(r["execution_time_ms"] for r in runs), 2),
                "kd_build_ms": base["diagnostics"]["stage_timings_ms"]["kd_tree_build"],
            })
    return records


def to_markdown(records) -> str:
    head = "| Seats (available) | Algorithm | Time ms | Fitness | Cost | Preference | Togetherness | Pipeline ms |\n"
    head += "|---|---|---|---|---|---|---|---|\n"
    rows = [f"| {r['theatre_size']} ({r['available_seats']}) | {r['algorithm']} | {r['execution_time_ms']} | "
            f"{r['fitness']} | {r['cost']} | {r['preference_score']} | {r['togetherness']} | {r['pipeline_ms']} |"
            for r in records]
    return head + "\n".join(rows) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sizes", type=int, nargs="+", default=DEFAULT_SIZES)
    parser.add_argument("--people", type=int, default=6)
    parser.add_argument("--budget", type=float, default=2400)
    parser.add_argument("--region", default="center")
    parser.add_argument("--repeat", type=int, default=1)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "..", "benchmarks"))
    args = parser.parse_args()

    records = run_benchmark(args.sizes, args.people, args.budget, args.region, args.repeat)
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "results.csv"), "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    md = to_markdown(records)
    with open(os.path.join(args.out, "results.md"), "w") as fh:
        fh.write(md)
    print(md)


if __name__ == "__main__":
    main()
