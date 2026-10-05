import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from tests.helpers import make_theatre  # noqa: E402

client = TestClient(app)


def payload(seats, **over):
    body = {"theatre_id": 1, "theatre_rows": 12, "theatre_columns": 18, "people_count": 4, "max_budget": 1500,
            "preferred_region": "center", "togetherness_weight": 0.9, "preference_weight": 0.8, "seed": 1,
            "seats": [{"id": s.id, "label": s.label, "row": s.row, "column": s.column, "x": s.x, "y": s.y,
                       "price": s.price, "seat_type": s.seat_type, "status": "available"} for s in seats]}
    body.update(over)
    return body


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_optimize_ok():
    res = client.post("/optimize", json=payload(make_theatre()))
    assert res.status_code == 200
    data = res.json()
    assert len(data["recommended_seats"]) == 4 and data["total_cost"] <= 1500


def test_booked_seats_in_payload_are_ignored():
    seats = make_theatre(rows=2, cols=4)
    body = payload(seats, people_count=2, max_budget=1000, theatre_rows=2, theatre_columns=4)
    for s in body["seats"][:6]:
        s["status"] = "booked"
    res = client.post("/optimize", json=body)
    assert res.status_code == 200
    booked = {s["id"] for s in body["seats"][:6]}
    assert not booked & {s["id"] for s in res.json()["recommended_seats"]}


def test_infeasible_and_invalid_requests():
    assert client.post("/optimize", json=payload(make_theatre(), max_budget=100)).status_code == 422
    assert client.post("/optimize", json=payload(make_theatre(), people_count=0)).status_code == 422
    assert client.post("/optimize", json=payload([])).status_code == 422
