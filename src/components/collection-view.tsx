"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  Download,
  Upload,
  List,
  Columns3,
  ArrowUpRight,
  FileText,
} from "lucide-react";
import type { CRMRecord } from "@/domain/types";
import { recordSchema } from "@/domain/types";
import type { Module } from "@/config/modules";
import { canWrite, collectionSummary } from "@/domain/commands";
import {
  balanceFor,
  businessDate,
  documentTotal,
  financialYear,
  inr,
} from "@/domain/pricing";
import { downloadText, exportCSV, parseCSV } from "@/domain/csv";
import { useWorkspace } from "./workspace-provider";
import { Avatar, Badge, Empty, FilterBar, Modal } from "./ui";
import { RecordForm } from "./record-form";
import { QuoteEditor } from "./quote-editor";
import { RecordDetail } from "./record-detail";

export function CollectionView({
  module,
  initialTab = "invoice",
  financialYearFilter = "all",
  inlineDetails = false,
}: {
  module: Module;
  initialTab?: string;
  financialYearFilter?: string;
  inlineDetails?: boolean;
}) {
  const { workspace, actor, run, busy, error } = useWorkspace();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [board, setBoard] = useState(false),
    [tab, setTab] = useState(initialTab),
    [editing, setEditing] = useState<CRMRecord | null | undefined>(),
    [selected, setSelected] = useState<CRMRecord | null>(null),
    [importOpen, setImportOpen] = useState(false),
    [csv, setCSV] = useState(""),
    [preview, setPreview] = useState<CRMRecord[]>([]),
    [importError, setImportError] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("record");
    if (id) {
      const r = workspace?.records.find((r) => r.id === id);
      if (r) {
        const t = setTimeout(() => setSelected(r), 0);
        return () => clearTimeout(t);
      }
    }
  }, [workspace]);
  if (!workspace) return null;
  const kind =
    module.kind === "invoice" && tab === "receipt" ? "receipt" : module.kind;
  const records = workspace.records.filter((r) => r.kind === kind);
  const customer = (r: CRMRecord) =>
    workspace.records.find((c) => c.id === r.customerId)?.name ?? "";
  const filtered = records.filter(
    (r) =>
      (financialYearFilter === "all" ||
        !["invoice", "quote", "receipt"].includes(r.kind) ||
        financialYear(
          r.issuedAt ||
            (r.kind === "receipt" ? r.dueDate : undefined) ||
            r.createdAt,
        ) === financialYearFilter) &&
      (!status || r.status === status) &&
      `${r.name} ${customer(r)} ${r.phone ?? ""} ${r.locality ?? ""} ${r.number ?? ""} ${r.sku ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const writable = canWrite(actor.role, kind),
    financial = kind === "quote" || kind === "invoice";
  const summary =
    workspace.financialSummary ?? collectionSummary(workspace.records);
  const readImport = () => {
    try {
      const parsed = parseCSV(csv);
      const now = new Date().toISOString();
      const allowed = [
        "name",
        "phone",
        "email",
        "address",
        "locality",
        "source",
        "budget",
        "brand",
        "sku",
        "category",
        "unit",
        "rate",
        "cost",
        "taxRate",
        "hsn",
        "supplier",
        "warranty",
        "notes",
      ];
      const next = parsed.map((row, index) => {
        if (!row.name) throw new Error(`Row ${index + 2} needs a name.`);
        for (const key of Object.keys(row))
          if (!allowed.includes(key))
            throw new Error(`Unsupported import column: ${key}`);
        const clean = Object.fromEntries(
          Object.entries(row).filter(([, v]) => v !== ""),
        );
        return recordSchema.parse({
          ...clean,
          id: crypto.randomUUID(),
          kind,
          status: module.statuses[0],
          createdAt: now,
          updatedAt: now,
        });
      });
      setPreview(next);
      setImportError("");
    } catch (e) {
      setPreview([]);
      setImportError(e instanceof Error ? e.message : "Invalid CSV");
    }
  };
  const exportRecords = () =>
    downloadText(
      exportCSV(filtered as unknown as Record<string, unknown>[], [
        "name",
        "status",
        "number",
        "customerId",
        "phone",
        "locality",
        "source",
        "budget",
        "amount",
        "rate",
        "unit",
        "dueDate",
        "notes",
      ]),
      `hutashana-${module.slug}-${businessDate()}.csv`,
    );
  const value = (r: CRMRecord) =>
    financial
      ? documentTotal(r)
      : r.kind === "catalog"
        ? r.rate
        : (r.budget ?? r.amount);
  if (inlineDetails && selected)
    return (
      <RecordDetail
        inline
        record={selected}
        onClose={() => setSelected(null)}
        onEdit={(r) => {
          setSelected(null);
          setEditing(r);
        }}
      />
    );
  if (inlineDetails && editing !== undefined && financial)
    return (
      <QuoteEditor
        inline
        invoice={kind === "invoice"}
        record={editing ?? undefined}
        onClose={() => setEditing(undefined)}
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{module.group.toUpperCase()}</span>
          <h1>{module.label}</h1>
          <p>{module.description}</p>
        </div>
        <div className="button-group">
          <button className="button secondary" onClick={exportRecords}>
            <Download size={16} />
            Export
          </button>
          {writable && ["lead", "customer", "catalog"].includes(kind) && (
            <button
              className="button secondary"
              onClick={() => {
                setImportOpen(true);
                setPreview([]);
                setCSV("");
              }}
            >
              <Upload size={16} />
              Import
            </button>
          )}
          {writable && kind !== "receipt" && (
            <button className="button primary" onClick={() => setEditing(null)}>
              <Plus size={17} />
              New {module.singular.toLowerCase()}
            </button>
          )}
        </div>
      </div>
      {module.kind === "invoice" && (
        <>
          <div className="mini-stats">
            <div>
              <span>Outstanding receivables</span>
              <strong>{inr(summary.outstanding)}</strong>
            </div>
            <div>
              <span>Gross collections</span>
              <strong>{inr(summary.gross)}</strong>
            </div>
            <div>
              <span>Refunds</span>
              <strong>{inr(summary.refunds)}</strong>
            </div>
            <div>
              <span>Unapplied advances</span>
              <strong>{inr(summary.advances)}</strong>
            </div>
          </div>
          <div className="tabs">
            <button
              className={tab === "invoice" ? "active" : ""}
              onClick={() => {
                setTab("invoice");
                setStatus("");
              }}
            >
              Invoices{" "}
              <span>
                {workspace.records.filter((r) => r.kind === "invoice").length}
              </span>
            </button>
            <button
              className={tab === "receipt" ? "active" : ""}
              onClick={() => {
                setTab("receipt");
                setStatus("");
              }}
            >
              Receipts & allocations{" "}
              <span>
                {workspace.records.filter((r) => r.kind === "receipt").length}
              </span>
            </button>
          </div>
        </>
      )}
      <section className="panel collection-panel">
        <div className="collection-topline">
          <div className="tabs simple">
            <span className="active">
              {kind === "receipt"
                ? "Payment ledger"
                : `All ${module.label.toLowerCase()}`}
            </span>
          </div>
          {["lead", "project", "task"].includes(kind) && (
            <div className="view-toggle">
              <button
                aria-label="List view"
                className={!board ? "active" : ""}
                onClick={() => setBoard(false)}
              >
                <List size={16} />
              </button>
              <button
                aria-label="Board view"
                className={board ? "active" : ""}
                onClick={() => setBoard(true)}
              >
                <Columns3 size={16} />
              </button>
            </div>
          )}
        </div>
        <FilterBar
          search={search}
          setSearch={setSearch}
          status={status}
          setStatus={setStatus}
          statuses={
            kind === "receipt" ? ["Confirmed", "Reversed"] : module.statuses
          }
          count={filtered.length}
        />
        {!filtered.length ? (
          <Empty
            title={
              search || status
                ? "No matching records"
                : `Your ${module.label.toLowerCase()} start here`
            }
            description={
              search || status
                ? "Try another search or status filter."
                : kind === "receipt"
                  ? "Record a payment from an issued invoice."
                  : "Add a record or import your existing data."
            }
          />
        ) : board && ["lead", "project", "task"].includes(kind) ? (
          <div className="kanban">
            {module.statuses
              .filter(
                (s) =>
                  !["Lost", "On hold", "Completed"].includes(s) ||
                  filtered.some((r) => r.status === s),
              )
              .map((stage) => (
                <div className="kanban-column" key={stage}>
                  <div className="kanban-title">
                    <span>{stage}</span>
                    <b>{filtered.filter((r) => r.status === stage).length}</b>
                  </div>
                  {filtered
                    .filter((r) => r.status === stage)
                    .map((r) => (
                      <button
                        className="kanban-card"
                        key={r.id}
                        onClick={() => setSelected(r)}
                      >
                        <Avatar name={r.name} small />
                        <h3>{r.name}</h3>
                        <p>{r.locality ?? customer(r)}</p>
                        {value(r) && <strong>{inr(value(r)!)}</strong>}
                        <div>
                          <span>{r.source ?? r.owner ?? "Unassigned"}</span>
                          <ArrowUpRight size={14} />
                        </div>
                      </button>
                    ))}
                </div>
              ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="records-table">
              <thead>
                <tr>
                  <th>
                    {kind === "catalog"
                      ? "Item / specification"
                      : kind === "invoice"
                        ? "Invoice / customer"
                        : kind === "receipt"
                          ? "Receipt / reference"
                          : "Name / details"}
                  </th>
                  <th>
                    {["catalog", "purchase"].includes(kind)
                      ? "Brand / supplier"
                      : kind === "lead"
                        ? "Source"
                        : "Customer / owner"}
                  </th>
                  <th>Status</th>
                  <th>{kind === "catalog" ? "Rate / unit" : "Value"}</th>
                  <th>
                    {kind === "invoice"
                      ? "Outstanding"
                      : kind === "lead"
                        ? "Locality"
                        : "Due / target"}
                  </th>
                  <th>Next step</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const overdue =
                    !!r.dueDate &&
                    r.dueDate < businessDate() &&
                    !["Done", "Completed", "Resolved"].includes(r.status);
                  return (
                    <tr key={r.id}>
                      <td>
                        <button
                          className="record-name"
                          onClick={() => setSelected(r)}
                        >
                          {financial ? (
                            <span className="file-icon">
                              <FileText size={18} />
                            </span>
                          ) : (
                            <Avatar name={r.name} />
                          )}
                          <span>
                            <strong>{r.name}</strong>
                            <small>
                              {r.number ??
                                r.sku ??
                                r.phone ??
                                customer(r) ??
                                "—"}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>
                        {kind === "catalog" ? (
                          (r.brand ?? "—")
                        ) : kind === "purchase" ? (
                          (r.supplier ?? "—")
                        ) : kind === "lead" ? (
                          <span className="source-label">
                            <span
                              className={`source-dot ${(r.source ?? "").toLowerCase().includes("meta") ? "blue" : ""}`}
                            />
                            {r.source ?? "Manual"}
                          </span>
                        ) : (
                          <>
                            <span>
                              {customer(r) || r.owner || "Unassigned"}
                            </span>
                            {r.owner && customer(r) && <small>{r.owner}</small>}
                          </>
                        )}
                      </td>
                      <td>
                        <Badge>
                          {r.kind === "invoice" &&
                          r.status === "Issued" &&
                          balanceFor(r, workspace.records) === "0.00"
                            ? "Paid"
                            : r.status}
                        </Badge>
                      </td>
                      <td className="amount">
                        {value(r) ? inr(value(r)!) : "—"}
                        {kind === "catalog" && (
                          <small>per {r.unit ?? "unit"}</small>
                        )}
                      </td>
                      <td>
                        {kind === "invoice" ? (
                          <span
                            className={
                              Number(balanceFor(r, workspace.records)) > 0 &&
                              overdue
                                ? "overdue-text"
                                : "amount"
                            }
                          >
                            {inr(balanceFor(r, workspace.records))}
                          </span>
                        ) : kind === "lead" ? (
                          (r.locality ?? "—")
                        ) : (
                          <span className={overdue ? "overdue-text" : ""}>
                            {r.dueDate ?? "Not set"}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="table-action"
                          onClick={() => setSelected(r)}
                        >
                          {financial
                            ? "View document"
                            : kind === "lead"
                              ? "Follow up"
                              : "View details"}
                          <ArrowUpRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>
            Showing {filtered.length} of {records.length} records
          </span>
          <span>
            {kind === "receipt"
              ? "Confirmed receipts are allocated; corrections preserve history."
              : "Every detail has a place."}
          </span>
        </div>
      </section>
      {editing !== undefined &&
        (financial ? (
          <QuoteEditor
            invoice={kind === "invoice"}
            record={editing ?? undefined}
            onClose={() => setEditing(undefined)}
          />
        ) : (
          <RecordForm
            kind={kind}
            record={editing ?? undefined}
            onClose={() => setEditing(undefined)}
          />
        ))}
      {selected && (
        <RecordDetail
          record={selected}
          onClose={() => setSelected(null)}
          onEdit={(r) => {
            setSelected(null);
            setEditing(r);
          }}
        />
      )}
      {importOpen && (
        <Modal
          title={`Import ${module.label.toLowerCase()}`}
          onClose={() => setImportOpen(false)}
        >
          <div className="modal-body">
            <p className="muted">
              Upload UTF-8 CSV with a name column. Up to 250 records per batch.
              New leads and catalog items start in their initial status; consent
              is not inferred.
            </p>
            <button
              className="button secondary"
              onClick={() =>
                downloadText(
                  kind === "catalog"
                    ? "name,sku,brand,category,unit,rate,cost,taxRate,hsn,supplier\n"
                    : "name,phone,email,locality,source,budget,notes\n",
                  `${kind}-import-template.csv`,
                )
              }
            >
              Download template
            </button>
            <label className="file-upload">
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 1_000_000) {
                      setImportError("CSV must be smaller than 1 MB.");
                      return;
                    }
                    setCSV(await file.text());
                    setPreview([]);
                  }
                }}
              />
            </label>
            <textarea
              className="csv-input"
              rows={8}
              aria-label="CSV content"
              placeholder="name,phone,locality"
              value={csv}
              onChange={(e) => {
                setCSV(e.target.value);
                setPreview([]);
              }}
            />
            {importError && <div className="alert">{importError}</div>}
            {error && <div className="alert">{error}</div>}
            {preview.length > 0 && (
              <div className="import-preview">
                <h3>{preview.length} records ready for review</h3>
                {preview.slice(0, 8).map((r) => (
                  <div className="audit-row" key={r.id}>
                    <span>{r.name}</span>
                    <Badge>{r.status}</Badge>
                  </div>
                ))}
                {preview.length > 8 && (
                  <small>and {preview.length - 8} more</small>
                )}
              </div>
            )}
          </div>
          <footer className="modal-footer">
            <button className="button secondary" onClick={readImport}>
              Validate & preview
            </button>
            <button
              className="button primary"
              disabled={!preview.length || busy}
              onClick={async () => {
                if (await run({ type: "import", records: preview }))
                  setImportOpen(false);
              }}
            >
              Import {preview.length || ""} records
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}
