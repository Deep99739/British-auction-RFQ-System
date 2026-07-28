export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

export const USE_API =
  import.meta.env.VITE_DATA_MODE === "api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      body.error?.message || "The server could not complete the request."
    );
    error.code = body.error?.code;
    error.details = body.error?.details;
    throw error;
  }

  return body.data;
}

export function listAuctions() {
  return request("/api/auctions");
}

export function getAuction(auctionId) {
  return request(`/api/auctions/${auctionId}`);
}

export function createAuction(input) {
  return request("/api/auctions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function placeBid(auctionId, input) {
  return request(`/api/auctions/${auctionId}/bids`, {
    method: "POST",
    headers: {
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
}
