import test from "node:test";
import assert from "node:assert/strict";
import { createAuctionService } from "../src/services/auctionService.js";

test("a bid, extension, and audit entries complete before realtime publish", async () => {
  const sequence = [];
  const activities = [];
  let updatedClose = null;
  const auction = {
    id: "20000000-0000-4000-8000-000000000014",
    currency: "INR",
    bidStartAt: new Date("2026-07-28T12:00:00.000Z"),
    currentCloseAt: new Date("2026-07-28T12:30:00.000Z"),
    forcedCloseAt: new Date("2026-07-28T13:00:00.000Z"),
    triggerWindowMinutes: 10,
    extensionDurationMinutes: 5,
    triggerType: "L1_CHANGE",
  };
  const repository = {
    async withTransaction(work) {
      const result = await work({
        getDatabaseTime: async () => new Date("2026-07-28T12:25:00.000Z"),
        lockAuction: async () => auction,
        findBidByIdempotencyKey: async () => null,
        getRankings: (() => {
          let call = 0;
          return async () => {
            call += 1;
            return call === 1
              ? [
                  {
                    rank: 1,
                    supplierId: "supplier-a",
                    supplierName: "Existing Carrier",
                  },
                ]
              : [
                  {
                    rank: 1,
                    supplierId: "supplier-b",
                    supplierName: "New Carrier",
                  },
                  {
                    rank: 2,
                    supplierId: "supplier-a",
                    supplierName: "Existing Carrier",
                  },
                ];
          };
        })(),
        upsertSupplier: async () => ({
          id: "supplier-b",
          name: "New Carrier",
        }),
        insertBid: async () => ({ id: "bid-1", total_amount: "470000.00" }),
        updateCurrentClose: async (_id, close) => {
          updatedClose = close;
        },
        insertActivity: async (entry) => {
          activities.push(entry);
        },
      });
      sequence.push("commit");
      return result;
    },
    async getAuction() {
      return { ...auction, rankings: [], activity: [] };
    },
  };
  const service = createAuctionService({
    repository,
    publishUpdate: () => sequence.push("publish"),
  });

  const result = await service.placeBid({
    auctionId: auction.id,
    idempotencyKey: "browser-request-1",
    input: {
      supplierName: "New Carrier",
      freightAmount: "410000",
      originAmount: "18000",
      destinationAmount: "42000",
      transitDays: 22,
      validUntil: "2026-08-15",
    },
  });

  assert.equal(result.duplicate, false);
  assert.equal(
    updatedClose.toISOString(),
    "2026-07-28T12:35:00.000Z"
  );
  assert.deepEqual(
    activities.map((entry) => entry.type),
    ["BID_SUBMITTED", "RANK_CHANGED", "AUCTION_EXTENDED"]
  );
  assert.deepEqual(sequence, ["commit", "publish"]);
});

test("an accepted idempotency key can be retried after the auction closes", async () => {
  let inserted = false;
  let published = false;
  const currentAuction = {
    id: "20000000-0000-4000-8000-000000000014",
    bidStartAt: new Date("2026-07-28T12:00:00.000Z"),
    currentCloseAt: new Date("2026-07-28T12:30:00.000Z"),
    forcedCloseAt: new Date("2026-07-28T13:00:00.000Z"),
  };
  const repository = {
    async withTransaction(work) {
      return work({
        getDatabaseTime: async () => new Date("2026-07-28T12:31:00.000Z"),
        lockAuction: async () => currentAuction,
        findBidByIdempotencyKey: async () => ({ id: "accepted-bid" }),
        insertBid: async () => {
          inserted = true;
        },
      });
    },
    getAuction: async () => currentAuction,
  };
  const service = createAuctionService({
    repository,
    publishUpdate: () => {
      published = true;
    },
  });

  const result = await service.placeBid({
    auctionId: currentAuction.id,
    idempotencyKey: "already-accepted",
    input: {
      supplierName: "New Carrier",
      freightAmount: "410000",
      originAmount: "18000",
      destinationAmount: "42000",
      transitDays: 22,
      validUntil: "2026-08-15",
    },
  });

  assert.equal(result.duplicate, true);
  assert.equal(inserted, false);
  assert.equal(published, false);
});
