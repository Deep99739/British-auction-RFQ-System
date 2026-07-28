import { Link } from "../../src/router";

const navigation = [
  { label: "Auctions", href: "/", short: "AU", key: "auctions" },
  { label: "Create RFQ", href: "/auctions/new", short: "RF", key: "create" },
];

export default function AppShell({ active, children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label="RFQ Console home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <span>
            <strong>RFQ Console</strong>
            <small>British auction RFQs</small>
          </span>
        </Link>

        <nav className="sidebar-nav">
          <p className="nav-label">Procurement</p>
          {navigation.map((item) => (
            <Link
              className={`nav-item ${active === item.key ? "is-active" : ""}`}
              href={item.href}
              key={item.key}
              aria-current={active === item.key ? "page" : undefined}
            >
              <span className="nav-index" aria-hidden="true">
                {item.short}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-context">
          <span className="sidebar-note-label">Workspace</span>
          <strong>RFQ auction workspace</strong>
          <span>Auction times shown in IST</span>
        </div>

        <div className="sidebar-user">
          <span className="user-avatar" aria-hidden="true">
            DK
          </span>
          <span>
            <strong>Procurement team</strong>
            <small>Buyer workspace</small>
          </span>
        </div>
      </aside>

      <div className="mobile-header">
        <Link className="mobile-brand" href="/">
          RFQ Console
        </Link>
        <nav aria-label="Mobile navigation">
          {navigation.map((item) => (
            <Link
              className={active === item.key ? "is-active" : ""}
              href={item.href}
              key={item.key}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="workspace">
        <header className="workspace-bar">
          <div>
            <span className="workspace-bar-label">Procurement operations</span>
            <strong>British auctions</strong>
          </div>
          <div className="workspace-status">
            <span className="live-dot" aria-hidden="true" />
            <span>Realtime ready</span>
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
