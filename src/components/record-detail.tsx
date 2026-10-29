"use client";
import { useState } from "react";
import {
  Download,
  Pencil,
  CopyPlus,
  ArrowRight,
  CalendarClock,
  ReceiptIndianRupee,
  Paperclip,
} from "lucide-react";
import type { CRMRecord, Command } from "@/domain/types";
import { canWrite, hasCosts, nextStatuses } from "@/domain/commands";
import {
  availableReceipt,
  balanceFor,
  documentTotal,
  inr,
} from "@/domain/pricing";
import { useWorkspace } from "./workspace-provider";
import { Avatar, Badge, Field, Modal } from "./ui";
type Action =
  | "receive"
  | "credit"
  | "reverseReceipt"
  | "refund"
  | "allocate"
  | "unallocate"
  | "receiveGoods"
  | "signoff"
  | "approveChange"
  | "scheduleReminder"
  | "accept"
  | "";
export function RecordDetail({
  record,
  onClose,
  onEdit,
  inline = false,
}: {
  record: CRMRecord;
  onClose: () => void;
  onEdit: (r: CRMRecord) => void;
  inline?: boolean;
}) {
  const { workspace, actor, run, busy, error, demo, notify, refresh } =
    useWorkspace();
  const [action, setAction] = useState<Action>(""),
    [amount, setAmount] = useState(""),
    [reference, setReference] = useState(""),
    [reason, setReason] = useState(""),
    [when, setWhen] = useState(new Date().toISOString().slice(0, 10)),
    [invoiceId, setInvoiceId] = useState(""),
    [downloading, setDownloading] = useState(false),
    [goods, setGoods] = useState<Record<string, string>>({});
  if (!workspace) return null;
  const r = workspace.records.find((v) => v.id === record.id) ?? record;
  const customer = workspace.records.find((c) => c.id === r.customerId),
    project = workspace.records.find((p) => p.id === r.projectId);
  const financial = r.kind === "quote" || r.kind === "invoice",
    writable = canWrite(actor.role, r.kind);
  const editable =
    writable &&
    !["receipt"].includes(r.kind) &&
    (![
      "quote",
      "invoice",
      "catalog",
      "clause",
      "survey",
      "bom",
      "purchase",
      "changeOrder",
    ].includes(r.kind) ||
      r.status === "Draft" ||
      (["bom", "survey"].includes(r.kind) && r.status === "Reviewed"));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let cmd: Command | undefined;
    if (action === "receive")
      cmd = {
        type: "receive",
        invoiceId: r.id,
        amount,
        reference,
        receivedOn: when,
      };
    if (action === "credit" || action === "refund")
      cmd = { type: action, id: r.id, amount, reason };
    if (action === "reverseReceipt")
      cmd = { type: "reverseReceipt", id: r.id, reason };
    if (action === "allocate")
      cmd = { type: "allocate", receiptId: r.id, invoiceId, amount };
    if (action === "unallocate")
      cmd = { type: "unallocate", receiptId: r.id, invoiceId, amount, reason };
    if (action === "receiveGoods")
      cmd = {
        type: "receiveGoods",
        id: r.id,
        reference,
        quantities: Object.entries(goods)
          .filter(([, quantity]) => Number(quantity) > 0)
          .map(([itemId, quantity]) => ({ itemId, quantity })),
      };
    if (action === "signoff" || action === "approveChange")
      cmd = {
        type: "transition",
        id: r.id,
        status: action === "signoff" ? "Signed off" : "Approved",
        evidence: reason,
      };
    if (action === "scheduleReminder")
      cmd = {
        type: "scheduleReminder",
        id: r.id,
        dueAt: new Date(when).toISOString(),
      };
    if (action === "accept")
      cmd = {
        type: "transition",
        id: r.id,
        status: "Accepted",
        evidence: reason,
      };
    if (cmd && (await run(cmd))) {
      setAction("");
      setAmount("");
      setReference("");
      setReason("");
    }
  };
  const download = async () => {
    setDownloading(true);
    try {
      if (demo) {
        const { downloadDocument } = await import("@/lib/documents/download");
        await downloadDocument(r, workspace.settings, true, customer);
      } else {
        const response = await fetch(`/api/documents/${r.id}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error);
        }
        const url = URL.createObjectURL(await response.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = `${r.number ?? r.name}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Document generation failed.");
    } finally {
      setDownloading(false);
    }
  };
  return (
    <Modal
      inline={inline}
      title={r.name}
      wide={financial || r.kind === "customer"}
      onClose={onClose}
    >
      <div className="modal-body detail-body">
        <div className="detail-toolbar">
          <div className="detail-title-meta">
            <Badge>{r.status}</Badge>
            <span>{r.number ?? r.kind.toUpperCase()}</span>
            {r.revision && <span>Revision {r.revision}</span>}
          </div>
          <div className="button-group">
            {(financial || r.kind === "receipt") && (
              <button
                className="button secondary"
                onClick={download}
                disabled={downloading}
              >
                <Download size={15} />
                {downloading ? "Preparing…" : "Download PDF"}
              </button>
            )}
            {editable && (
              <button className="button secondary" onClick={() => onEdit(r)}>
                <Pencil size={15} />
                Edit
              </button>
            )}
          </div>
        </div>
        {financial ? (
          <>
            <div className="document-parties">
              <div>
                <span className="eyebrow">PREPARED FOR</span>
                <h3>
                  {r.snapshot?.customerName ??
                    customer?.name ??
                    "Customer not selected"}
                </h3>
                <p>
                  {r.snapshot?.customerAddress ??
                    customer?.address ??
                    "Add billing address"}
                </p>
                {(r.snapshot?.customerGstin ?? customer?.gstin) && (
                  <p>GSTIN: {r.snapshot?.customerGstin ?? customer?.gstin}</p>
                )}
              </div>
              <div>
                <span className="eyebrow">
                  {r.kind === "invoice"
                    ? "INVOICE DETAILS"
                    : "QUOTATION DETAILS"}
                </span>
                <p>{project?.name ?? "Independent document"}</p>
                <p>
                  {r.kind === "invoice" ? "Payment due" : "Valid until"}:{" "}
                  {r.dueDate ?? "Not set"}
                </p>
                {r.issuedAt && (
                  <p>
                    Issued:{" "}
                    {new Date(r.issuedAt).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </p>
                )}
              </div>
            </div>
            <div className="table-scroll">
              <table className="document-table">
                <thead>
                  <tr>
                    <th>Specification</th>
                    <th>Pricing</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Tax</th>
                    <th className="align-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {r.calculation?.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong>{l.description}</strong>
                        <small>
                          {l.zone}
                          {l.hsn ? ` · HSN/SAC ${l.hsn}` : ""}
                        </small>
                      </td>
                      <td>{l.method}</td>
                      <td>
                        {Number(l.billableQuantity).toFixed(3)} {l.unit}
                      </td>
                      <td>{inr(l.rate)}</td>
                      <td>{l.taxRate}%</td>
                      <td className="align-right">{inr(l.total)}</td>
                    </tr>
                  )) ??
                    r.lines?.map((l) => (
                      <tr key={l.id}>
                        <td>{l.description}</td>
                        <td>{l.method}</td>
                        <td>{l.quantity}</td>
                        <td>{inr(l.rate)}</td>
                        <td>{l.taxRate}%</td>
                        <td>Draft</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="document-summary">
              <dl>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{inr(r.calculation?.subtotal ?? 0)}</dd>
                </div>
                <div>
                  <dt>Discount</dt>
                  <dd>−{inr(r.calculation?.discount ?? 0)}</dd>
                </div>
                <div>
                  <dt>Tax</dt>
                  <dd>{inr(r.calculation?.tax ?? 0)}</dd>
                </div>
                <div className="summary-total">
                  <dt>Document total</dt>
                  <dd>{inr(documentTotal(r))}</dd>
                </div>
                {r.kind === "invoice" && r.status === "Issued" && (
                  <div className="balance-row">
                    <dt>Outstanding</dt>
                    <dd>{inr(balanceFor(r, workspace.records))}</dd>
                  </div>
                )}
              </dl>
            </div>
            {r.credits?.map((c) => (
              <div className="audit-row" key={c.id}>
                <strong>Credit adjustment · {inr(c.amount)}</strong>
                <span>{c.reason}</span>
              </div>
            ))}
            {r.kind === "invoice" && (
              <div className="payment-history">
                {workspace.records
                  .filter(
                    (x) =>
                      x.kind === "receipt" &&
                      x.allocations?.some((a) => a.invoiceId === r.id),
                  )
                  .map((receipt) => (
                    <div className="audit-row" key={receipt.id}>
                      <span>
                        {receipt.reference} · {receipt.dueDate}
                      </span>
                      <strong>
                        {inr(
                          receipt.allocations
                            ?.filter((a) => a.invoiceId === r.id)
                            .reduce((sum, a) => sum + Number(a.amount), 0) ?? 0,
                        )}
                      </strong>
                      <Badge>{receipt.status}</Badge>
                    </div>
                  ))}
              </div>
            )}
            <div className="document-terms">
              <span className="eyebrow">TERMS & EXCLUSIONS</span>
              <p>{r.terms || "No terms added."}</p>
              {r.acceptance && (
                <div className="info-note">
                  Acceptance evidence: {r.acceptance}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="record-summary">
              <Avatar name={r.name} />
              <div>
                <h3>{r.name}</h3>
                <p>
                  {r.locality ??
                    customer?.name ??
                    r.category ??
                    r.supplier ??
                    "Business record"}
                </p>
              </div>
            </div>
            <dl className="detail-grid">
              {Object.entries({
                Customer: customer?.name,
                Project: project?.name,
                Phone: r.phone,
                Email: r.email,
                Address: r.address,
                Owner: r.owner,
                "Due / appointment": r.dueDate,
                Source: r.source,
                Campaign: r.campaign,
                Language: r.language,
                SKU: r.sku,
                Brand: r.brand,
                Supplier: r.supplier,
                Unit: r.unit,
                "Selling rate": r.rate ? inr(r.rate) : undefined,
                "Purchase cost":
                  r.cost && hasCosts(actor.role) ? inr(r.cost) : undefined,
                Budget: r.budget ? inr(r.budget) : undefined,
                Amount: r.amount ? inr(r.amount) : undefined,
                Reference: r.reference,
                "WhatsApp permission": ["customer", "lead"].includes(r.kind)
                  ? r.consent
                    ? "Recorded"
                    : "Not recorded"
                  : undefined,
                "Consent evidence": r.consentNote,
                Priority: r.priority,
                Warranty: r.warranty,
                Notes: r.notes,
                Terms: r.terms,
              })
                .filter(([, v]) => v)
                .map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
            {r.checklist && (
              <div className="checklist">
                {r.checklist.map((c, i) => (
                  <div key={i}>
                    {c.done ? "✓" : "○"} {c.label}
                  </div>
                ))}
              </div>
            )}
            {r.items && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Material / specification</th>
                      <th>SKU</th>
                      <th>Required</th>
                      <th>Received</th>
                      {hasCosts(actor.role) && <th>Unit cost</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td>{item.sku || "—"}</td>
                        <td>
                          {item.quantity} {item.unit}
                        </td>
                        <td>
                          {item.received} {item.unit}
                        </td>
                        {hasCosts(actor.role) && <td>{inr(item.unitCost)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {r.goodsReceipts?.map((receipt) => (
              <div className="audit-row" key={receipt.reference}>
                <span>Goods receipt · {receipt.reference}</span>
                <span>{new Date(receipt.at).toLocaleDateString("en-IN")}</span>
                <strong>{receipt.items.length} line(s)</strong>
              </div>
            ))}
            {r.acceptance && (
              <div className="info-note">Approval evidence: {r.acceptance}</div>
            )}
            {r.kind === "receipt" && (
              <>
                <div className="balance-card">
                  <span>Unapplied funds</span>
                  <strong>{inr(availableReceipt(r))}</strong>
                </div>
                {r.allocations?.map((a, i) => (
                  <div className="audit-row" key={i}>
                    <span>
                      Applied to{" "}
                      {workspace.records.find((x) => x.id === a.invoiceId)
                        ?.number ?? a.invoiceId}
                    </span>
                    <strong>{inr(a.amount)}</strong>
                  </div>
                ))}
                {r.refunds?.map((c) => (
                  <div className="audit-row" key={c.id}>
                    <span>Refund · {c.reason}</span>
                    <strong>{inr(c.amount)}</strong>
                  </div>
                ))}
              </>
            )}
            {r.kind === "customer" && (
              <>
                <h3 className="subheading">Customer statement</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Due date</th>
                        <th>Total</th>
                        <th>Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspace.records
                        .filter(
                          (x) => x.kind === "invoice" && x.customerId === r.id,
                        )
                        .map((x) => (
                          <tr key={x.id}>
                            <td>
                              <a
                                href={`/invoices/ledger?record=${encodeURIComponent(x.id)}`}
                              >
                                {x.number ?? "Draft"}
                              </a>
                            </td>
                            <td>{x.dueDate}</td>
                            <td>{inr(documentTotal(x))}</td>
                            <td>{inr(balanceFor(x, workspace.records))}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <h3 className="subheading">Projects</h3>
                <h3 className="subheading">Client operations & activity</h3>
                {workspace.records
                  .filter(
                    (x) =>
                      (x.customerId === r.id ||
                        (!x.customerId &&
                          workspace.records.some(
                            (p) =>
                              p.kind === "project" &&
                              p.id === x.projectId &&
                              p.customerId === r.id,
                          ))) &&
                      [
                        "bom",
                        "survey",
                        "purchase",
                        "service",
                        "changeOrder",
                        "task",
                        "call",
                      ].includes(x.kind),
                  )
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                  .map((x) => (
                    <div className="audit-row" key={x.id}>
                      <div>
                        <a
                          href={`/${({ bom: "bom", survey: "surveys", purchase: "purchases", service: "service", changeOrder: "changes", task: "tasks", call: "calls" } as Record<string, string>)[x.kind]}?record=${encodeURIComponent(x.id)}`}
                        >
                          {x.name}
                        </a>
                        <small>
                          {x.kind} ·{" "}
                          {workspace.records.find((p) => p.id === x.projectId)
                            ?.name ?? "Client record"}{" "}
                          · {x.updatedAt.slice(0, 10)}
                        </small>
                      </div>
                      <Badge>{x.status}</Badge>
                    </div>
                  ))}
                <h3 className="subheading">Quotations and payment history</h3>
                {workspace.records
                  .filter(
                    (x) =>
                      x.customerId === r.id &&
                      ["quote", "receipt"].includes(x.kind),
                  )
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((x) => (
                    <div className="audit-row" key={x.id}>
                      <div>
                        <a
                          href={`/invoices/${x.kind === "quote" ? "quotations" : "receipts"}?record=${encodeURIComponent(x.id)}`}
                        >
                          {x.number ?? x.name}
                        </a>
                        <small>
                          {x.dueDate || x.createdAt.slice(0, 10)} · {x.status} ·{" "}
                          {x.paymentMode}
                        </small>
                        {x.allocations?.map((a, i) => (
                          <small key={i}>
                            {workspace.records.find(
                              (inv) => inv.id === a.invoiceId,
                            )?.number ?? a.invoiceId}
                            : {inr(a.amount)}
                          </small>
                        ))}
                      </div>
                      <strong>
                        {inr(
                          x.kind === "receipt"
                            ? (x.amount ?? "0")
                            : documentTotal(x),
                        )}
                      </strong>
                    </div>
                  ))}
                {workspace.records
                  .filter((x) => x.kind === "project" && x.customerId === r.id)
                  .map((x) => (
                    <div className="audit-row" key={x.id}>
                      <span>{x.name}</span>
                      <Badge>{x.status}</Badge>
                    </div>
                  ))}
              </>
            )}
          </>
        )}
        {writable && (
          <div className="detail-actions">
            {nextStatuses(r)
              .filter((status) => r.kind !== "purchase" || status === "Ordered")
              .map((status) => (
                <button
                  className={`button ${status === "Lost" || status === "Rejected" ? "secondary" : "primary"}`}
                  key={status}
                  disabled={busy}
                  onClick={() =>
                    status === "Signed off"
                      ? setAction("signoff")
                      : r.kind === "changeOrder" && status === "Approved"
                        ? setAction("approveChange")
                        : status === "Accepted"
                          ? setAction("accept")
                          : void run({ type: "transition", id: r.id, status })
                  }
                >
                  {r.kind === "quote" && status === "Shared"
                    ? "Freeze for sharing"
                    : `Mark ${status}`}
                  <ArrowRight size={14} />
                </button>
              ))}
            {r.kind === "quote" &&
              !["Draft", "Accepted"].includes(r.status) && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={async () => {
                    if (await run({ type: "reviseQuote", id: r.id })) onClose();
                  }}
                >
                  <CopyPlus size={15} />
                  Create revision
                </button>
              )}
            {r.kind === "invoice" && r.status === "Draft" && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void run({ type: "issueInvoice", id: r.id })}
              >
                <ReceiptIndianRupee size={15} />
                Issue invoice
              </button>
            )}
            {r.kind === "invoice" && r.status === "Issued" && (
              <>
                <button
                  className="button primary"
                  onClick={() => {
                    setAmount(balanceFor(r, workspace.records));
                    setAction("receive");
                  }}
                >
                  Record payment
                </button>
                <button
                  className="button secondary"
                  onClick={() => setAction("credit")}
                >
                  Credit adjustment
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    setWhen("");
                    setAction("scheduleReminder");
                  }}
                >
                  <CalendarClock size={15} />
                  Schedule reminder
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      type: "collectionHold",
                      id: r.id,
                      disputed: !r.disputed,
                      paused: r.paused ?? false,
                    })
                  }
                >
                  {r.disputed ? "Resolve dispute" : "Flag dispute"}
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      type: "collectionHold",
                      id: r.id,
                      disputed: r.disputed ?? false,
                      paused: !r.paused,
                    })
                  }
                >
                  {r.paused ? "Resume collections" : "Pause collections"}
                </button>
              </>
            )}
            {r.kind === "receipt" && r.status === "Confirmed" && (
              <>
                <button
                  className="button secondary"
                  onClick={() => setAction("allocate")}
                >
                  Allocate funds
                </button>
                <button
                  className="button secondary"
                  onClick={() => setAction("unallocate")}
                >
                  Reverse allocation
                </button>
                <button
                  className="button secondary"
                  onClick={() => setAction("refund")}
                >
                  Record refund
                </button>
                <button
                  className="button secondary danger-text"
                  onClick={() => setAction("reverseReceipt")}
                >
                  Reverse receipt
                </button>
              </>
            )}
            {r.kind === "purchase" &&
              ["Ordered", "Part received"].includes(r.status) && (
                <button
                  className="button primary"
                  onClick={() => {
                    setGoods({});
                    setReference("");
                    setAction("receiveGoods");
                  }}
                >
                  Record goods receipt
                </button>
              )}
          </div>
        )}
        {r.kind === "quote" &&
          r.status === "Accepted" &&
          canWrite(actor.role, "invoice") && (
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (await run({ type: "createInvoice", id: r.id })) onClose();
              }}
            >
              Create invoice draft
              <ArrowRight size={16} />
            </button>
          )}
        {r.kind === "quote" &&
          r.status === "Accepted" &&
          canWrite(actor.role, "bom") && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                if (await run({ type: "createBOM", id: r.id })) onClose();
              }}
            >
              Create BOM draft
            </button>
          )}
        {writable &&
          ["catalog", "clause", "survey", "bom"].includes(r.kind) &&
          r.status !== "Draft" && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                if (await run({ type: "newVersion", id: r.id })) onClose();
              }}
            >
              <CopyPlus size={15} />
              Create new version
            </button>
          )}
        <section className="evidence-section">
          <h3 className="subheading">Evidence & site files</h3>
          {r.files?.map((file) => (
            <a
              className="audit-row text-link"
              key={file.path}
              href={`/api/files?recordId=${encodeURIComponent(r.id)}&path=${encodeURIComponent(file.path)}`}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <Paperclip size={13} /> {file.name}
              </span>
              <span>{Math.ceil(file.size / 1024)} KB</span>
            </a>
          ))}
          {writable &&
            (demo ? (
              <p className="muted">
                Connect Supabase to store private PDFs and site photographs.
              </p>
            ) : (
              <label className="file-upload">
                Attach a private PDF or site image (up to 10 MB)
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const form = new FormData();
                    form.set("file", file);
                    form.set("recordId", r.id);
                    try {
                      const response = await fetch("/api/files", {
                        method: "POST",
                        body: form,
                      });
                      const data = await response.json();
                      if (!response.ok) throw new Error(data.error);
                      notify("Evidence uploaded to private storage.");
                      refresh();
                    } catch (error) {
                      notify(
                        error instanceof Error
                          ? error.message
                          : "Upload failed.",
                      );
                    }
                  }}
                />
              </label>
            ))}
        </section>
        {action && (
          <form className="action-form" onSubmit={submit}>
            <h3>
              {
                {
                  receive: "Record confirmed payment",
                  credit: "Append credit adjustment",
                  reverseReceipt: "Reverse receipt",
                  refund: "Record refund of unapplied funds",
                  allocate: "Allocate existing receipt",
                  unallocate: "Reverse an allocation with evidence",
                  receiveGoods: "Record actual goods received",
                  signoff: "Record survey sign-off",
                  approveChange: "Record customer scope-change approval",
                  scheduleReminder: "Schedule WhatsApp reminder",
                  accept: "Record customer acceptance",
                }[action]
              }
            </h3>
            <p className="muted">
              {action === "receive"
                ? "Only confirm cleared funds. A payment screenshot or promise is not bank confirmation."
                : action === "scheduleReminder"
                  ? "Dispatch rechecks balance, permission, holds and contact frequency."
                  : "This action is retained in the audit trail."}
            </p>
            <div className="form-grid">
              {[
                "receive",
                "credit",
                "refund",
                "allocate",
                "unallocate",
              ].includes(action) && (
                <Field label="Amount (INR)">
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
              )}
              {["allocate", "unallocate"].includes(action) && (
                <Field label="Issued invoice">
                  <select
                    required
                    value={invoiceId}
                    onChange={(e) => setInvoiceId(e.target.value)}
                  >
                    <option value="">Select invoice…</option>
                    {workspace.records
                      .filter(
                        (i) =>
                          i.kind === "invoice" &&
                          i.status === "Issued" &&
                          i.customerId === r.customerId,
                      )
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.number} · {inr(balanceFor(i, workspace.records))}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              {action === "receive" && (
                <>
                  <Field label="Unique bank / payment reference">
                    <input
                      required
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </Field>
                  <Field label="Date received">
                    <input
                      required
                      type="date"
                      value={when}
                      onChange={(e) => setWhen(e.target.value)}
                    />
                  </Field>
                </>
              )}
              {action === "scheduleReminder" && (
                <Field label="Reminder time (your local timezone)">
                  <input
                    required
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                </Field>
              )}
              {[
                "credit",
                "refund",
                "reverseReceipt",
                "accept",
                "unallocate",
                "signoff",
                "approveChange",
              ].includes(action) && (
                <Field
                  label={
                    action === "accept"
                      ? "Acceptance evidence / document reference"
                      : "Reason / evidence reference"
                  }
                >
                  <textarea
                    required
                    minLength={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              )}
              {action === "receiveGoods" && (
                <>
                  <Field label="Goods receipt / delivery reference">
                    <input
                      required
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </Field>
                  {r.items?.map((item, i) => (
                    <Field
                      key={item.id}
                      label={`${item.description} · ${item.received}/${item.quantity} received`}
                    >
                      <input
                        aria-label={`Received quantity ${i + 1}`}
                        type="number"
                        min="0"
                        max={Number(item.quantity) - Number(item.received)}
                        step="any"
                        value={goods[item.id] ?? "0"}
                        onChange={(e) =>
                          setGoods({ ...goods, [item.id]: e.target.value })
                        }
                      />
                    </Field>
                  ))}
                </>
              )}
            </div>
            <div className="button-group">
              <button className="button primary" disabled={busy}>
                Confirm action
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setAction("")}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
      </div>
      <footer className="modal-footer">
        <span>
          Created {new Date(r.createdAt).toLocaleDateString("en-IN")} ·{" "}
          {r.disputed
            ? "Collections disputed"
            : r.paused
              ? "Collections paused"
              : "Changes are audited"}
        </span>
        <button className="button secondary" onClick={onClose}>
          Close
        </button>
      </footer>
    </Modal>
  );
}
