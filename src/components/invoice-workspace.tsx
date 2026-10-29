"use client";
import Link from "next/link";
import { useState } from "react";
import { modules } from "@/config/modules";
import {
  balanceFor,
  documentTotal,
  financialYear,
  inr,
} from "@/domain/pricing";
import { canRead, canWrite } from "@/domain/commands";
import { CollectionView } from "./collection-view";
import { QuoteEditor } from "./quote-editor";
import { Settings } from "./settings";
import { useWorkspace } from "./workspace-provider";
import { kitchenCatalog } from "@/domain/kitchen-catalog";
const links = [
  ["", "Dashboard"],
  ["ledger", "Invoice Ledger"],
  ["new", "Raise Invoice"],
  ["notes", "Credit & Debit Notes"],
  ["quotations", "Quotations"],
  ["receipts", "Receipts"],
  ["clients", "Client Directory"],
  ["catalog", "Service Catalog"],
  ["settings", "Invoice Settings"],
];
export function InvoiceWorkspace({ section }: { section: string }) {
  const { workspace, actor, run, busy, error, notice } = useWorkspace();
  const [editor, setEditor] = useState(false);
  const [payment, setPayment] = useState(false);
  const [fy, setFY] = useState("all");
  const tab = section.split("/")[1] ?? "";
  if (!workspace) return null;
  if (!canRead(actor.role, "invoice")) return <p>Access restricted</p>;
  const currentYear = Number(
    financialYear(new Date().toISOString()).slice(0, 4),
  );
  const years = [
    ...new Set([
      financialYear(new Date().toISOString()),
      ...Array.from(
        { length: 6 },
        (_, i) => `${currentYear - i}-${String(currentYear - i + 1).slice(-2)}`,
      ),
      ...workspace.records
        .filter((r) => ["invoice", "quote", "receipt"].includes(r.kind))
        .map((r) => financialYear(r.issuedAt || r.createdAt)),
    ]),
  ]
    .sort()
    .reverse();
  const invoices = workspace.records.filter(
    (r) =>
      r.kind === "invoice" &&
      r.status === "Issued" &&
      (fy === "all" || financialYear(r.issuedAt || r.createdAt) === fy),
  );
  const total = invoices.reduce((s, r) => s + Number(documentTotal(r)), 0);
  const due = invoices.reduce(
    (s, r) => s + Number(balanceFor(r, workspace.records)),
    0,
  );
  const selectedModule = modules.find(
    (m) =>
      m.kind ===
      (
        {
          ledger: "invoice",
          quotations: "quote",
          clients: "customer",
          catalog: "catalog",
          receipts: "invoice",
          notes: "invoice",
        } as Record<string, string>
      )[tab],
  );
  return (
    <div className="billing-layout">
      <aside className="billing-nav">
        <Link href="/" className="billing-brand">
          HUTĀŚANA<small>INVOICE WORKSPACE</small>
        </Link>
        <nav>
          {links.map(([slug, label]) => (
            <Link
              key={slug}
              className={tab === slug ? "active" : ""}
              href={`/invoices${slug ? `/${slug}` : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/">← Back to CRM</Link>
      </aside>
      <main className="billing-main">
        <header className="billing-header">
          <span>Business / Invoices</span>
          <label className="billing-year">
            {actor.role} · Financial year{" "}
            <select
              aria-label="Financial year"
              value={fy}
              onChange={(e) => setFY(e.target.value)}
            >
              <option value="all">All financial years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </header>
        <div className="billing-content">
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          {notice && <p role="status">{notice}</p>}
          {tab === "" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR BILLING AT A GLANCE</span>
                  <h1>Invoice workspace</h1>
                  <p>From a kitchen specification to a payment received.</p>
                </div>
              </div>
              <div className="stats-grid">
                {[
                  ["Net invoiced", total],
                  ["Amount collected", total - due],
                  ["Outstanding", due],
                  [
                    "Average invoice",
                    invoices.length ? total / invoices.length : 0,
                  ],
                ].map(([label, value]) => (
                  <article className="stat-card" key={label}>
                    <p>{label}</p>
                    <strong>{inr(value)}</strong>
                  </article>
                ))}
              </div>
              <div className="billing-actions">
                {[
                  ["new", "Raise Invoice"],
                  ["quotations", "New Quotation"],
                  ["receipts", "Record Payment"],
                  ["catalog", "Service Catalog"],
                ].map(([slug, label]) => (
                  <Link
                    className="button secondary"
                    href={`/invoices/${slug}`}
                    key={slug}
                  >
                    {label} →
                  </Link>
                ))}
              </div>
              <CollectionView
                module={modules.find((m) => m.kind === "invoice")!}
                financialYearFilter={fy}
              />
            </>
          )}
          {tab === "new" && (
            <section className="panel billing-start">
              <h1>Raise Invoice</h1>
              <p>
                Add a client, kitchen specification, dimensions and payment
                terms. Preview the document as you work.
              </p>
              <button
                className="button primary"
                onClick={() => setEditor(true)}
                disabled={!canWrite(actor.role, "invoice")}
              >
                Open invoice builder
              </button>
            </section>
          )}
          {tab === "catalog" && canWrite(actor.role, "catalog") && (
            <section className="billing-actions">
              <button
                disabled={busy}
                className="button secondary"
                onClick={async () => {
                  const existing = new Set(
                    workspace.records
                      .filter((r) => r.kind === "catalog")
                      .map((r) => r.sku),
                  );
                  const records = kitchenCatalog().filter(
                    (r) => !existing.has(r.sku),
                  );
                  if (records.length) await run({ type: "import", records });
                }}
              >
                Load kitchen starter catalog
              </button>
              <small>
                Draft items with units and measurement guidance. Enter your
                selling rates before publishing.
              </small>
            </section>
          )}
          {tab === "notes" && (
            <div className="info-note">
              Open an issued invoice to append a credit adjustment. The original
              invoice and payment history remain available.
            </div>
          )}
          {tab === "receipts" && canWrite(actor.role, "receipt") && (
            <button className="button primary" onClick={() => setPayment(true)}>
              Record Payment / Advance
            </button>
          )}
          {selectedModule && (
            <CollectionView
              key={tab}
              module={selectedModule}
              financialYearFilter={fy}
              initialTab={tab === "receipts" ? "receipt" : "invoice"}
            />
          )}
          {tab === "settings" && <Settings />}
        </div>
      </main>
      {editor && <QuoteEditor invoice onClose={() => setEditor(false)} />}
      {payment && <PaymentForm onClose={() => setPayment(false)} />}
    </div>
  );
}
function PaymentForm({ onClose }: { onClose: () => void }) {
  const { workspace, run, busy, error } = useWorkspace();
  const [customerId, setCustomerId] = useState("");
  return (
    <div className="billing-payment">
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          if (
            await run({
              type: "receive",
              customerId: String(data.get("customer")),
              invoiceId: String(data.get("invoice")) || undefined,
              amount: String(data.get("amount")),
              reference: String(data.get("reference")),
              receivedOn: String(data.get("date")),
            })
          )
            onClose();
        }}
      >
        <h2>Record client payment</h2>
        <label>
          Client
          <select name="customer" required value={customerId} onChange={e=>setCustomerId(e.target.value)}>
            <option value="">Select client</option>
            {workspace?.records
              .filter((r) => r.kind === "customer")
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Invoice (leave blank for advance)
          <select name="invoice" key={customerId}>
            <option value="">Advance / on account</option>
            {workspace?.records
              .filter((r) => r.kind === "invoice" && r.status === "Issued" && r.customerId === customerId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} · {r.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Amount ₹
          <input name="amount" type="number" min="0.01" step="0.01" required />
        </label>
        <label>
          Payment date
          <input
            name="date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </label>
        <label>
          Bank / UPI / cash reference
          <input name="reference" required maxLength={200} />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="button-group">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            Confirm payment
          </button>
        </div>
      </form>
    </div>
  );
}
