import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateExtendedClose,
  didAnyRankChange,
  isInsideTriggerWindow,
  moneyToCents,
  shouldExtendAuction,
  totalQuoteAmount,
} from "../src/domain/auctionRules.js";

test("money is added without floating-point rounding", () => {
  assert.equal(moneyToCents("0.10"), 10n);
  assert.equal(
    totalQuoteAmount({
      freightAmount: "420000.10",
      originAmount: "18000.20",
      destinationAmount: "45200.30",
    }),
    "483200.60"
  );
});

test("trigger window includes its start but excludes the close instant", () => {
  const currentCloseAt = "2026-07-28T12:30:00.000Z";

  assert.equal(
    isInsideTriggerWindow({
      now: "2026-07-28T12:20:00.000Z",
      currentCloseAt,
      triggerWindowMinutes: 10,
    }),
    true
  );
  assert.equal(
    isInsideTriggerWindow({
      now: currentCloseAt,
      currentCloseAt,
      triggerWindowMinutes: 10,
    }),
    false
  );
});

test("L1 trigger fires only when the leading supplier changes", () => {
  const beforeRankings = [
    { supplierId: "supplier-a" },
    { supplierId: "supplier-b" },
  ];

  assert.equal(
    shouldExtendAuction({
      triggerType: "L1_CHANGE",
      insideTriggerWindow: true,
      beforeRankings,
      afterRankings: [
        { supplierId: "supplier-b" },
        { supplierId: "supplier-a" },
      ],
    }),
    true
  );

  assert.equal(
    shouldExtendAuction({
      triggerType: "L1_CHANGE",
      insideTriggerWindow: true,
      beforeRankings,
      afterRankings: [
        { supplierId: "supplier-a" },
        { supplierId: "supplier-c" },
        { supplierId: "supplier-b" },
      ],
    }),
    false
  );
});

test("any-rank comparison detects added and moved suppliers", () => {
  assert.equal(
    didAnyRankChange(
      [{ supplierId: "supplier-a" }],
      [
        { supplierId: "supplier-b" },
        { supplierId: "supplier-a" },
      ]
    ),
    true
  );
});

test("extension is capped at the forced close", () => {
  const result = calculateExtendedClose({
    currentCloseAt: "2026-07-28T12:58:00.000Z",
    forcedCloseAt: "2026-07-28T13:00:00.000Z",
    extensionDurationMinutes: 5,
  });

  assert.equal(result.toISOString(), "2026-07-28T13:00:00.000Z");
});
