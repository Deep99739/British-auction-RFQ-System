import { randomUUID } from "node:crypto";
import { AppError } from "../errors/AppError.js";
import {
  calculateExtendedClose,
  didAnyRankChange,
  getAuctionAvailability,
  getLeaderSupplierId,
  isInsideTriggerWindow,
  shouldExtendAuction,
  totalQuoteAmount,
} from "../domain/auctionRules.js";
import {
  validateBid,
  validateCreateAuction,
} from "../validation/auctionValidation.js";

const TRIGGER_REASON = {
  BID_RECEIVED: "A valid bid was received inside the trigger window.",
  ANY_RANK_CHANGE: "A supplier ranking changed inside the trigger window.",
  L1_CHANGE: "The L1 supplier changed inside the trigger window.",
};

export function createAuctionService({ repository, publishUpdate }) {
  return {
    async listAuctions() {
      return repository.listAuctions();
    },

    async getAuction(auctionId) {
      const auction = await repository.getAuction(auctionId);
      if (!auction) {
        throw new AppError(
          404,
          "AUCTION_NOT_FOUND",
          "The requested auction does not exist."
        );
      }
      return auction;
    },

    async createAuction(input) {
      const values = validateCreateAuction(input);
      return repository.createAuction({
        id: randomUUID(),
        ...values,
      });
    },

    async placeBid({ auctionId, idempotencyKey, input }) {
      if (
        typeof idempotencyKey !== "string" ||
        !idempotencyKey.trim() ||
        idempotencyKey.length > 128
      ) {
        throw new AppError(
          400,
          "IDEMPOTENCY_KEY_REQUIRED",
          "Send a unique Idempotency-Key header when submitting a bid."
        );
      }

      const bid = validateBid(input);
      // Locking one auction keeps bid acceptance, ranking changes, and deadline
      // extensions inside the same serialization boundary.
      const transactionResult = await repository.withTransaction(async (tx) => {
        const now = await tx.getDatabaseTime();
        const auction = await tx.lockAuction(auctionId);

        if (!auction) {
          throw new AppError(
            404,
            "AUCTION_NOT_FOUND",
            "The requested auction does not exist."
          );
        }

        // Check idempotency before availability so a successful request can be
        // retried safely even if the auction has since closed.
        const duplicate = await tx.findBidByIdempotencyKey(
          auctionId,
          idempotencyKey.trim()
        );
        if (duplicate) {
          return {
            duplicate: true,
            extension: null,
          };
        }

        const availability = getAuctionAvailability({ auction, now });
        if (availability === "NOT_STARTED") {
          throw new AppError(
            409,
            "AUCTION_NOT_STARTED",
            "Bidding has not started for this auction."
          );
        }
        if (availability === "CLOSED") {
          throw new AppError(
            409,
            "AUCTION_CLOSED",
            "Bidding is closed for this auction."
          );
        }

        const beforeRankings = await tx.getRankings(auctionId);
        const supplier = await tx.upsertSupplier({
          id: randomUUID(),
          name: bid.supplierName,
        });
        const totalAmount = totalQuoteAmount(bid);
        const insertedBid = await tx.insertBid({
          id: randomUUID(),
          auctionId,
          supplierId: supplier.id,
          freightAmount: bid.freightAmount,
          originAmount: bid.originAmount,
          destinationAmount: bid.destinationAmount,
          transitDays: bid.transitDays,
          validUntil: bid.validUntil,
          idempotencyKey: idempotencyKey.trim(),
          submittedAt: now,
        });
        const afterRankings = await tx.getRankings(auctionId);
        const oldLeaderId = getLeaderSupplierId(beforeRankings);
        const newLeaderId = getLeaderSupplierId(afterRankings);
        const leaderChanged = oldLeaderId !== newLeaderId;
        const rankChanged = didAnyRankChange(beforeRankings, afterRankings);
        const insideTriggerWindow = isInsideTriggerWindow({
          now,
          currentCloseAt: auction.currentCloseAt,
          triggerWindowMinutes: auction.triggerWindowMinutes,
        });
        const extensionTriggered = shouldExtendAuction({
          triggerType: auction.triggerType,
          insideTriggerWindow,
          beforeRankings,
          afterRankings,
        });

        await tx.insertActivity({
          auctionId,
          bidId: insertedBid.id,
          type: "BID_SUBMITTED",
          actorName: supplier.name,
          message: `${supplier.name} submitted a quote of ${auction.currency} ${totalAmount}.`,
          metadata: { totalAmount },
          createdAt: now,
        });

        if (rankChanged) {
          const newRank =
            afterRankings.find(
              (ranking) => ranking.supplierId === supplier.id
            )?.rank ?? null;
          await tx.insertActivity({
            auctionId,
            bidId: insertedBid.id,
            type: "RANK_CHANGED",
            actorName: supplier.name,
            message: leaderChanged
              ? `${supplier.name} became the L1 supplier.`
              : `${supplier.name} changed the current ranking.`,
            metadata: { newRank, leaderChanged },
            createdAt: now,
          });
        }

        let extension = null;
        if (extensionTriggered) {
          const newCloseAt = calculateExtendedClose({
            currentCloseAt: auction.currentCloseAt,
            forcedCloseAt: auction.forcedCloseAt,
            extensionDurationMinutes: auction.extensionDurationMinutes,
          });
          const previousCloseAt = new Date(auction.currentCloseAt);

          if (newCloseAt > previousCloseAt) {
            await tx.updateCurrentClose(auctionId, newCloseAt);
            extension = {
              previousCloseAt,
              currentCloseAt: newCloseAt,
              cappedAtForcedClose:
                newCloseAt.getTime() ===
                new Date(auction.forcedCloseAt).getTime(),
              reason: TRIGGER_REASON[auction.triggerType],
            };

            await tx.insertActivity({
              auctionId,
              bidId: insertedBid.id,
              type: "AUCTION_EXTENDED",
              actorName: null,
              message: `Auction close extended to ${newCloseAt.toISOString()}.`,
              metadata: {
                previousCloseAt: previousCloseAt.toISOString(),
                currentCloseAt: newCloseAt.toISOString(),
                cappedAtForcedClose: extension.cappedAtForcedClose,
                triggerType: auction.triggerType,
                reason: extension.reason,
              },
              createdAt: now,
            });
          }
        }

        return {
          duplicate: false,
          extension,
        };
      });

      const auction = await repository.getAuction(auctionId);

      if (!transactionResult.duplicate) {
        // Publish only after commit; clients refetch the database-backed state.
        publishUpdate({
          auctionId,
          reason: transactionResult.extension
            ? "BID_ACCEPTED_AND_EXTENDED"
            : "BID_ACCEPTED",
          occurredAt: new Date().toISOString(),
        });
      }

      return {
        duplicate: transactionResult.duplicate,
        extension: transactionResult.extension,
        auction,
      };
    },
  };
}
