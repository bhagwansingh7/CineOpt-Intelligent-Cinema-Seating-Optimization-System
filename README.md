# CineOpt - Intelligent Cinema Seating Optimization System

CineOpt recommends the best cinema seats for a group. The user enters the number of people, a maximum budget, a preferred
region and how much sitting together matters. A Python engine searches the free seats with classic Algorithm II
techniques (median selection, KD-tree, range search, closest pair, 0/1 knapsack, greedy approximation, genetic algorithm)
and returns the best arrangement together with a comparison of the three optimisers.

## Problem statement

Given the free seats of a theatre (coordinates, price), choose exactly `k` seats such that

* total price <= budget (hard constraint),
* seats are close to the preferred region (preference score),
* the group sits together (small distances, no gaps, same row),

weighted by the importance the user gives to location and togetherness. Choosing `C5 C6 C7 C8` must beat `C5 C6 C12 C13`.

## Features

* Register / login / logout, JWT in an HTTP-only cookie, bcrypt hashing, admin role
* Interactive SVG seat map (available, booked, recommended, selected), manual seat booking
* Optimisation form -> recommendation page -> algorithm comparison (table + charts + GA convergence)
* Transactional, race-safe booking with server-side pricing and availability checks
* Booking history and an admin dashboard (theatres, seats, bookings, users, role changes)
* Benchmark utility for 100 - 10 000 seat theatres, tests for all three layers, CI pipeline

## Architecture

```
React (Vite, Tailwind, SVG)  --REST/JSON-->  Node.js + Express  --SQL-->  MySQL
                                                   |
                                                   +--HTTP-->  FastAPI algorithm engine
                                                                 |- Median of Medians (selection)
                                                                 |- KD-tree (+ nearest / k-nearest)
                                                                 |- 2-D range search
                                                                 |- Closest pair / group metrics
                                                                 |- 0/1 knapsack (DP)
                                                                 |- Greedy approximation
                                                                 '- Genetic algorithm
```

The frontend only talks to Express. Express validates, reads seats from MySQL, calls FastAPI through
`controller -> bookingService -> algorithmService -> FastAPI`, re-verifies the engine's answer against the database
(ids, count, budget) and returns it. FastAPI never touches the database.

## Technology stack

React 18, Vite, JavaScript, Tailwind CSS 3, Axios, React Router - Node 20, Express 4 (CommonJS), mysql2/promise, jsonwebtoken,
bcrypt, cookie-parser, cors, dotenv - Python 3.12, FastAPI, Uvicorn, Pydantic 2 - MySQL 8 - Docker, Docker Compose, GitHub Actions.

## Quick start (Docker)

```bash
git clone <repository> && cd CineOpt
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000/api |
| Algorithm engine (Swagger) | http://localhost:8000/docs |
| MySQL (host port) | localhost:3307 |

Demo logins (seeded): `alice@example.com` / `User@123`, `bob@example.com` / `User@123`, `admin@cineopt.com` / `Admin@123`.

The database schema and seed data are loaded automatically the first time the MySQL volume is created. To reset:
`docker compose down -v && docker compose up --build`.
The compose file contains **development-only** default passwords/secrets; copy `.env.example` to `.env` and change them for anything else.

## Local setup without Docker

1. **MySQL**: `mysql -u root -p < database/schema.sql && mysql -u root -p < database/seed.sql`, then create a user with access to `cineopt`.
2. **Algorithm engine**
   ```bash
   cd algorithm-engine
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements-dev.txt
   uvicorn app.main:app --reload --port 8000
   ```
3. **Backend**
   ```bash
   cd backend
   cp .env.example .env      # set DB_PASSWORD, JWT_SECRET
   npm install
   npm run dev
   ```
4. **Frontend**
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev               # http://localhost:5173
   ```

## Environment variables

| Variable | Used by | Meaning |
|---|---|---|
| `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | backend | server port and MySQL connection |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | backend | token signing (secret required, >= 32 chars in production); expiry like `7d` |
| `ALGORITHM_ENGINE_URL` | backend | `http://algorithm-engine:8000` in Docker |
| `FRONTEND_URL` | backend | allowed CORS origin(s), comma separated |
| `ALGORITHM_TIMEOUT_MS`, `COOKIE_SECURE` | backend | engine timeout (default 15000); set `true` behind HTTPS |
| `VITE_API_URL` | frontend | API base URL (build time) |

## Running tests and benchmarks

```bash
cd algorithm-engine && python -m pytest -q          # median, KD-tree, range, closest pair, knapsack, greedy, GA, optimizer, API
cd backend && npm install && npm test               # auth, theatres, seats, booking validation, budget, admin, engine errors
cd algorithm-engine && python -m app.services.benchmark                 # 100, 500, 1000, 5000, 10000 seats
python -m app.services.benchmark --sizes 100 1000 --people 6 --repeat 3 # custom run
```

Benchmark output is written to `algorithm-engine/benchmarks/results.csv` and `results.md`. Sample run (6 people, budget 2400, ~30% booked):

