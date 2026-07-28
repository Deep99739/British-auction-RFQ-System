INSERT INTO suppliers (id, name)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'BlueWave Logistics'),
  ('10000000-0000-4000-8000-000000000002', 'Meridian Freight'),
  ('10000000-0000-4000-8000-000000000003', 'Northstar Cargo'),
  ('10000000-0000-4000-8000-000000000004', 'Atlas Shipping Co.')
ON CONFLICT (normalized_name) DO NOTHING;

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
  '20000000-0000-4000-8000-000000000014',
  'BA-2026-014',
  'West Europe reefer allocation',
  'Nhava Sheva, India',
  'Rotterdam, Netherlands',
  'INR',
  CURRENT_DATE + 14,
  NOW() - INTERVAL '30 minutes',
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '1 day 30 minutes',
  10,
  5,
  'L1_CHANGE'
)
ON CONFLICT (reference_id) DO UPDATE
SET
  service_date = EXCLUDED.service_date,
  bid_start_at = EXCLUDED.bid_start_at,
  initial_close_at = EXCLUDED.initial_close_at,
  current_close_at = EXCLUDED.current_close_at,
  forced_close_at = EXCLUDED.forced_close_at,
  updated_at = NOW();

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
VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000014',
    '10000000-0000-4000-8000-000000000001',
    420000, 18000, 45200, 24, CURRENT_DATE + 18,
    'seed-bluewave-1', NOW() - INTERVAL '4 minutes'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000014',
    '10000000-0000-4000-8000-000000000002',
    432000, 16500, 41750, 22, CURRENT_DATE + 15,
    'seed-meridian-1', NOW() - INTERVAL '6 minutes'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000014',
    '10000000-0000-4000-8000-000000000003',
    440000, 21000, 38500, 26, CURRENT_DATE + 21,
    'seed-northstar-1', NOW() - INTERVAL '10 minutes'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000014',
    '10000000-0000-4000-8000-000000000004',
    449000, 19200, 39750, 23, CURRENT_DATE + 17,
    'seed-atlas-1', NOW() - INTERVAL '15 minutes'
  )
ON CONFLICT (auction_id, idempotency_key) DO NOTHING;

INSERT INTO activity_log (
  auction_id,
  bid_id,
  type,
  actor_name,
  message,
  metadata,
  created_at
)
SELECT
  '20000000-0000-4000-8000-000000000014',
  '30000000-0000-4000-8000-000000000001',
  'BID_SUBMITTED',
  'BlueWave Logistics',
  'BlueWave Logistics submitted a quote of INR 483200.00.',
  '{"totalAmount":"483200.00"}',
  NOW() - INTERVAL '4 minutes'
WHERE NOT EXISTS (
  SELECT 1 FROM activity_log
  WHERE bid_id = '30000000-0000-4000-8000-000000000001'
);
