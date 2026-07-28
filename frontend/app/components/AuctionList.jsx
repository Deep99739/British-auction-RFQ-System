import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "../../src/router";
import { demoAuctions } from "../data/demoAuctions";
import { listAuctions, USE_API } from "../services/auctionApi";

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function statusLabel(status) {
  return {
    ACTIVE: "Active",
    CLOSED: "Closed",
    FORCE_CLOSED: "Force Closed",
    SCHEDULED: "Scheduled",
  }[status] ?? status;
}

function statusClass(status) {
  return statusLabel(status).toLowerCase().replaceAll(" ", "-");
}

export default function AuctionList() {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [auctions, setAuctions] = useState(demoAuctions);
  const [loading, setLoading] = useState(USE_API);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    if (!USE_API) return;

    setLoading(true);
    setLoadError("");
    try {
      setAuctions(await listAuctions());
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!USE_API) return undefined;

    let cancelled = false;
    listAuctions()
      .then((result) => {
        if (!cancelled) setAuctions(result);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleAuctions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return auctions.filter((auction) => {
      const label = statusLabel(auction.status);
      const matchesStatus =
        filter === "All" ||
        (filter === "Closed"
          ? label === "Closed" || label === "Force Closed"
          : label === filter);
      const matchesQuery =
        !normalizedQuery ||
        `${auction.referenceId} ${auction.name} ${auction.lane}`
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [auctions, filter, query]);

  return (
    <>
      <div className="filter-row" aria-label="Auction filters">
        <div className="segmented-control">
          {["All", "Active", "Closed"].map((item) => (
            <button
              type="button"
              key={item}
              className={filter === item ? "is-selected" : ""}
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="search-field">
          <span className="visually-hidden">Search auctions</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, ID or lane"
          />
        </label>
      </div>

      {loadError && (
        <div className="inline-alert error-alert" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={load}>
            Try again
          </button>
        </div>
      )}

      <section className="data-section" aria-labelledby="auction-table-title">
        <div className="section-heading-row">
          <div>
            <h2 id="auction-table-title">RFQ auctions</h2>
            <p>
              {loading ? "Loading auctions…" : `${visibleAuctions.length} `}{" "}
              {visibleAuctions.length === 1 ? "auction" : "auctions"} shown
            </p>
          </div>
          <span className="data-freshness">
            {USE_API ? "Connected to auction API" : "Preview dataset"}
          </span>
        </div>

        {!loading && visibleAuctions.length > 0 ? (
          <div className="table-scroll">
            <table className="auction-table">
              <thead>
                <tr>
                  <th scope="col">RFQ / Reference</th>
                  <th scope="col">Lowest bid</th>
                  <th scope="col">Current close</th>
                  <th scope="col">Forced close</th>
                  <th scope="col">Bids</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="visually-hidden">Open auction</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleAuctions.map((auction) => (
                  <tr key={auction.id}>
                    <td>
                      <Link
                        className="rfq-link"
                        href={`/auctions/${auction.id}`}
                      >
                        <strong>{auction.name}</strong>
                        <span>
                          <code>{auction.referenceId}</code>
                          <span aria-hidden="true"> · </span>
                          {auction.lane}
                        </span>
                      </Link>
                    </td>
                    <td className="money-cell">
                      {auction.lowestBid
                        ? moneyFormatter.format(Number(auction.lowestBid))
                        : "No bids"}
                    </td>
                    <td>{dateFormatter.format(new Date(auction.currentCloseAt))}</td>
                    <td>{dateFormatter.format(new Date(auction.forcedCloseAt))}</td>
                    <td>{auction.bidCount}</td>
                    <td>
                      <span
                        className={`status-label status-${statusClass(
                          auction.status
                        )}`}
                      >
                        {statusLabel(auction.status)}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="row-action"
                        href={`/auctions/${auction.id}`}
                        aria-label={`Open ${auction.name}`}
                      >
                        Open <span aria-hidden="true">→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : loading ? (
          <div className="loading-state" aria-live="polite">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="empty-state">
            <h3>No matching auctions</h3>
            <p>Try a different search term or auction status.</p>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setFilter("All");
                setQuery("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </>
  );
}
