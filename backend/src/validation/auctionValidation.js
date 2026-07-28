import { AppError } from "../errors/AppError.js";
import {
  moneyToCents,
  totalQuoteAmount,
} from "../domain/auctionRules.js";

const TRIGGER_TYPES = new Set([
  "BID_RECEIVED",
  "ANY_RANK_CHANGE",
  "L1_CHANGE",
]);

function requiredText(value, field, errors) {
  if (typeof value !== "string" || !value.trim()) {
    errors[field] = "This field is required.";
    return "";
  }

  return value.trim();
}

function validDate(value, field, errors) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    errors[field] = "Enter a valid date and time.";
    return null;
  }
  return date;
}

function positiveInteger(value, field, errors) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    errors[field] = "Enter a positive whole number.";
    return null;
  }
  return number;
}

function throwIfInvalid(errors) {
  if (Object.keys(errors).length > 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Some submitted values are invalid.",
      errors
    );
  }
}

export function validateCreateAuction(input) {
  const errors = {};
  const name = requiredText(input.name, "name", errors);
  const referenceId = requiredText(
    input.referenceId,
    "referenceId",
    errors
  );
  const origin = requiredText(input.origin, "origin", errors);
  const destination = requiredText(
    input.destination,
    "destination",
    errors
  );
  const bidStartAt = validDate(input.bidStartAt, "bidStartAt", errors);
  const bidCloseAt = validDate(input.bidCloseAt, "bidCloseAt", errors);
  const forcedCloseAt = validDate(
    input.forcedCloseAt,
    "forcedCloseAt",
    errors
  );
  const serviceDate = validDate(input.serviceDate, "serviceDate", errors);
  const triggerWindowMinutes = positiveInteger(
    input.triggerWindowMinutes,
    "triggerWindowMinutes",
    errors
  );
  const extensionDurationMinutes = positiveInteger(
    input.extensionDurationMinutes,
    "extensionDurationMinutes",
    errors
  );

  if (!TRIGGER_TYPES.has(input.triggerType)) {
    errors.triggerType = "Choose a supported extension trigger.";
  }
  if (bidStartAt && bidCloseAt && bidStartAt >= bidCloseAt) {
    errors.bidCloseAt = "Bid close must be later than bid start.";
  }
  if (bidCloseAt && forcedCloseAt && bidCloseAt >= forcedCloseAt) {
    errors.forcedCloseAt =
      "Forced close must be later than the initial bid close.";
  }

  throwIfInvalid(errors);

  return {
    name,
    referenceId,
    origin,
    destination,
    currency: input.currency || "INR",
    serviceDate,
    bidStartAt,
    bidCloseAt,
    forcedCloseAt,
    triggerWindowMinutes,
    extensionDurationMinutes,
    triggerType: input.triggerType,
  };
}

export function validateBid(input) {
  const errors = {};
  const supplierName = requiredText(
    input.supplierName,
    "supplierName",
    errors
  );
  const transitDays = positiveInteger(
    input.transitDays,
    "transitDays",
    errors
  );
  const validUntil = validDate(input.validUntil, "validUntil", errors);

  for (const field of [
    "freightAmount",
    "originAmount",
    "destinationAmount",
  ]) {
    try {
      moneyToCents(input[field]);
    } catch {
      errors[field] =
        "Enter a non-negative amount with at most two decimal places.";
    }
  }

  if (
    !errors.freightAmount &&
    !errors.originAmount &&
    !errors.destinationAmount &&
    moneyToCents(totalQuoteAmount(input)) === 0n
  ) {
    errors.freightAmount = "The total quotation must be greater than zero.";
  }

  throwIfInvalid(errors);

  return {
    supplierName,
    freightAmount: String(input.freightAmount),
    originAmount: String(input.originAmount),
    destinationAmount: String(input.destinationAmount),
    transitDays,
    validUntil,
  };
}
