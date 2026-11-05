"use client";
import { useState } from "react";
import type { BusinessSettings } from "@/domain/types";
import { useWorkspace } from "./workspace-provider";
import { Field } from "./ui";
import { BrandingPreview } from "./branding-preview";
const tabs = [
  "Firm Details",
  "Bank & Payments",
  "Branding",
  "Document Settings",
];
export function PracticeSettings() {
  const { workspace, actor, run, busy, error } = useWorkspace();
  const [tab, setTab] = useState(tabs[0]);
  const [draft, setDraft] = useState<BusinessSettings | null>(null);
  if (!workspace) return null;
  if (actor.role !== "owner")
    return <p>Only the owner can update Practice Settings.</p>;
  const s = draft ?? workspace.settings;
  const update = (patch: Partial<BusinessSettings>) =>
    setDraft({ ...s, ...patch });
  const input = (label: string, key: keyof BusinessSettings) => (
    <Field key={key} label={label}>
      <input
        value={String(s[key] ?? "")}
        onChange={(e) => update({ [key]: e.target.value })}
      />
    </Field>
  );
  return (
    <section className="practice-settings">
      <h1>Practice Settings</h1>
      <p>Firm identity, payment details and document preferences.</p>
      <div className="billing-actions">
        {tabs.map((t) => (
          <button
            key={t}
            className={`button ${tab === t ? "primary" : "secondary"}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const { invoiceSequences: _, ...settings } = s;
          void _;
          await run({ type: "settings", settings });
        }}
      >
        {tab === "Firm Details" && (
          <div className="form-grid">
            {input("Legal firm name", "billingName")}
            {input("Official email", "email")}
            {input("Contact number", "phone")}
            {input("GSTIN", "gstin")}
            {input("PAN", "pan")}
            {input("Registered address", "billingAddress")}
          </div>
        )}
        {tab === "Bank & Payments" && (
          <>
            <h2>Bank Account</h2>
            <div className="form-grid">
              {input("Bank and branch", "bankName")}
              {input("Account holder", "accountName")}
              {input("Account number", "accountNumber")}
              {input("IFSC", "ifsc")}
              {input("UPI ID", "upi")}
            </div>
          </>
        )}
        {tab === "Branding" && (
          <BrandingPreview settings={s} onChange={update} />
        )}
        {tab === "Document Settings" && (
          <>
            <div className="form-grid">
              {input("Invoice prefix", "invoicePrefix")}
              {input("Issued by / signatory", "signatory")}
            </div>
            <Field label="Default terms & conditions">
              <textarea
                rows={8}
                value={s.defaultTerms}
                onChange={(e) => update({ defaultTerms: e.target.value })}
              />
            </Field>
            <label>
              <input
                type="checkbox"
                checked={s.taxReviewed}
                onChange={(e) => update({ taxReviewed: e.target.checked })}
              />{" "}
              Tax and invoice particulars reviewed
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save Settings"}
        </button>
      </form>
    </section>
  );
}
