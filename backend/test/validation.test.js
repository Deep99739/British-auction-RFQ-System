import test from "node:test";
import assert from "node:assert/strict";
import { validateBid } from "../src/validation/auctionValidation.js";

test("zero-total quotations are rejected by the backend", () => {
  assert.throws(
    () =>
      validateBid({
        supplierName: "Example Carrier",
        freightAmount: "0",
        originAmount: "0",
        destinationAmount: "0",
        transitDays: 4,
        validUntil: "2026-08-10",
      }),
    (error) =>
      error.code === "VALIDATION_ERROR" &&
      error.details.freightAmount.includes("greater than zero")
  );
});
