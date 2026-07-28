CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  normalized_name TEXT GENERATED ALWAYS AS (LOWER(BTRIM(name))) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT suppliers_name_not_blank CHECK (BTRIM(name) <> ''),
  CONSTRAINT suppliers_normalized_name_unique UNIQUE (normalized_name)
);

CREATE TABLE IF NOT EXISTS auctions (
  id UUID PRIMARY KEY,
  reference_id VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  origin VARCHAR(180) NOT NULL,
  destination VARCHAR(180) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  service_date DATE NOT NULL,
  bid_start_at TIMESTAMPTZ NOT NULL,
  initial_close_at TIMESTAMPTZ NOT NULL,
  current_close_at TIMESTAMPTZ NOT NULL,
  forced_close_at TIMESTAMPTZ NOT NULL,
  trigger_window_minutes INTEGER NOT NULL,
  extension_duration_minutes INTEGER NOT NULL,
  trigger_type VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auctions_name_not_blank CHECK (BTRIM(name) <> ''),
  CONSTRAINT auctions_reference_not_blank CHECK (BTRIM(reference_id) <> ''),
  CONSTRAINT auctions_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT auctions_schedule_order CHECK (
    bid_start_at < initial_close_at
    AND initial_close_at <= current_close_at
    AND current_close_at <= forced_close_at
  ),
  CONSTRAINT auctions_trigger_window_positive CHECK (
    trigger_window_minutes > 0
  ),
  CONSTRAINT auctions_extension_duration_positive CHECK (
    extension_duration_minutes > 0
  ),
  CONSTRAINT auctions_trigger_type_valid CHECK (
    trigger_type IN ('BID_RECEIVED', 'ANY_RANK_CHANGE', 'L1_CHANGE')
  )
);

CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  freight_amount NUMERIC(14, 2) NOT NULL,
  origin_amount NUMERIC(14, 2) NOT NULL,
  destination_amount NUMERIC(14, 2) NOT NULL,
  total_amount NUMERIC(14, 2) GENERATED ALWAYS AS (
    freight_amount + origin_amount + destination_amount
  ) STORED,
  transit_days INTEGER NOT NULL,
  valid_until DATE NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bids_freight_non_negative CHECK (freight_amount >= 0),
  CONSTRAINT bids_origin_non_negative CHECK (origin_amount >= 0),
  CONSTRAINT bids_destination_non_negative CHECK (destination_amount >= 0),
  CONSTRAINT bids_transit_positive CHECK (transit_days > 0),
  CONSTRAINT bids_idempotency_unique UNIQUE (auction_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
  bid_id UUID REFERENCES bids(id) ON DELETE RESTRICT,
  type VARCHAR(32) NOT NULL,
  actor_name VARCHAR(160),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT activity_type_valid CHECK (
    type IN (
      'AUCTION_CREATED',
      'BID_SUBMITTED',
      'RANK_CHANGED',
      'AUCTION_EXTENDED',
      'AUCTION_CLOSED'
    )
  )
);

CREATE INDEX IF NOT EXISTS auctions_current_close_idx
  ON auctions (current_close_at);

CREATE INDEX IF NOT EXISTS bids_auction_supplier_latest_idx
  ON bids (auction_id, supplier_id, submitted_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS bids_auction_total_idx
  ON bids (auction_id, total_amount, submitted_at, id);

CREATE INDEX IF NOT EXISTS activity_auction_created_idx
  ON activity_log (auction_id, created_at DESC, id DESC);
