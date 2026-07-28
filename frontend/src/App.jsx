import AuctionDetailsPage from "../app/auctions/[id]/page";
import CreateAuctionPage from "../app/auctions/new/page";
import HomePage from "../app/page";
import { Navigate, Router, usePathname } from "./router";

function RouteView() {
  const pathname = usePathname();

  if (pathname === "/") return <HomePage />;
  if (pathname === "/auctions/new") return <CreateAuctionPage />;
  if (/^\/auctions\/[^/]+$/.test(pathname)) return <AuctionDetailsPage />;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Router>
      <RouteView />
    </Router>
  );
}
