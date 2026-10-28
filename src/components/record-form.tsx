"use client";
import { useState } from "react";
import { Save } from "lucide-react";
import type { CRMRecord, Kind } from "@/domain/types";
import { initialStatus } from "@/config/modules";
import { useWorkspace } from "./workspace-provider";
import { Field, Modal } from "./ui";
import { MaterialEditor } from "./material-editor";

export function RecordForm({
  kind,
  record,
  onClose,
}: {
  kind: Kind;
  record?: CRMRecord;
  onClose: () => void;
}) {
  const { workspace, run, busy, error } = useWorkspace();
  const [draft, setDraft] = useState<CRMRecord>(() =>
    record
      ? structuredClone(record)
      : {
          id: crypto.randomUUID(),
          kind,
          name: "",
          status: initialStatus(kind),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...(kind === "survey"
            ? {
                checklist: [
                  {
                    label: "Wall dimensions, diagonals & ceiling height",
                    done: false,
                  },
                  { label: "Water, gas and electrical points", done: false },
                  { label: "Appliance sizes and door clearances", done: false },
                  { label: "Site photos and customer sign-off", done: false },
                ],
              }
            : {}),
        },
  );
  const field = (
    label: string,
    key: keyof CRMRecord,
    options?: string[],
    type = "text",
    hint?: string,
  ) => (
    <Field key={key} label={label} hint={hint}>
      {options ? (
        <select
          value={String(draft[key] ?? "")}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={String(draft[key] ?? "")}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          step={type === "number" ? "any" : undefined}
          min={type === "number" ? "0" : undefined}
        />
      )}
    </Field>
  );
  const hasContact = ["lead", "customer"].includes(kind),
    linked = [
      "project",
      "task",
      "purchase",
      "service",
      "survey",
      "call",
      "bom",
      "changeOrder",
    ].includes(kind);
  return (
    <Modal
      title={`${record ? "Edit" : "New"} ${kind === "catalog" ? "catalog item" : kind === "purchase" ? "purchase order" : kind === "changeOrder" ? "scope change" : kind === "bom" ? "bill of materials" : kind}`}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run({ type: "save", record: draft })) onClose();
        }}
      >
        <div className="modal-body">
          <div className="form-grid">
            <Field label={hasContact ? "Full name / company" : "Name / title"}>
              <input
                autoFocus
                required
                maxLength={200}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            {field("Assigned to", "owner")}
            {hasContact && (
              <>
                {field(
                  "Phone (international format)",
                  "phone",
                  undefined,
                  "tel",
                  "Use +91 followed by the mobile number.",
                )}
                {field("Email", "email", undefined, "email")}
                {field("Locality", "locality")}
                {field("Preferred language", "language", [
                  "Marathi",
                  "Hindi",
                  "English",
                ])}
                <Field label="Billing / site address">
                  <textarea
                    value={draft.address ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, address: e.target.value })
                    }
                  />
                </Field>
                {kind === "customer" && field("GSTIN, if applicable", "gstin")}
                <div className="full-span consent-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.consent ?? false}
                      onChange={(e) =>
                        setDraft({ ...draft, consent: e.target.checked })
                      }
                    />
                    Permission recorded for business WhatsApp follow-ups
                  </label>
                  <input
                    placeholder="Evidence, date and scope of permission"
                    value={draft.consentNote ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, consentNote: e.target.value })
                    }
                  />
                  <small>
                    Record actual permission. A lead enquiry alone is not a
                    blanket marketing opt-in.
                  </small>
                </div>
              </>
            )}
            {kind === "lead" && (
              <>
                {field("Lead source", "source", [
                  "Meta Ads",
                  "Instagram",
                  "Facebook",
                  "Justdial",
                  "Website",
                  "Referral",
                  "Walk-in",
                  "Other",
                ])}
                {field("Estimated budget (INR)", "budget", undefined, "number")}
                {field("Next follow-up", "dueDate", undefined, "date")}
                {field("Campaign / ad reference", "campaign")}
              </>
            )}
            {linked && (
              <>
                <Field label="Customer">
                  <select
                    value={draft.customerId ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        customerId: e.target.value || undefined,
                      })
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
                {kind !== "project" && (
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
                        .filter((r) => r.kind === "project")
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
                {field(
                  kind === "task" ? "Due date" : "Target / appointment date",
                  "dueDate",
                  undefined,
                  "date",
                )}
              </>
            )}
            {kind === "project" && (
              <>
                {field("Planned budget (INR)", "budget", undefined, "number")}
                {field("Site locality", "locality")}
              </>
            )}
            {["task", "service"].includes(kind) &&
              field("Priority", "priority", [
                "Low",
                "Normal",
                "High",
                "Urgent",
              ])}
            {kind === "purchase" && (
              <>
                {field("Supplier", "supplier")}
                {field("Order total (INR)", "amount", undefined, "number")}
                {field("Order reference", "reference")}
              </>
            )}
            {kind === "changeOrder" && (
              <>
                {field(
                  "Additional agreed value (INR)",
                  "amount",
                  undefined,
                  "number",
                )}
                {field("Original quote / instruction reference", "reference")}
                <p className="form-note full-span">
                  This records a change to scope, not an invoice or payment.
                  Approval requires customer acceptance evidence. Billing
                  remains a separate action.
                </p>
              </>
            )}
            {["bom", "purchase"].includes(kind) && (
              <MaterialEditor
                items={draft.items ?? []}
                onChange={(items) => setDraft({ ...draft, items })}
              />
            )}
            {kind === "catalog" && (
              <>
                {field("SKU / model code", "sku")}
                {field("Brand / manufacturer", "brand")}
                {field("Category", "category", [
                  "Carcass",
                  "Shutter",
                  "Finish",
                  "Countertop",
                  "Hardware",
                  "Accessories",
                  "Appliances",
                  "Installation",
                  "Delivery",
                ])}
                {field("Billable unit", "unit", [
                  "ft2",
                  "m2",
                  "ft",
                  "m",
                  "piece",
                  "pair",
                  "set",
                  "package",
                ])}
                {field("Selling rate (INR)", "rate", undefined, "number")}
                {field("Purchase cost (INR)", "cost", undefined, "number")}
                {field(
                  "Tax rate (%) — accountant approved",
                  "taxRate",
                  undefined,
                  "number",
                )}
                {field("HSN / SAC", "hsn")}
                {field("Supplier", "supplier")}
                <Field label="Verified warranty & evidence reference">
                  <textarea
                    value={draft.warranty ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, warranty: e.target.value })
                    }
                  />
                </Field>
                <p className="form-note full-span">
                  New entries are drafts. Publishing requires a SKU, unit and
                  selling rate. Published entries remain frozen; add a new
                  version when prices change.
                </p>
              </>
            )}
            {kind === "clause" && (
              <>
                {field("Category", "category", [
                  "Payment",
                  "Warranty",
                  "Exclusions",
                  "Measurements",
                  "Installation",
                  "General",
                ])}
                <Field label="Reusable terms">
                  <textarea
                    rows={5}
                    required
                    value={draft.terms ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, terms: e.target.value })
                    }
                  />
                </Field>
              </>
            )}
            {kind === "survey" && (
              <div className="full-span checklist">
                {draft.checklist?.map((item, i) => (
                  <label key={i}>
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          checklist: draft.checklist?.map((c, j) =>
                            j === i ? { ...c, done: e.target.checked } : c,
                          ),
                        })
                      }
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            )}
            {kind === "call" && (
              <>
                {field("Language", "language", ["Marathi", "Hindi", "English"])}
                {field("Call source", "source", [
                  "Inbound",
                  "Callback",
                  "Manual",
                  "Voice agent",
                ])}
                {field("Provider call reference", "reference")}
              </>
            )}
            <Field label="Notes / specification details">
              <textarea
                rows={3}
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </Field>
          </div>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
        </div>
        <footer className="modal-footer">
          <span>
            {record
              ? "Changes are recorded in the audit trail."
              : "Start with the details you know."}
          </span>
          <div>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              <Save size={16} />
              {busy ? "Saving…" : "Save record"}
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
