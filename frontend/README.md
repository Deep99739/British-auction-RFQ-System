# RFQ Console Frontend

React and JavaScript frontend for configurable British Auction RFQs.

## Current screens

- `/` — auction repository with status filters and search
- `/auctions/new` — RFQ creation and auction-rule configuration
- `/auctions/:id` — live auction summary, supplier ranking, quote submission, and activity history

## Technology

- React
- Plain JavaScript
- Plain CSS
- Vite

The UI uses browser-native forms and a small local router. It does not require a
component library, CSS framework or global state library.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Copy the environment template, start the backend, then run the application:

```bash
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm test
```

This runs ESLint and creates a production build.

## Data modes

- `VITE_DATA_MODE=api`: use the REST and Socket.IO backend.
- Any other value: use the deterministic local demonstration data.

The browser never decides whether a bid is valid. In API mode, server time, decimal-safe totals, rankings, extension triggers, and forced-close enforcement are authoritative.
