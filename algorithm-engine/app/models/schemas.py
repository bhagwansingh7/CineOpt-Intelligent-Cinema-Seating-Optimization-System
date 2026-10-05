from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from ..algorithms.domain import SeatData


class SeatIn(BaseModel):
    id: int
    label: str
    row: int = Field(ge=1)
    column: int = Field(ge=1)
    x: float
    y: float
    price: float = Field(ge=0)
    seat_type: str = "standard"
    status: str = "available"

    def to_domain(self) -> SeatData:
        return SeatData(self.id, self.label, self.row, self.column, self.x, self.y, self.price, self.seat_type)


class OptimizeRequest(BaseModel):
    theatre_id: int
    theatre_rows: Optional[int] = Field(default=None, ge=1)
    theatre_columns: Optional[int] = Field(default=None, ge=1)
    people_count: int = Field(ge=1, le=20)
    max_budget: float = Field(gt=0)
    preferred_region: Literal["front", "center", "back", "left", "right", "anywhere"] = "anywhere"
    togetherness_weight: float = Field(default=0.5, ge=0, le=1)
    preference_weight: float = Field(default=0.5, ge=0, le=1)
    seats: List[SeatIn]
    seed: Optional[int] = None