| Seats (available) | Greedy fitness / ms | Knapsack fitness / ms | Genetic fitness / ms | Whole pipeline ms |
|---|---|---|---|---|
| 100 (63) | 65.6 / 13.9 | 65.6 / 1.7 | 65.6 / 41.3 | 63 |
| 500 (353) | 68.9 / 15.0 | 54.0 / 0.6 | 90.3 / 26.9 | 52 |
| 1000 (708) | 66.9 / 10.4 | 49.2 / 0.6 | 87.4 / 27.5 | 49 |
| 5000 (3486) | 71.6 / 10.8 | 50.5 / 0.6 | 93.7 / 27.7 | 88 |
| 10000 (6962) | 72.2 / 10.5 | 45.9 / 0.5 | 94.1 / 30.5 | 150 |

Timings are machine dependent. Per-algorithm time stays flat because each optimiser works on a bounded candidate pool
(KD-tree nearest neighbours around the preferred position); what grows with theatre size is the KD-tree build and range search.

## Algorithms: what is implemented and why

| Step | Technique | Why it is used | Implementation (file) | Complexity |
|---|---|---|---|---|
| Central position | Median of Medians | Finds the median of available seat coordinates without sorting; used as fallback target when the preferred region is sold out | `median.py` | O(n) worst case |
| Spatial index | KD-tree built from scratch, split element chosen by Median of Medians, nearest and k-nearest queries | Fast "seats near the preferred position" queries | `kd_tree.py` | build O(n log n); nearest ~O(log n) average, O(n) worst; k-NN ~O(k log n) |
| Region filtering | Orthogonal range search on the KD-tree (front/center/back/left/right = rectangles over thirds of the theatre) | Collects seats of a region while pruning subtrees that cannot intersect | `range_search.py` | O(sqrt(n) + m) for m results on a balanced 2-D tree |
| Group closeness | Divide-and-conquer closest pair; pairwise distance, max/avg distance, gap penalty, togetherness score | Quantifies "sitting together"; the closest pair of seats near the target seeds a candidate group | `closest_pair.py` | closest pair O(n log n); group metrics O(k^2); adjacent windows O(n) |
| Budget optimum | 0/1 knapsack (DP) with a cardinality dimension (exactly k seats): weight = price, value = preference | Maximises preference under the budget (not "cheapest first") | `knapsack.py` | O(n * k * B), B = budget cells (capped at 1500 by coarsening the price unit, weights rounded up so the budget is never exceeded) |
| Baseline | Greedy: grow a group from the best anchors, picking the best marginal score while reserving budget for the remaining people | Fast approximation, no optimality guarantee | `greedy.py` | O(A * P * k^2) for A anchors (15), pool P, group k |
| Global search | Genetic algorithm: tournament selection, set-preserving crossover, neighbour/random mutation, repair, elitism, patience-based termination | Explores combinations greedy and knapsack miss | `genetic_algorithm.py` | O(P * G * F), F = O(k^2) per fitness evaluation, plus O(M^2 log M) once for neighbour lists (M = pool size) |

Details worth knowing (so you can defend them in a report):

* **Shared fitness** (`scoring.py`): `(w_pref*preference + w_tog*togetherness + 0.2*budget_satisfaction) / (w_pref + w_tog + 0.2) - distance_penalty - gap_penalty`,
  clamped to 0-100. `w_pref` and `w_tog` are the slider values; the two penalties are scaled by `w_tog`.
  Preference = 70% closeness to the target point of the region + 30% for being inside the region rectangle.
  Budget satisfaction rewards leaving budget unspent (100 at cost 0, 50 at cost = budget).
* **Knapsack ignores togetherness by design** (its value is the preference score), so it can scatter a group; the comparison page shows this.
* **GA is seeded** with the best adjacent windows, the closest-pair group, and the greedy and knapsack answers plus random individuals, and uses elitism,
  so its fitness is never lower than the heuristics it started from. That is a memetic design, not a claim that GA beats them from scratch.
* **Validity**: GA chromosomes live inside the candidate pool (available seats of the theatre), and every child goes through `repair()`
  (dedupe, exactly k genes, cost <= budget). The optimiser re-checks the final answer, and Express checks it again against the database.
* **Pool**: the k-nearest seats to the target (max(60, 12k)) plus the k globally cheapest seats (so a within-budget solution always exists in the pool) plus the best adjacent windows.
  The pool bounds knapsack and GA cost; it means results are optimal/approximate **within the pool**, not over all seats of a huge theatre.
* The engine is deterministic for a given `seed`.

## Database

`database/schema.sql` creates `users`, `theatres`, `seats`, `bookings`, `booking_seats`, `booking_requests` with primary and foreign keys,
indexes, `NOT NULL`, check constraints and unique keys (`users.email`, seat position and label per theatre, `booking_seats.seat_id` - a seat can be in at most one booking).
`database/seed.sql` (generated by `database/generate_seed.py`) holds 3 users (1 admin), one theatre of 12 rows x 18 seats (216 seats, 200/300/450 prices,
standard/premium/recliner), ~25% of seats booked, three demo bookings.

## API

