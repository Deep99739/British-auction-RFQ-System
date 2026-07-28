export function mapAuctionRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    referenceId: row.reference_id,
    name: row.name,
    origin: row.origin,
    destination: row.destination,
    lane: `${row.origin} → ${row.destination}`,
    currency: row.currency,
    serviceDate: row.service_date,
    bidStartAt: row.bid_start_at,
    initialCloseAt: row.initial_close_at,
    currentCloseAt: row.current_close_at,
    forcedCloseAt: row.forced_close_at,
    triggerWindowMinutes: row.trigger_window_minutes,
    extensionDurationMinutes: row.extension_duration_minutes,
    triggerType: row.trigger_type,
    status: row.status,
    lowestBid: row.lowest_bid ?? null,
    bidCount: Number(row.bid_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRankingRow(row) {
  return {
    rank: Number(row.rank),
    bidId: row.bid_id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    freightAmount: row.freight_amount,
    originAmount: row.origin_amount,
    destinationAmount: row.destination_amount,
    totalAmount: row.total_amount,
    transitDays: row.transit_days,
    validUntil: row.valid_until,
    submittedAt: row.submitted_at,
  };
}

export function mapActivityRow(row) {
  return {
    id: String(row.id),
    type: row.type,
    actorName: row.actor_name,
    message: row.message,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}
