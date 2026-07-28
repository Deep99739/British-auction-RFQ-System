# British Auction in an RFQ System

A full-stack reverse-auction application for creating RFQs, collecting supplier
quotations, ranking each supplier's latest bid, and extending the closing time
according to configurable auction rules.

## Live application

- Web application: https://rfq-auction-web.vercel.app

## Requirements implemented

| Area | Implementation |
|---|---|
| RFQ creation | Name, reference, bid start, initial close, forced close, service date, origin and destination |
| Supplier quote | Carrier, freight/origin/destination charges, transit days and quote validity |
| Auction rules | Configurable trigger window (X), extension duration (Y), and all three trigger types |
| Close protection | Every extension is capped at the forced-close time |
| Auction repository | Reference, name, lowest quote, effective close, forced close and derived status |
| Auction details | Current ranking, latest supplier quotes, configuration and chronological activity |
| Live updates | Socket.IO invalidation followed by an authoritative REST reload |
| Auditability | Immutable bid history plus bid, rank-change and extension activity records |

## Repository structure

```text
backend/
  scripts/                 migrations and seed data
  src/application/         auction use cases
  src/domain/              money, ranking and timing policies
  src/http/                REST adapter and error handling
  src/infrastructure/      PostgreSQL and Socket.IO adapters
  test/                    automated tests
frontend/
  app/                     pages, components, styles and API client
  src/                     React entry point and lightweight routing
docs/
  HIGH_LEVEL_DESIGN.md
  DATABASE_SCHEMA.md
```

## Run locally

Requirements:

- Node.js 22 or newer
- Docker Desktop, or an accessible PostgreSQL database

Start PostgreSQL and the API:

```bash
docker compose up -d
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

In a second terminal, start the React application:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## Environment variables

Backend:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL application connection |
| `DATABASE_URL_UNPOOLED` | Optional direct connection for migrations and seeds |
| `FRONTEND_ORIGIN` | Allowed browser origin |
| `PORT` | API port; defaults to `4000` |
| `DATABASE_SSL` | Enables TLS for managed PostgreSQL |

Frontend:

| Variable | Purpose |
|---|---|
| `VITE_DATA_MODE` | Set to `api` for the full-stack application |
| `VITE_API_URL` | Public base URL of the API |

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Process liveness |
| `GET` | `/api/ready` | Database readiness |
| `GET` | `/api/auctions` | List auctions |
| `POST` | `/api/auctions` | Create an RFQ auction |
| `GET` | `/api/auctions/:auctionId` | Get ranking, configuration and activity |
| `POST` | `/api/auctions/:auctionId/bids` | Submit an idempotent quotation |

Bid requests require an `Idempotency-Key` header.

## Correctness decisions

- The API reads PostgreSQL time rather than trusting a browser clock.
- `SELECT ... FOR UPDATE` serializes competing bids for the same auction.
- Charge calculations use integer cents in JavaScript and `NUMERIC(14,2)` in
  PostgreSQL.
- Bid history is append-only; rankings use each supplier's latest bid.
- Realtime events are emitted only after the database transaction commits.
- Socket.IO is a refresh signal, not a second source of auction state.

## Verification

```bash
cd backend && npm test
cd frontend && npm test
```

The deployed flow was verified end to end: loading the repository, opening an
auction, submitting a quotation, persisting it, recalculating rank and showing
the resulting activity.

## Design documents

- [High-level design](docs/HIGH_LEVEL_DESIGN.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
