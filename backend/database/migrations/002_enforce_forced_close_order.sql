ALTER TABLE auctions
  DROP CONSTRAINT IF EXISTS auctions_schedule_order;

ALTER TABLE auctions
  ADD CONSTRAINT auctions_schedule_order CHECK (
    bid_start_at < initial_close_at
    AND initial_close_at <= current_close_at
    AND current_close_at <= forced_close_at
    AND initial_close_at < forced_close_at
  );