All responses: `{ "success": true, "data": ... }` or `{ "success": false, "message": "..." }`. Cookie `token` (HTTP-only) carries the session.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | - | `{name, email, password}` (always creates role `user`) |
| POST | `/api/auth/login` | - | `{email, password}` |
| POST | `/api/auth/logout` | - | clears the cookie |
| GET | `/api/auth/me` | user | current user |
| GET | `/api/theatres` | - | theatres with seat counts and price range |
| GET | `/api/theatres/:id` | - | one theatre |
| GET | `/api/theatres/:id/seats` | - | `{theatre, seats[], summary}` with coordinates, price, type, status |
| POST | `/api/bookings/optimize` | user | run the optimiser (stores a `booking_requests` row) |
| POST | `/api/bookings` | user | `{theatre_id, seat_ids[], algorithm_used?, fitness_score?, max_budget?}` - price is computed on the server |
| GET | `/api/bookings` | user | own bookings |
| GET | `/api/bookings/:id` | user | own booking (admins: any) |
| GET | `/api/admin/users` | admin | users with booking counts |
| PATCH | `/api/admin/users/:id/role` | admin | `{role: "user"\|"admin"}` (not your own) |
| GET | `/api/admin/bookings` | admin | all bookings |
| GET | `/api/admin/theatres`, `/api/admin/theatres/:id/seats` | admin | theatres and seat maps |
| GET | `/api/health` | - | liveness + database check |

Engine API (internal): `POST /optimize`, `GET /health`.

### Example request

```json
POST /api/bookings/optimize
{ "theatre_id": 1, "people_count": 4, "max_budget": 1500, "preferred_region": "center",
  "togetherness_weight": 0.9, "preference_weight": 0.8 }
```

### Example response (abridged, real output shape)

```json
{ "success": true, "data": {
  "request": { "theatre_id": 1, "people_count": 4, "max_budget": 1500, "preferred_region": "center",
               "togetherness_weight": 0.9, "preference_weight": 0.8 },
  "result": {
    "recommended_seats": [ { "id": 92, "label": "G8", "row": 7, "column": 8, "price": 300, "seat_type": "premium" } ],
    "total_cost": 1200, "budget_remaining": 300,
    "fitness_score": 89.91, "preference_score": 86.05, "group_togetherness": 100,
    "distance_penalty": 0, "gap_penalty": 0, "algorithm": "genetic", "execution_time_ms": 33.1,
    "alternatives": {
      "greedy":   { "feasible": true, "fitness": 89.91, "cost": 1200, "execution_time_ms": 4.5,  "seats": ["G8","G9","G10","G11"] },
      "knapsack": { "feasible": true, "fitness": 67.91, "cost": 1200, "execution_time_ms": 0.5,  "seats": ["F9","F10","G9","G10"] },
      "genetic":  { "feasible": true, "fitness": 89.91, "cost": 1200, "execution_time_ms": 23.8, "seats": ["G8","G9","G10","G11"],
                    "generations": 25, "fitness_history": [ { "generation": 0, "best_fitness": 89.91, "mean_fitness": 80.2 } ] } },
    "explanation": [ "All seats are located in the preferred center region.", "All requested seats are adjacent in row 7.",
                     "The total cost of 1200 is within the budget of 1500 (300 left)." ],
    "diagnostics": { "median": {}, "region": {}, "kd_tree": {}, "candidate_groups": {}, "closest_pair": {}, "knapsack": {}, "genetic": {}, "stage_timings_ms": {} } } } }
```

(Seat ids, timings and the winning algorithm vary with the seed data and the machine.)

Typical errors: `400` invalid input, `401` not logged in, `403` not admin, `409` seats no longer available / not enough seats,
`422` budget too low, `502/503/504` algorithm engine failure, unreachable, or too slow.

## Security notes

bcrypt password hashes (never returned), HTTP-only `SameSite=Lax` cookie, JWT verified and the user re-read from the database on every request,
admin authorisation in middleware, parameterised SQL everywhere, hand-written input validation, server-side pricing, `SELECT ... FOR UPDATE` row locks inside a transaction
plus a unique key on `booking_seats.seat_id`, CORS limited to `FRONTEND_URL`, security headers, simple in-memory rate limit on auth routes (single-instance only),
no secrets in the repository (production refuses to start without a strong `JWT_SECRET`).

## Folder structure

```
CineOpt/
  frontend/          React + Vite + Tailwind (components, pages, services, context, hooks)
  backend/           Express API (config, controllers, middleware, routes, services, utils) + Jest tests
  algorithm-engine/  FastAPI app, algorithms/, services/benchmark.py, tests/, benchmarks/
  database/          schema.sql, seed.sql, generate_seed.py
  .github/workflows/ci.yml
  docker-compose.yml, .env.example, .gitignore, README.md
```

## Future improvements

Seat holds with expiry while a user confirms, aisle-aware coordinates and accessibility seats, multiple showtimes per theatre,
a persistent rate limiter, refresh tokens, committed package-lock files, end-to-end browser tests, a pre-filter that scales knapsack/GA to multi-screen venues.
