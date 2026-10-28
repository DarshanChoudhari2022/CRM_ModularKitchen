"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, FileCheck2, Package } from "lucide-react";
import type { CRMRecord, QuoteLine } from "@/domain/types";
import { blankLine } from "@/domain/seed";
import { calculateQuote, inr } from "@/domain/pricing";
import { useWorkspace } from "./workspace-provider";
import { Field, Modal } from "./ui";
export function QuoteEditor({
  record,
  invoice = false,
  onClose,
}: {
  record?: CRMRecord;
  invoice?: boolean;
  onClose: () => void;
}) {
  const { workspace, run, busy, error } = useWorkspace();
  const [draft, setDraft] = useState<CRMRecord>(() =>
    record
      ? structuredClone(record)
      : {
          id: crypto.randomUUID(),
          kind: invoice ? "invoice" : "quote",
          name: "",
          status: "Draft",
          lines: [blankLine()],
          terms: workspace?.settings.defaultTerms ?? "",
          revision: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
  );
  const [selectedCatalog, setSelectedCatalog] = useState("");
  const lines = useMemo(() => draft.lines ?? [], [draft.lines]);
  const { calculation, warning } = useMemo(() => {
    try {
      return { calculation: calculateQuote(lines), warning: "" };
    } catch (e) {
      return {
        calculation: null,
        warning: e instanceof Error ? e.message : "Check quotation lines",
      };
    }
  }, [lines]);
  const setLine = (index: number, patch: Partial<QuoteLine>) =>
    setDraft({
      ...draft,
      lines: lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    });
  const input = (
    line: QuoteLine,
    index: number,
    key: keyof QuoteLine,
    label: string,
  ) => (
    <label className="line-input">
      <span>{label}</span>
      <input
        aria-label={`${label} line ${index + 1}`}
        required
        type="number"
        step="any"
        min="0"
        value={line[key]}
        onChange={(e) => setLine(index, { [key]: e.target.value })}
      />
    </label>
  );
  const catalog =
    workspace?.records.filter(
      (r) => r.kind === "catalog" && r.status === "Published",
    ) ?? [];
  return (
    <Modal
      title={invoice ? "Invoice workspace" : "Quotation workspace"}
      wide
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run({ type: "save", record: draft })) onClose();
        }}
      >
        <div className="quote-layout">
          <div className="quote-main">
            <div className="form-grid">
              <Field label={invoice ? "Invoice title" : "Quotation title"}>
                <input
                  required
                  autoFocus
                  placeholder="e.g. Baner · Oak & ivory kitchen"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="Customer">
                <select
                  required
                  value={draft.customerId ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, customerId: e.target.value })
                  }
                >
                  <option value="">Select customer…</option>
                  {workspace?.records
                    .filter((r) => r.kind === "customer")
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Project">
                <select
                  value={draft.projectId ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      projectId: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">Select project…</option>
                  {workspace?.records
                    .filter(
                      (r) =>
                        r.kind === "project" &&
                        (!draft.customerId ||
                          r.customerId === draft.customerId),
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label={invoice ? "Due date" : "Valid until"}>
                <input
                  type="date"
                  required
                  value={draft.dueDate ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, dueDate: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="quote-section-title">
              <h3>Kitchen specification</h3>
              <span>All dimensions in millimetres</span>
            </div>
            <div className="catalog-picker">
              <Package size={17} />
              <select
                aria-label="Add from catalog"
                value={selectedCatalog}
                onChange={(e) => {
                  setSelectedCatalog(e.target.value);
                  const c = catalog.find((r) => r.id === e.target.value);
                  if (!c) return;
                  const unit = (c.unit ?? "piece") as QuoteLine["unit"];
                  const line: QuoteLine = {
                    ...blankLine(),
                    description: c.name,
                    catalogId: c.id,
                    rate: c.rate ?? "0",
                    cost: c.cost ?? "0",
                    taxRate: c.taxRate ?? "0",
                    hsn: c.hsn ?? "",
                    unit,
                    method: ["ft2", "m2"].includes(unit)
                      ? "area"
                      : ["ft", "m"].includes(unit)
                        ? "length"
                        : unit === "package"
                          ? "package"
                          : "item",
                  };
                  setDraft({
                    ...draft,
                    lines:
                      lines.length === 1 && !lines[0].description
                        ? [line]
                        : [...lines, line],
                  });
                  setSelectedCatalog("");
                }}
              >
                <option value="">Add an approved catalog item…</option>
                {catalog.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.sku} · {r.name} · {inr(r.rate ?? 0)}/{r.unit}
                  </option>
                ))}
              </select>
            </div>
            {lines.map((line, i) => (
              <section className="quote-line" key={line.id}>
                <div className="quote-line-heading">
                  <span className="line-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <input
                    aria-label={`Description line ${i + 1}`}
                    required
                    placeholder="Module, material or service description"
                    value={line.description}
                    onChange={(e) =>
                      setLine(i, { description: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="icon-button danger-text"
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        lines: lines.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="line-grid">
                  <label className="line-input">
                    <span>Zone</span>
                    <select
                      aria-label={`Zone line ${i + 1}`}
                      value={line.zone}
                      onChange={(e) => setLine(i, { zone: e.target.value })}
                    >
                      {[
                        "Base",
                        "Wall",
                        "Loft",
                        "Tall",
                        "Island",
                        "Accessories",
                        "Services",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="line-input">
                    <span>Pricing method</span>
                    <select
                      aria-label={`Method line ${i + 1}`}
                      value={line.method}
                      onChange={(e) => {
                        const method = e.target.value as QuoteLine["method"];
                        setLine(i, {
                          method,
                          unit:
                            method === "area"
                              ? "ft2"
                              : method === "length"
                                ? "ft"
                                : method === "package"
                                  ? "package"
                                  : "piece",
                        });
                      }}
                    >
                      <option value="item">Per item</option>
                      <option value="area">Elevation area</option>
                      <option value="length">Running length</option>
                      <option value="package">Package</option>
                    </select>
                  </label>
                  <label className="line-input">
                    <span>Unit</span>
                    <select
                      aria-label={`Unit line ${i + 1}`}
                      value={line.unit}
                      onChange={(e) =>
                        setLine(i, {
                          unit: e.target.value as QuoteLine["unit"],
                        })
                      }
                    >
                      {(line.method === "area"
                        ? ["ft2", "m2"]
                        : line.method === "length"
                          ? ["ft", "m"]
                          : ["piece", "pair", "set", "package"]
                      ).map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                  {input(line, i, "quantity", "Quantity")}
                  {["area", "length"].includes(line.method) &&
                    input(
                      line,
                      i,
                      "width",
                      line.method === "length" ? "Length (mm)" : "Width (mm)",
                    )}
                  {line.method === "area" &&
                    input(line, i, "height", "Billable height (mm)")}
                  {input(line, i, "rate", "Rate (INR)")}
                  {input(line, i, "cost", "Unit cost (INR)")}
                  {input(line, i, "discount", "Discount (%)")}
                  {input(line, i, "taxRate", "Tax (%)")}
                  <label className="line-input">
                    <span>HSN / SAC</span>
                    <input
                      aria-label={`HSN line ${i + 1}`}
                      value={line.hsn}
                      onChange={(e) => setLine(i, { hsn: e.target.value })}
                    />
                  </label>
                </div>
                <div className="line-total">
                  <span>
                    {calculation?.lines[i]?.billableQuantity
                      .replace(/0+$/, "")
                      .replace(/\.$/, "")}{" "}
                    {line.unit}{" "}
                    <span className="muted">
                      · Tax and pricing basis require review
                    </span>
                  </span>
                  <strong>{inr(calculation?.lines[i]?.total ?? 0)}</strong>
                </div>
              </section>
            ))}
            <button
              type="button"
              className="button add-line"
              onClick={() =>
                setDraft({ ...draft, lines: [...lines, blankLine()] })
              }
            >
              <Plus size={16} />
              Add custom line
            </button>
            <div className="quote-section-title">
              <h3>Terms & exclusions</h3>
              <select
                aria-label="Add saved clause"
                defaultValue=""
                onChange={(e) => {
                  const c = workspace?.records.find(
                    (r) => r.id === e.target.value,
                  );
                  if (c)
                    setDraft({
                      ...draft,
                      terms: `${draft.terms ?? ""}\n\n${c.terms ?? ""}`,
                    });
                  e.target.value = "";
                }}
              >
                <option value="">Add saved clause…</option>
                {workspace?.records
                  .filter(
                    (r) => r.kind === "clause" && r.status === "Published",
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
            <textarea
              className="terms-input"
              rows={5}
              value={draft.terms ?? ""}
              onChange={(e) => setDraft({ ...draft, terms: e.target.value })}
            />
            <Field label="Internal notes / change-order reason">
              <textarea
                rows={2}
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>
            {warning && <div className="alert">{warning}</div>}
            {error && (
              <div className="alert" role="alert">
                {error}
              </div>
            )}
          </div>
          <aside className="quote-summary">
            <span className="eyebrow">COMMERCIAL SUMMARY</span>
            <h3>Made to measure.</h3>
            <p>Live totals from the specification.</p>
            <dl>
              <div>
                <dt>Line subtotal</dt>
                <dd>{inr(calculation?.subtotal ?? 0)}</dd>
              </div>
              <div>
                <dt>Discounts</dt>
                <dd>−{inr(calculation?.discount ?? 0)}</dd>
              </div>
              <div>
                <dt>Taxable / net value</dt>
                <dd>{inr(calculation?.net ?? 0)}</dd>
              </div>
              <div>
                <dt>Line taxes</dt>
                <dd>{inr(calculation?.tax ?? 0)}</dd>
              </div>
              <div className="summary-total">
                <dt>Total</dt>
                <dd>{inr(calculation?.total ?? 0)}</dd>
              </div>
            </dl>
            <div className="margin-card">
              <span>INTERNAL · NOT ON CUSTOMER PDF</span>
              <div>
                <span>Estimated cost</span>
                <strong>{inr(calculation?.cost ?? 0)}</strong>
              </div>
              <div>
                <span>Gross margin</span>
                <strong>{calculation?.margin ?? "0"}%</strong>
              </div>
              <small>
                Margin is only meaningful with complete, current purchase costs.
              </small>
            </div>
            <div className="info-note">
              <FileCheck2 size={19} />
              <p>
                Sharing freezes this revision. Any later specification change
                needs a new revision.
              </p>
            </div>
            <small>
              Tax rates default to 0 until entered. Confirm classification,
              place of supply and invoice particulars with your accountant.
            </small>
          </aside>
        </div>
        <footer className="modal-footer">
          <span>
            {lines.length} line{lines.length === 1 ? "" : "s"} ·{" "}
            {invoice ? "Draft invoice" : "Revision " + (draft.revision ?? 1)}
          </span>
          <div>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy || !calculation}>
              {busy ? "Saving…" : "Save draft"}
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
