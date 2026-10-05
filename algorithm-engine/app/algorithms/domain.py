from dataclasses import dataclass


class OptimizationError(Exception):
    """Raised for requests that cannot be satisfied (bad input, no feasible seating)."""

    def __init__(self, message: str, status: int = 422):
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass(frozen=True)
class SeatData:
    id: int
    label: str
    row: int
    column: int
    x: float
    y: float
    price: float
    seat_type: str = "standard"

    def as_dict(self) -> dict:
        return {"id": self.id, "label": self.label, "row": self.row, "column": self.column,
                "price": self.price, "seat_type": self.seat_type}
