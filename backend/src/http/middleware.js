import { randomUUID } from "node:crypto";
import { AppError } from "../errors/AppError.js";

export function requestContext(req, res, next) {
  const incomingId = req.get("x-request-id");
  req.requestId =
    incomingId && incomingId.length <= 128 ? incomingId : randomUUID();
  res.set("x-request-id", req.requestId);

  const startedAt = Date.now();
  res.on("finish", () => {
    const entry = {
      level: res.statusCode >= 500 ? "error" : "info",
      event: "http_request",
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    };
    console.log(JSON.stringify(entry));
  });

  next();
}

export function notFound(req, _res, next) {
  next(
    new AppError(
      404,
      "ROUTE_NOT_FOUND",
      `No API route exists for ${req.method} ${req.originalUrl}.`
    )
  );
}

export function errorHandler(error, req, res, _next) {
  if (error.code === "23505") {
    return res.status(409).json({
      error: {
        code: "DUPLICATE_RECORD",
        message: "A record with the same unique value already exists.",
      },
      requestId: req.requestId,
    });
  }

  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      requestId: req.requestId,
    });
  }

  console.error(
    JSON.stringify({
      level: "error",
      event: "unhandled_error",
      requestId: req.requestId,
      message: error.message,
      stack: error.stack,
    })
  );

  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred.",
    },
    requestId: req.requestId,
  });
}
