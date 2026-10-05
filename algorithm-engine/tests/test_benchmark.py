from app.services.benchmark import generate_theatre, run_benchmark


def test_generate_theatre_sizes():
    seats, rows, cols = generate_theatre(100)
    assert 0 < len(seats) < 100 and rows * cols >= 100


def test_benchmark_records_every_algorithm():
    records = run_benchmark([100], people=4, budget=1600)
    assert [r["algorithm"] for r in records] == ["greedy", "knapsack", "genetic"]
    assert all(r["fitness"] > 0 and r["execution_time_ms"] >= 0 for r in records)
