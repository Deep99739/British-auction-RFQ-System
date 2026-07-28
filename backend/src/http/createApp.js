import cors from "cors";
import express from "express";
import { errorHandler, notFound, requestContext } from "./middleware.js";

export function createApp({ auctionService, pool, frontendOrigin }) {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: frontendOrigin,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Idempotency-Key", "X-Request-Id"],
    })
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(requestContext);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/ready", async (_req, res, next) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ready" });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auctions", async (_req, res, next) => {
    try {
      const auctions = await auctionService.listAuctions();
      res.json({ data: auctions });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auctions", async (req, res, next) => {
    try {
      const auction = await auctionService.createAuction(req.body);
      res.status(201).json({ data: auction });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auctions/:auctionId", async (req, res, next) => {
    try {
      const auction = await auctionService.getAuction(req.params.auctionId);
      res.json({ data: auction });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auctions/:auctionId/bids", async (req, res, next) => {
    try {
      const result = await auctionService.placeBid({
        auctionId: req.params.auctionId,
        idempotencyKey: req.get("idempotency-key"),
        input: req.body,
      });
      res.status(result.duplicate ? 200 : 201).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
