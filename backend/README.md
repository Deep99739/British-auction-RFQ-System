# RFQ Auction API

Modular-monolith API for British Auction bidding.

## Responsibilities

- REST APIs for RFQs, auction details, and bid commands
- PostgreSQL persistence and immutable bid history
- Transactional ranking and deadline-extension decisions
- Socket.IO notifications after successful commits
- Stable errors, request IDs, health checks, and graceful shutdown

## Local setup

1. Start PostgreSQL from the project root:

   ```bash
   docker compose up -d
   ```

2. Create the backend environment:

   ```bash
   cp .env.example .env
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

3. The API runs at `http://localhost:4000`.

## Useful endpoints

- `GET /api/health`
- `GET /api/ready`
- `GET /api/auctions`
- `POST /api/auctions`
- `GET /api/auctions/:auctionId`
- `POST /api/auctions/:auctionId/bids`

Bid requests require a unique `Idempotency-Key` header. This prevents a browser retry from creating the same bid twice.

## Tests

```bash
npm test
```

The test suite covers money arithmetic, trigger-window boundaries, ranking changes, forced-close capping, transaction-before-notification ordering, liveness, and the error response contract.
