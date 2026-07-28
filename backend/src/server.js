import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { createPostgresAuctionRepository } from "./db/postgresAuctionRepository.js";
import { createApp } from "./http/createApp.js";
import {
  auctionRoom,
  registerAuctionSocket,
} from "./realtime/registerAuctionSocket.js";
import { createAuctionService } from "./services/auctionService.js";

const config = loadConfig();
const pool = createPool(config);
const repository = createPostgresAuctionRepository(pool);
let publishUpdate = () => {};

const auctionService = createAuctionService({
  repository,
  publishUpdate: (event) => publishUpdate(event),
});
const app = createApp({
  auctionService,
  pool,
  frontendOrigin: config.frontendOrigin,
});
const server = createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: config.frontendOrigin,
    methods: ["GET", "POST"],
  },
});

registerAuctionSocket(io);
publishUpdate = (event) => {
  io.to(auctionRoom(event.auctionId)).emit("auction:updated", event);
};

server.listen(config.port, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "server_started",
      port: config.port,
      environment: config.nodeEnv,
    })
  );
});

async function shutdown(signal) {
  console.log(
    JSON.stringify({ level: "info", event: "shutdown_started", signal })
  );
  io.close();
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
