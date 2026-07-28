const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function auctionRoom(auctionId) {
  return `auction:${auctionId}`;
}

export function registerAuctionSocket(io) {
  io.on("connection", (socket) => {
    socket.on("auction:join", ({ auctionId } = {}, acknowledge) => {
      if (!UUID_PATTERN.test(auctionId || "")) {
        acknowledge?.({ ok: false, error: "Invalid auction ID." });
        return;
      }

      socket.join(auctionRoom(auctionId));
      acknowledge?.({ ok: true });
    });

    socket.on("auction:leave", ({ auctionId } = {}) => {
      if (UUID_PATTERN.test(auctionId || "")) {
        socket.leave(auctionRoom(auctionId));
      }
    });
  });
}
