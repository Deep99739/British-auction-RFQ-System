import { Link } from "../src/router";
import AppShell from "./components/AppShell";
import AuctionList from "./components/AuctionList";

export default function HomePage() {
  return (
    <AppShell active="auctions">
      <div className="page-frame">
        <header className="page-header">
          <div>
            <p className="eyebrow">RFQ procurement</p>
            <h1>Auctions</h1>
            <p className="page-intro">
              Monitor active bidding, closing schedules and final supplier
              positions.
            </p>
          </div>
          <Link className="primary-button button-with-arrow" href="/auctions/new">
            Create RFQ <span aria-hidden="true">→</span>
          </Link>
        </header>

        <AuctionList />
      </div>
    </AppShell>
  );
}
