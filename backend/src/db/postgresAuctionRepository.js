import {
  mapActivityRow,
  mapAuctionRow,
  mapRankingRow,
} from "./rowMappers.js";

const AUCTION_STATUS_SQL = `
  CASE
    WHEN NOW() < a.bid_start_at THEN 'SCHEDULED'
    WHEN NOW() < LEAST(a.current_close_at, a.forced_close_at) THEN 'ACTIVE'
    WHEN a.current_close_at >= a.forced_close_at THEN 'FORCE_CLOSED'
    ELSE 'CLOSED'
  END
`;

// Bid history remains immutable; only each supplier's latest bid participates
// in the current ranking.
const LATEST_RANKINGS_SQL = `
  WITH latest_supplier_bids AS (
    SELECT
      b.*,
      ROW_NUMBER() OVER (
        PARTITION BY b.supplier_id
        ORDER BY b.submitted_at DESC, b.id DESC
      ) AS supplier_bid_order
    FROM bids b
    WHERE b.auction_id = $1
  ),
  ranked_bids AS (
    SELECT
      b.*,
      ROW_NUMBER() OVER (
        ORDER BY b.total_amount ASC, b.submitted_at ASC, b.id ASC
      ) AS rank
    FROM latest_supplier_bids b
    WHERE b.supplier_bid_order = 1
  )
  SELECT
    rb.rank,
    rb.id AS bid_id,
    rb.supplier_id,
    s.name AS supplier_name,
    rb.freight_amount,
    rb.origin_amount,
    rb.destination_amount,
    rb.total_amount,
    rb.transit_days,
    rb.valid_until,
    rb.submitted_at
  FROM ranked_bids rb
  JOIN suppliers s ON s.id = rb.supplier_id
  ORDER BY rb.rank
`;

function createTransaction(client) {
  return {
    async getDatabaseTime() {
      const result = await client.query("SELECT NOW() AS now");
      return result.rows[0].now;
    },

    async lockAuction(auctionId) {
      const result = await client.query(
        `
          SELECT
            a.*,
            ${AUCTION_STATUS_SQL} AS status
          FROM auctions a
          WHERE a.id = $1
          FOR UPDATE
        `,
        [auctionId]
      );
      return mapAuctionRow(result.rows[0]);
    },

    async findBidByIdempotencyKey(auctionId, idempotencyKey) {
      const result = await client.query(
        `
          SELECT id
          FROM bids
          WHERE auction_id = $1 AND idempotency_key = $2
        `,
        [auctionId, idempotencyKey]
      );
      return result.rows[0] ?? null;
    },

    async upsertSupplier({ id, name }) {
      const result = await client.query(
        `
          INSERT INTO suppliers (id, name)
          VALUES ($1, $2)
          ON CONFLICT (normalized_name)
          DO UPDATE SET name = EXCLUDED.name
          RETURNING id, name
        `,
        [id, name]
      );
      return result.rows[0];
    },

    async getRankings(auctionId) {
      const result = await client.query(LATEST_RANKINGS_SQL, [auctionId]);
      return result.rows.map(mapRankingRow);
    },

    async insertBid(bid) {
      const result = await client.query(
        `
          INSERT INTO bids (
            id,
            auction_id,
            supplier_id,
            freight_amount,
            origin_amount,
            destination_amount,
            transit_days,
            valid_until,
            idempotency_key,
            submitted_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, total_amount, submitted_at
        `,
        [
          bid.id,
          bid.auctionId,
          bid.supplierId,
          bid.freightAmount,
          bid.originAmount,
          bid.destinationAmount,
          bid.transitDays,
          bid.validUntil,
          bid.idempotencyKey,
          bid.submittedAt,
        ]
      );
      return result.rows[0];
    },

    async updateCurrentClose(auctionId, currentCloseAt) {
      await client.query(
        `
          UPDATE auctions
          SET current_close_at = $2, updated_at = NOW()
          WHERE id = $1
        `,
        [auctionId, currentCloseAt]
      );
    },

    async insertActivity(activity) {
      await client.query(
        `
          INSERT INTO activity_log (
            auction_id,
            bid_id,
            type,
            actor_name,
            message,
            metadata,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
        `,
        [
          activity.auctionId,
          activity.bidId ?? null,
          activity.type,
          activity.actorName ?? null,
          activity.message,
          JSON.stringify(activity.metadata ?? {}),
          activity.createdAt,
        ]
      );
    },
  };
}

export function createPostgresAuctionRepository(pool) {
  async function getAuctionRow(auctionId) {
    const result = await pool.query(
      `
        SELECT
          a.*,
          ${AUCTION_STATUS_SQL} AS status,
          (
            SELECT MIN(latest.total_amount)
            FROM (
              SELECT DISTINCT ON (b.supplier_id)
                b.supplier_id,
                b.total_amount
              FROM bids b
              WHERE b.auction_id = a.id
              ORDER BY b.supplier_id, b.submitted_at DESC, b.id DESC
            ) latest
          ) AS lowest_bid,
          (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) AS bid_count
        FROM auctions a
        WHERE a.id = $1
      `,
      [auctionId]
    );
    return mapAuctionRow(result.rows[0]);
  }

  return {
    async listAuctions() {
      const result = await pool.query(`
        SELECT
          a.*,
          ${AUCTION_STATUS_SQL} AS status,
          (
            SELECT MIN(latest.total_amount)
            FROM (
              SELECT DISTINCT ON (b.supplier_id)
                b.supplier_id,
                b.total_amount
              FROM bids b
              WHERE b.auction_id = a.id
              ORDER BY b.supplier_id, b.submitted_at DESC, b.id DESC
            ) latest
          ) AS lowest_bid,
          (SELECT COUNT(*) FROM bids b WHERE b.auction_id = a.id) AS bid_count
        FROM auctions a
        ORDER BY
          CASE WHEN NOW() < LEAST(a.current_close_at, a.forced_close_at)
            THEN 0 ELSE 1 END,
          a.current_close_at ASC
      `);
      return result.rows.map(mapAuctionRow);
    },

    async getAuction(auctionId) {
      const auction = await getAuctionRow(auctionId);
      if (!auction) return null;

      const [rankingResult, activityResult] = await Promise.all([
        pool.query(LATEST_RANKINGS_SQL, [auctionId]),
        pool.query(
          `
            SELECT id, type, actor_name, message, metadata, created_at
            FROM activity_log
            WHERE auction_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT 100
          `,
          [auctionId]
        ),
      ]);

      return {
        ...auction,
        rankings: rankingResult.rows.map(mapRankingRow),
        activity: activityResult.rows.map(mapActivityRow),
      };
    },

    async createAuction(auction) {
      const result = await pool.query(
        `
          INSERT INTO auctions (
            id,
            reference_id,
            name,
            origin,
            destination,
            currency,
            service_date,
            bid_start_at,
            initial_close_at,
            current_close_at,
            forced_close_at,
            trigger_window_minutes,
            extension_duration_minutes,
            trigger_type
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $9, $10, $11, $12, $13
          )
          RETURNING *
        `,
        [
          auction.id,
          auction.referenceId,
          auction.name,
          auction.origin,
          auction.destination,
          auction.currency,
          auction.serviceDate,
          auction.bidStartAt,
          auction.bidCloseAt,
          auction.forcedCloseAt,
          auction.triggerWindowMinutes,
          auction.extensionDurationMinutes,
          auction.triggerType,
        ]
      );

      return getAuctionRow(result.rows[0].id);
    },

    async withTransaction(work) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await work(createTransaction(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
