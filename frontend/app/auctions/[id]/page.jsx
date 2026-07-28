import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { io } from "socket.io-client";
import { Link, useParams } from "../../../src/router";
import AppShell from "../../components/AppShell";
import {
  createDemoAuction,
  DEMO_AUCTION_ID,
} from "../../data/demoAuctions";
import {
  API_BASE_URL,
  getAuction,
  placeBid,
  USE_API,
} from "../../services/auctionApi";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const initialBidForm = {
  supplierName: "",
  freightAmount: "",
  originAmount: "",
  destinationAmount: "",
  transitDays: "",
  validUntil: "",
};

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function secondsUntil(value) {
  return Math.max(
    0,
    Math.floor((new Date(value).getTime() - Date.now()) / 1000)
  );
}

function triggerLabel(triggerType) {
  return {
    BID_RECEIVED: "Any bid received",
    ANY_RANK_CHANGE: "Any supplier rank change",
    L1_CHANGE: "L1 supplier change",
  }[triggerType];
}

function activityMarker(type) {
  if (type === "AUCTION_EXTENDED") return "extension";
  if (type === "RANK_CHANGED") return "rank";
  return "bid";
}

export default function AuctionDetailsPage() {
  const params = useParams();
  const auctionId = params?.id || DEMO_AUCTION_ID;
  const [auction, setAuction] = useState(createDemoAuction);
  const [remainingSeconds, setRemainingSeconds] = useState(18 * 60 + 42);
  const [loading, setLoading] = useState(USE_API);
  const [loadError, setLoadError] = useState("");
  const [connectionState, setConnectionState] = useState(
    USE_API ? "Connecting" : "Preview mode"
  );
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [newBidId, setNewBidId] = useState(null);
  const [bidForm, setBidForm] = useState(initialBidForm);

  const loadAuction = useCallback(async () => {
    if (!USE_API) return;

    try {
      const latestAuction = await getAuction(auctionId);
      setLoadError("");
      setAuction(latestAuction);
      setRemainingSeconds(secondsUntil(latestAuction.currentCloseAt));
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadAuction, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadAuction]);

  useEffect(() => {
    if (!USE_API) return undefined;

    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setConnectionState("Live");
      socket.emit("auction:join", { auctionId });
    });
    socket.on("disconnect", () => setConnectionState("Reconnecting"));
    socket.on("connect_error", () => setConnectionState("Offline"));
    socket.on("auction:updated", (event) => {
      // Realtime events are invalidations; REST remains the source of truth.
      if (event.auctionId === auctionId) loadAuction();
    });

    return () => {
      socket.emit("auction:leave", { auctionId });
      socket.disconnect();
    };
  }, [auctionId, loadAuction]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!newBidId) return undefined;
    const timer = window.setTimeout(() => setNewBidId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [newBidId]);

  const rankedBids = useMemo(
    () =>
      [...(auction.rankings || [])].sort(
        (first, second) =>
          Number(first.totalAmount) - Number(second.totalAmount)
      ),
    [auction.rankings]
  );

  const lowestBid = Number(rankedBids[0]?.totalAmount || 0);
  const quotedTotal =
    Number(bidForm.freightAmount || 0) +
    Number(bidForm.originAmount || 0) +
    Number(bidForm.destinationAmount || 0);
  const extensionCapacityMinutes = Math.max(
    0,
    Math.round(
      (new Date(auction.forcedCloseAt).getTime() -
        new Date(auction.initialCloseAt).getTime()) /
        60_000
    )
  );
  const extensionUsedMinutes = Math.max(
    0,
    Math.round(
      (new Date(auction.currentCloseAt).getTime() -
        new Date(auction.initialCloseAt).getTime()) /
        60_000
    )
  );
  const extensionProgress = extensionCapacityMinutes
    ? Math.min(100, (extensionUsedMinutes / extensionCapacityMinutes) * 100)
    : 0;

  function updateBidField(event) {
    const { name, value } = event.target;
    setBidForm((current) => ({ ...current, [name]: value }));
    setNotice(null);
  }

  async function submitBid(event) {
    event.preventDefault();

    if (
      !bidForm.supplierName.trim() ||
      quotedTotal <= 0 ||
      !bidForm.transitDays ||
      !bidForm.validUntil
    ) {
      setNotice({
        type: "error",
        text: "Complete all quote fields before submitting.",
      });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      if (USE_API) {
        const result = await placeBid(auctionId, bidForm);
        setAuction(result.auction);
        setRemainingSeconds(secondsUntil(result.auction.currentCloseAt));
        setNewBidId(
          result.auction.rankings.find(
            (bid) =>
              bid.supplierName.toLowerCase() ===
              bidForm.supplierName.trim().toLowerCase()
          )?.bidId
        );
        setNotice({
          type: "success",
          text: result.duplicate
            ? "This bid was already accepted; the current state has been restored."
            : result.extension
              ? "Bid accepted. The trigger fired and the close time was extended."
              : "Bid accepted and the live ranking is up to date.",
        });
      } else {
        const bidId = `demo-${Date.now()}`;
        const supplierName = bidForm.supplierName.trim();
        const currentLeaderId = rankedBids[0]?.supplierId;
        const supplierId = `demo-${supplierName
          .toLowerCase()
          .replaceAll(/[^a-z0-9]+/g, "-")}`;
        const nextBid = {
          bidId,
          supplierId,
          supplierName,
          freightAmount: Number(bidForm.freightAmount).toFixed(2),
          originAmount: Number(bidForm.originAmount).toFixed(2),
          destinationAmount: Number(bidForm.destinationAmount).toFixed(2),
          totalAmount: quotedTotal.toFixed(2),
          transitDays: Number(bidForm.transitDays),
          validUntil: bidForm.validUntil,
          submittedAt: new Date().toISOString(),
        };
        const nextRankings = [
          ...rankedBids.filter((bid) => bid.supplierId !== supplierId),
          nextBid,
        ].sort(
          (first, second) =>
            Number(first.totalAmount) - Number(second.totalAmount)
        );
        const isNewLeader =
          currentLeaderId !== nextRankings[0]?.supplierId;
        const currentClose = new Date(auction.currentCloseAt);
        const forcedClose = new Date(auction.forcedCloseAt);
        const nextClose = isNewLeader
          ? new Date(
              Math.min(
                currentClose.getTime() +
                  auction.extensionDurationMinutes * 60_000,
                forcedClose.getTime()
              )
            )
          : currentClose;
        const newActivity = [
          {
            id: `activity-${Date.now()}`,
            createdAt: new Date().toISOString(),
            message: isNewLeader
              ? `${supplierName} became the L1 supplier.`
              : `${supplierName} submitted a quote.`,
            detail: `Total quotation: ${moneyFormatter.format(quotedTotal)}.`,
            type: isNewLeader ? "RANK_CHANGED" : "BID_SUBMITTED",
          },
          ...(isNewLeader
            ? [
                {
                  id: `extension-${Date.now()}`,
                  createdAt: new Date().toISOString(),
                  message: `Auction close extended by ${auction.extensionDurationMinutes} minutes.`,
                  detail:
                    "L1 supplier changed. The forced close remains unchanged.",
                  type: "AUCTION_EXTENDED",
                },
              ]
            : []),
          ...(auction.activity || []),
        ];

        setAuction((current) => ({
          ...current,
          currentCloseAt: nextClose.toISOString(),
          lowestBid: nextRankings[0]?.totalAmount,
          bidCount: current.bidCount + 1,
          rankings: nextRankings.map((bid, index) => ({
            ...bid,
            rank: index + 1,
          })),
          activity: newActivity,
        }));
        setRemainingSeconds(secondsUntil(nextClose));
        setNewBidId(bidId);
        setNotice({
          type: "success",
          text: isNewLeader
            ? "Bid accepted. The new L1 position extended the auction."
            : "Bid accepted and the ranking has been refreshed.",
        });
      }

      setBidForm(initialBidForm);
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell active="auctions">
      <div className="page-frame details-page">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Auctions</Link>
          <span aria-hidden="true">/</span>
          <span>{auction.referenceId}</span>
        </nav>

        {loadError && (
          <div className="inline-alert error-alert" role="alert">
            <span>{loadError}</span>
            <button type="button" onClick={loadAuction}>
              Try again
            </button>
          </div>
        )}

        <header className="auction-detail-header">
          <div>
            <div className="title-line">
              <p className="eyebrow">{auction.referenceId}</p>
              <span className="status-label status-active">
                {auction.status === "ACTIVE" ? "Active" : auction.status}
              </span>
            </div>
            <h1>{auction.name}</h1>
            <p className="route-line">
              {auction.origin || "Nhava Sheva, India"}
              <span aria-hidden="true">→</span>
              {auction.destination || "Rotterdam, Netherlands"}
            </p>
          </div>
          <div className="header-actions">
            <span className="connection-label">
              <span className="live-dot" aria-hidden="true" />
              {connectionState}
            </span>
            <Link className="secondary-button" href="/auctions/new">
              Duplicate RFQ
            </Link>
          </div>
        </header>

        <section className="auction-stage" aria-label="Live auction summary">
          <div className="stage-price">
            <span className="stage-label">Current leading quote</span>
            <strong>{moneyFormatter.format(lowestBid)}</strong>
            <span className="leader-name">
              <span aria-hidden="true">L1</span>
              {rankedBids[0]?.supplierName || "No supplier yet"}
            </span>
          </div>

          <div className="stage-clock">
            <span className="stage-label">Bidding closes in</span>
            <strong className="countdown" aria-live="off">
              {loading ? "--:--:--" : formatCountdown(remainingSeconds)}
            </strong>
            <span>
              Effective close{" "}
              {dateTimeFormatter.format(new Date(auction.currentCloseAt))}
            </span>
          </div>

          <dl className="stage-facts">
            <div>
              <dt>Valid bids</dt>
              <dd>{auction.bidCount}</dd>
            </div>
            <div>
              <dt>Service date</dt>
              <dd>{dateFormatter.format(new Date(auction.serviceDate))}</dd>
            </div>
            <div>
              <dt>Trigger rule</dt>
              <dd>{triggerLabel(auction.triggerType)}</dd>
            </div>
          </dl>

          <div className="deadline-track">
            <div className="deadline-track-copy">
              <span>
                Extension capacity used: {extensionUsedMinutes} of{" "}
                {extensionCapacityMinutes} minutes
              </span>
              <strong>
                Forced close{" "}
                {dateTimeFormatter.format(new Date(auction.forcedCloseAt))}
              </strong>
            </div>
            <div className="deadline-rail" aria-hidden="true">
              <span style={{ width: `${extensionProgress}%` }} />
            </div>
          </div>
        </section>

        <div className="auction-context-line">
          <span className="live-dot" aria-hidden="true" />
          <strong>Live ranking</strong>
          <span>
            A {triggerLabel(auction.triggerType)?.toLowerCase()} in the final{" "}
            {auction.triggerWindowMinutes} minutes adds{" "}
            {auction.extensionDurationMinutes} minutes.
          </span>
        </div>

        <div className="details-grid">
          <section
            className="data-section leaderboard"
            aria-labelledby="bids-title"
          >
            <div className="section-heading-row leaderboard-heading">
              <div>
                <h2 id="bids-title">Supplier leaderboard</h2>
                <p>Latest quote per supplier, ranked by total landed charge.</p>
              </div>
              <span className="data-freshness">
                Server-authoritative ranking
              </span>
            </div>

            <div className="table-scroll">
              <table className="bid-table">
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Supplier</th>
                    <th scope="col">Total quote</th>
                    <th scope="col">Gap to L1</th>
                    <th scope="col">Freight</th>
                    <th scope="col">Origin</th>
                    <th scope="col">Destination</th>
                    <th scope="col">Transit</th>
                    <th scope="col">Validity</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedBids.map((bid, index) => (
                    <tr
                      className={[
                        index === 0 ? "l1-row" : "",
                        bid.bidId === newBidId ? "new-bid-row" : "",
                      ].join(" ")}
                      key={bid.bidId}
                    >
                      <td>
                        <span className={`rank rank-${index + 1}`}>
                          L{index + 1}
                        </span>
                      </td>
                      <td>
                        <strong className="supplier-name">
                          {bid.supplierName}
                        </strong>
                        <small className="submitted-time">
                          {new Date(bid.submittedAt).toLocaleTimeString(
                            "en-IN",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                              second: "2-digit",
                            }
                          )}
                        </small>
                      </td>
                      <td className="money-cell">
                        {moneyFormatter.format(Number(bid.totalAmount))}
                      </td>
                      <td className={index === 0 ? "leader-gap" : "price-gap"}>
                        {index === 0
                          ? "Leading"
                          : `+${moneyFormatter.format(
                              Number(bid.totalAmount) - lowestBid
                            )}`}
                      </td>
                      <td>
                        {moneyFormatter.format(Number(bid.freightAmount))}
                      </td>
                      <td>
                        {moneyFormatter.format(Number(bid.originAmount))}
                      </td>
                      <td>
                        {moneyFormatter.format(Number(bid.destinationAmount))}
                      </td>
                      <td>{bid.transitDays} days</td>
                      <td>{dateFormatter.format(new Date(bid.validUntil))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="bid-panel" aria-labelledby="submit-quote-title">
            <div className="panel-heading">
              <p className="summary-kicker">Supplier action</p>
              <h2 id="submit-quote-title">Place a revised quote</h2>
              <p>
                Ranking uses freight, origin and destination charges together.
              </p>
            </div>

            <div className="bid-benchmark">
              <span>Quote to beat</span>
              <strong>{moneyFormatter.format(lowestBid)}</strong>
            </div>

            <form onSubmit={submitBid}>
              <div className="field-group">
                <label htmlFor="supplierName">Carrier name</label>
                <input
                  id="supplierName"
                  name="supplierName"
                  value={bidForm.supplierName}
                  onChange={updateBidField}
                  placeholder="Enter carrier name"
                />
              </div>

              <div className="compact-field-grid">
                <div className="field-group">
                  <label htmlFor="freightAmount">Freight</label>
                  <div className="currency-field">
                    <span>₹</span>
                    <input
                      id="freightAmount"
                      name="freightAmount"
                      inputMode="decimal"
                      value={bidForm.freightAmount}
                      onChange={updateBidField}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="field-group">
                  <label htmlFor="originAmount">Origin</label>
                  <div className="currency-field">
                    <span>₹</span>
                    <input
                      id="originAmount"
                      name="originAmount"
                      inputMode="decimal"
                      value={bidForm.originAmount}
                      onChange={updateBidField}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="destinationAmount">Destination</label>
                <div className="currency-field">
                  <span>₹</span>
                  <input
                    id="destinationAmount"
                    name="destinationAmount"
                    inputMode="decimal"
                    value={bidForm.destinationAmount}
                    onChange={updateBidField}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="compact-field-grid">
                <div className="field-group">
                  <label htmlFor="transitDays">Transit time</label>
                  <div className="number-field">
                    <input
                      id="transitDays"
                      name="transitDays"
                      type="number"
                      min="1"
                      value={bidForm.transitDays}
                      onChange={updateBidField}
                      placeholder="24"
                    />
                    <span>days</span>
                  </div>
                </div>
                <div className="field-group">
                  <label htmlFor="validUntil">Quote validity</label>
                  <input
                    id="validUntil"
                    name="validUntil"
                    type="date"
                    value={bidForm.validUntil}
                    onChange={updateBidField}
                  />
                </div>
              </div>

              <div className="quote-total">
                <span>Your total quote</span>
                <strong>{moneyFormatter.format(quotedTotal)}</strong>
              </div>

              {quotedTotal > 0 && lowestBid > 0 && (
                <p className="quote-position">
                  {quotedTotal < lowestBid
                    ? `${moneyFormatter.format(
                        lowestBid - quotedTotal
                      )} below the current L1`
                    : `${moneyFormatter.format(
                        quotedTotal - lowestBid
                      )} above the current L1`}
                </p>
              )}

              {notice && (
                <p
                  className={`bid-notice notice-${notice.type}`}
                  role={notice.type === "error" ? "alert" : "status"}
                  aria-live="polite"
                >
                  {notice.text}
                </p>
              )}

              <button
                className="primary-button full-button"
                type="submit"
                disabled={submitting || auction.status !== "ACTIVE"}
              >
                {submitting
                  ? "Submitting…"
                  : quotedTotal > 0
                    ? `Submit ${moneyFormatter.format(quotedTotal)}`
                    : "Submit quote"}
              </button>
              <small className="submit-assurance">
                The server rechecks time, totals and auction rules before
                accepting.
              </small>
            </form>
          </aside>
        </div>

        <div className="lower-grid">
          <section className="plain-section" aria-labelledby="activity-title">
            <div className="section-heading-row">
              <div>
                <h2 id="activity-title">Activity timeline</h2>
                <p>Immutable bid and extension history for this auction.</p>
              </div>
            </div>

            <ol className="activity-list">
              {(auction.activity || []).map((item) => (
                <li key={item.id}>
                  <time>
                    {new Date(item.createdAt).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                  <span
                    className={`activity-marker marker-${activityMarker(
                      item.type
                    )}`}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>{item.message}</strong>
                    {(item.detail || item.metadata?.reason) && (
                      <p>{item.detail || item.metadata.reason}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section
            className="plain-section rules-section"
            aria-labelledby="rules-title"
          >
            <div className="section-heading-row">
              <div>
                <h2 id="rules-title">Auction controls</h2>
                <p>Configuration enforced by the backend.</p>
              </div>
            </div>

            <dl className="rules-list">
              <div>
                <dt>Trigger window (X)</dt>
                <dd>{auction.triggerWindowMinutes} minutes</dd>
              </div>
              <div>
                <dt>Extension duration (Y)</dt>
                <dd>{auction.extensionDurationMinutes} minutes</dd>
              </div>
              <div>
                <dt>Extension trigger</dt>
                <dd>{triggerLabel(auction.triggerType)}</dd>
              </div>
              <div>
                <dt>Ranking basis</dt>
                <dd>Latest total quote, ascending</dd>
              </div>
              <div>
                <dt>Tie-breaker</dt>
                <dd>Earlier submission wins</dd>
              </div>
            </dl>

            <p className="forced-close-note">
              Extensions are capped. Bidding must stop at{" "}
              <strong>
                {dateTimeFormatter.format(new Date(auction.forcedCloseAt))}
              </strong>
              .
            </p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
