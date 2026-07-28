const MONEY_PATTERN = /^(0|[1-9]\d*)(\.\d{1,2})?$/;

export function moneyToCents(value) {
  const normalized = String(value ?? "").trim();

  if (!MONEY_PATTERN.test(normalized)) {
    throw new Error("Money must be a positive number with at most 2 decimals.");
  }

  const [whole, fraction = ""] = normalized.split(".");
  // Integer cents avoid binary floating-point errors in quote comparisons.
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function centsToMoney(cents) {
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function totalQuoteAmount({
  freightAmount,
  originAmount,
  destinationAmount,
}) {
  return centsToMoney(
    moneyToCents(freightAmount) +
      moneyToCents(originAmount) +
      moneyToCents(destinationAmount)
  );
}

export function getLeaderSupplierId(rankings) {
  return rankings[0]?.supplierId ?? null;
}

export function didAnyRankChange(beforeRankings, afterRankings) {
  const before = new Map(
    beforeRankings.map((entry, index) => [entry.supplierId, index + 1])
  );
  const after = new Map(
    afterRankings.map((entry, index) => [entry.supplierId, index + 1])
  );
  const supplierIds = new Set([...before.keys(), ...after.keys()]);

  for (const supplierId of supplierIds) {
    if (before.get(supplierId) !== after.get(supplierId)) {
      return true;
    }
  }

  return false;
}

export function isInsideTriggerWindow({
  now,
  currentCloseAt,
  triggerWindowMinutes,
}) {
  const nowMs = new Date(now).getTime();
  const closeMs = new Date(currentCloseAt).getTime();
  const windowStartMs = closeMs - Number(triggerWindowMinutes) * 60_000;

  return nowMs >= windowStartMs && nowMs < closeMs;
}

export function shouldExtendAuction({
  triggerType,
  insideTriggerWindow,
  beforeRankings,
  afterRankings,
}) {
  if (!insideTriggerWindow) return false;

  if (triggerType === "BID_RECEIVED") return true;
  if (triggerType === "ANY_RANK_CHANGE") {
    return didAnyRankChange(beforeRankings, afterRankings);
  }
  if (triggerType === "L1_CHANGE") {
    return (
      getLeaderSupplierId(beforeRankings) !==
      getLeaderSupplierId(afterRankings)
    );
  }

  return false;
}

export function calculateExtendedClose({
  currentCloseAt,
  forcedCloseAt,
  extensionDurationMinutes,
}) {
  const currentMs = new Date(currentCloseAt).getTime();
  const forcedMs = new Date(forcedCloseAt).getTime();
  const proposedMs =
    currentMs + Number(extensionDurationMinutes) * 60_000;

  return new Date(Math.min(proposedMs, forcedMs));
}

export function getAuctionAvailability({ auction, now }) {
  const nowMs = new Date(now).getTime();
  const startMs = new Date(auction.bidStartAt).getTime();
  const closeMs = Math.min(
    new Date(auction.currentCloseAt).getTime(),
    new Date(auction.forcedCloseAt).getTime()
  );

  if (nowMs < startMs) return "NOT_STARTED";
  if (nowMs >= closeMs) return "CLOSED";
  return "OPEN";
}
