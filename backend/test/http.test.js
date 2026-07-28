import { createServer } from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../src/errors/AppError.js";
import { createApp } from "../src/http/createApp.js";

async function withServer(app, work) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  try {
    await work(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("health route returns a small liveness response", async () => {
  const app = createApp({
    auctionService: {},
    pool: { query: async () => ({}) },
    frontendOrigin: "http://localhost:3000",
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.ok(response.headers.get("x-request-id"));
  });
});

test("application errors use the stable error envelope", async () => {
  const app = createApp({
    auctionService: {
      getAuction: async () => {
        throw new AppError(
          404,
          "AUCTION_NOT_FOUND",
          "The requested auction does not exist."
        );
      },
    },
    pool: { query: async () => ({}) },
    frontendOrigin: "http://localhost:3000",
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/auctions/00000000-0000-4000-8000-000000000000`
    );
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, "AUCTION_NOT_FOUND");
    assert.equal(typeof body.requestId, "string");
  });
});
