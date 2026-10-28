"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  UserRound,
  CheckSquare,
  FileText,
  ReceiptIndianRupee,
  Package,
  Library,
  PanelsTopLeft,
  Ruler,
  Truck,
  Wrench,
  Phone,
  ChartNoAxesCombined,
  Plug,
  Settings,
  Menu,
  X,
  ChevronDown,
  Search,
  ArrowUpRight,
  CircleHelp,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { modules } from "@/config/modules";
import { canRead } from "@/domain/commands";
import { useWorkspace } from "./workspace-provider";
import { Avatar } from "./ui";
const icons = {
  lead: Users,
  customer: UserRound,
  task: CheckSquare,
  quote: FileText,
  invoice: ReceiptIndianRupee,
  catalog: Package,
  clause: Library,
  project: PanelsTopLeft,
  survey: Ruler,
  purchase: Truck,
  service: Wrench,
  call: Phone,
  receipt: ReceiptIndianRupee,
  bom: Package,
  changeOrder: FileText,
};
export function Shell({
  section,
  children,
}: {
  section: string;
  children: ReactNode;
}) {
  const {
    workspace,
    demo,
    actor,
    organizationName,
    error,
    notice,
    clearError,
    refresh,
  } = useWorkspace();
  const [open, setOpen] = useState(false),
    [globalSearch, setGlobalSearch] = useState("");
  const title =
    modules.find((m) => m.slug === section)?.label ??
    {
      dashboard: "Overview",
      reports: "Reports & insights",
      integrations: "Integrations",
      settings: "Settings",
    }[section] ??
    "Workspace";
  const matches =
    globalSearch.length > 1
      ? workspace?.records
          .filter((r) =>
            `${r.name} ${r.phone ?? ""} ${r.number ?? ""}`
              .toLowerCase()
              .includes(globalSearch.toLowerCase()),
          )
          .slice(0, 7)
      : [];
  const nav = (
    href: string,
    label: string,
    Icon: typeof LayoutDashboard,
    count?: number,
  ) => (
    <Link
      key={href}
      className={`nav-item ${section === href ? "active" : ""}`}
      href={href === "dashboard" ? "/" : `/${href}`}
      onClick={() => setOpen(false)}
    >
      <Icon size={18} />
      <span>{label}</span>
      {!!count && <b>{count}</b>}
    </Link>
  );
  return (
    <div className="app-layout">
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" href="/">
          <span className="brand-symbol">
            h<span>•</span>
          </span>
          <div>
            hutāśana<small>BUSINESS WORKSPACE</small>
          </div>
        </Link>
        <button className="workspace-selector">
          <span className="studio-icon">H</span>
          <div>
            {organizationName}
            <small>Kitchen & living studio</small>
          </div>
          <ChevronDown size={14} />
        </button>
        <nav>
          {nav("dashboard", "Overview", LayoutDashboard)}
          {(["Workspace", "Business", "Operations"] as const).map((group) => (
            <div className="nav-group" key={group}>
              <p>{group}</p>
              {modules
                .filter((m) => m.group === group && canRead(actor.role, m.kind))
                .map((m) =>
                  nav(
                    m.slug,
                    m.label,
                    icons[m.kind],
                    m.kind === "lead"
                      ? workspace?.records.filter(
                          (r) => r.kind === "lead" && r.status === "New",
                        ).length
                      : undefined,
                  ),
                )}
            </div>
          ))}
          <div className="nav-group">
            <p>Manage</p>
            {actor.role !== "installer" &&
              nav("reports", "Reports & insights", ChartNoAxesCombined)}
            {actor.role === "owner" &&
              nav("integrations", "Integrations", Plug)}
            {nav("settings", "Settings", Settings)}
          </div>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <CircleHelp size={18} />
            <div>
              <strong>Made for your craft</strong>
              <small>Every detail, in its place.</small>
            </div>
          </div>
          <div className="user-profile">
            <Avatar name={demo ? "Demo Owner" : actor.role} />
            <div>
              <strong>{demo ? "Studio owner" : actor.role}</strong>
              <small>
                {demo ? "Local demo workspace" : "Secure staff session"}
              </small>
            </div>
            {!demo && (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={async () => {
                  await fetch("/api/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "logout" }),
                  });
                  location.reload();
                }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-wrapper">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                aria-label="Search workspace"
                placeholder="Search workspace…"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              <kbd>⌕</kbd>
              {!!matches?.length && (
                <div className="search-results">
                  {matches.map((r) => (
                    <Link
                      key={r.id}
                      href={`/${modules.find((m) => m.kind === r.kind)?.slug ?? "invoices"}?record=${r.id}`}
                      onClick={() => setGlobalSearch("")}
                    >
                      <span>{r.name}</span>
                      <small>{r.kind}</small>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              title="Refresh workspace"
              onClick={refresh}
            >
              <RefreshCw size={16} />
            </button>
            <span className="top-divider" />
            <Avatar name="Hutashana" small />
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <b>DEMO WORKSPACE</b> Fictional clients and rates · saved only in
              this browser · no messages are sent
            </span>
            <Link href="/settings">
              Connect your business
              <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={clearError}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <main className="main-content">
          {children}
          <footer className="page-footer">
            <span>Thoughtfully organised. Beautifully built.</span>
            <span>
              HUTĀŚANA WORKSPACE <span className="footer-dot">•</span> PUNE,
              INDIA
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>✓</span>
          {notice}
        </div>
      )}
    </div>
  );
}
