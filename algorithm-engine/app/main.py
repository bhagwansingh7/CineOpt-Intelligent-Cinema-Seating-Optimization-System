from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .algorithms.domain import OptimizationError
from .algorithms.optimizer import optimize
from .models.schemas import OptimizeRequest

app = FastAPI(title="CineOpt Algorithm Engine", version="1.0.0")


@app.exception_handler(OptimizationError)
async def optimization_error_handler(_request, exc: OptimizationError):
    return JSONResponse(status_code=exc.status, content={"detail": exc.message})


@app.get("/health")
def health():
    return {"status": "ok", "service": "algorithm-engine"}


@app.post("/optimize")
def optimize_endpoint(req: OptimizeRequest):
    # Booked seats are never candidates, even if the caller sends them by mistake.
    candidates = [s.to_domain() for s in req.seats if s.status == "available"]
    return optimize(
        candidates,
        people_count=req.people_count,
        max_budget=req.max_budget,
        preferred_region=req.preferred_region,
        togetherness_weight=req.togetherness_weight,
        preference_weight=req.preference_weight,
        theatre_rows=req.theatre_rows,
        theatre_columns=req.theatre_columns,
        seed=req.seed,
    )
