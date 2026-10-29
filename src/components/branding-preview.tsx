"use client";
import "./branding-preview.css";
import type { CSSProperties } from "react";
import type { BusinessSettings } from "@/domain/types";
const designs = [
  {
    id: "classic",
    name: "Classic",
    description: "Accent rules, a clear item table and a traditional footer.",
  },
  {
    id: "modern",
    name: "Modern",
    description:
      "Bold identity header, shaded details and a highlighted total.",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean monochrome layout for simple, economical printing.",
  },
] as const;
const palettes = [
  ["Hutāśana Copper", "#b97843"],
  ["Midnight Blue", "#24476b"],
  ["Forest", "#28634e"],
  ["Plum", "#6e456b"],
  ["Slate", "#475569"],
  ["Charcoal", "#24211e"],
];
export function BrandingPreview({
  settings: s,
  onChange,
}: {
  settings: BusinessSettings;
  onChange: (patch: Partial<BusinessSettings>) => void;
}) {
  const selected = s.documentTemplate ?? "classic";
  const color = s.accentColor ?? "#b97843";
  const style = { "--document-accent": color } as CSSProperties;
  return (
    <div className="branding-workbench" style={style}>
      <section className="branding-controls">
        <h2>Choose your document design</h2>
        <p className="muted">
          Select a layout to see where each section appears.
        </p>
        <div className="branding-designs">
          {designs.map((d) => (
            <button
              type="button"
              key={d.id}
              className={`design-choice ${selected === d.id ? "selected" : ""}`}
              aria-pressed={selected === d.id}
              onClick={() => onChange({ documentTemplate: d.id })}
            >
              <div
                aria-hidden="true"
                className={`design-thumbnail design-thumbnail-${d.id}`}
              >
                <div className="thumb-header">
                  <b>H</b>
                  <span>INVOICE</span>
                </div>
                <div className="thumb-parties">
                  <i />
                  <i />
                </div>
                <div className="thumb-table">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="thumb-total" />
                <div className="thumb-footer">
                  <i />
                  <i />
                </div>
              </div>
              <strong>
                {d.name}
                {selected === d.id ? " ✓" : ""}
              </strong>
              <small>{d.description}</small>
            </button>
          ))}
        </div>
        <h3>Color palette</h3>
        <div className="branding-palettes">
          {palettes.map(([name, hex]) => (
            <button
              type="button"
              key={hex}
              aria-label={`${name} ${hex}`}
              aria-pressed={color === hex}
              className={color === hex ? "selected" : ""}
              onClick={() => onChange({ accentColor: hex })}
            >
              <span style={{ backgroundColor: hex }} />
              <small>{name}</small>
            </button>
          ))}
        </div>
        <div className="branding-custom">
          <label>
            Custom accent
            <input
              aria-label="Custom document accent"
              type="color"
              value={color}
              onChange={(e) => onChange({ accentColor: e.target.value })}
            />
          </label>
          <code>{color.toUpperCase()}</code>
        </div>
        <p className="muted">
          Changes update the preview immediately. Save Settings to use this
          design for new documents.
        </p>
        <p className="muted">
          Preview fields marked in brackets show placement; they are not client
          records.
        </p>
      </section>
      <section className="branding-preview-column">
        <div className="branding-preview-heading">
          <strong>Live layout preview</strong>
          <span>{designs.find((d) => d.id === selected)?.name} · A4</span>
        </div>
        <article
          className={`invoice-design-preview invoice-design-${selected}`}
          aria-label="Invoice layout preview"
        >
          <header className="design-identity">
            <div>
              <span className="placement-label">01 · FIRM IDENTITY</span>
              <h2>{s.billingName || "[Your firm name]"}</h2>
              <p>{s.billingAddress || "[Registered address]"}</p>
              <p>GSTIN: {s.gstin || "[GSTIN]"}</p>
              <p>
                {s.email || "[Email]"} · {s.phone || "[Phone]"}
              </p>
            </div>
            <div className="design-doc-title">
              <h3>INVOICE</h3>
              <p>[Invoice number]</p>
              <span>DRAFT PREVIEW</span>
            </div>
          </header>
          <div className="design-parties">
            <section>
              <span className="placement-label">02 · BILL TO</span>
              <strong>[Client name]</strong>
              <p>[Client billing address]</p>
              <p>[Client GSTIN]</p>
            </section>
            <section>
              <span className="placement-label">03 · DOCUMENT DETAILS</span>
              <p>Invoice date: [Date]</p>
              <p>Due date: [Date]</p>
              <p>Project: [Kitchen / site]</p>
            </section>
          </div>
          <section className="design-items">
            <span className="placement-label">
              04 · SERVICES & SPECIFICATIONS
            </span>
            <table>
              <thead>
                <tr>
                  <th>Description / HSN</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    [Kitchen module]
                    <small>[Material, finish & dimensions]</small>
                  </td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td>[Hardware / installation]</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </section>
          <section className="design-totals">
            <span className="placement-label">05 · FINANCIAL SUMMARY</span>
            <p>
              <span>Subtotal / discount</span>
              <span>—</span>
            </p>
            <p>
              <span>Taxable amount / GST</span>
              <span>—</span>
            </p>
            <strong>
              <span>Total amount</span>
              <span>₹ —</span>
            </strong>
          </section>
          <section className="design-bank">
            <span className="placement-label">06 · PAYMENT DETAILS</span>
            <strong>{s.accountName || "[Account holder]"}</strong>
            <p>{s.bankName || "[Bank and branch]"}</p>
            <p>
              A/C: {s.accountNumber || "[Account number]"} · IFSC:{" "}
              {s.ifsc || "[IFSC]"}
            </p>
            <p>UPI: {s.upi || "[UPI ID]"}</p>
          </section>
          <section className="design-terms">
            <span className="placement-label">07 · TERMS & CONDITIONS</span>
            <p>
              {s.defaultTerms ||
                "[Your terms, exclusions and payment conditions]"}
            </p>
          </section>
          <footer className="design-signature">
            <span className="placement-label">08 · FINALIZATION</span>
            <p>[Client-facing remarks]</p>
            <strong>{s.signatory || "[Authorized signatory]"}</strong>
            <small>For {s.billingName || "[Your firm]"}</small>
          </footer>
        </article>
      </section>
    </div>
  );
}
