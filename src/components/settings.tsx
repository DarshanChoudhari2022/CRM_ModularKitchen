"use client";
import Image from "next/image";
import { useState } from "react";
import {
  Save,
  ShieldCheck,
  Database,
  Download,
  RotateCcw,
  KeyRound,
} from "lucide-react";
import type { BusinessSettings } from "@/domain/types";
import { downloadText } from "@/domain/csv";
import { useWorkspace } from "./workspace-provider";
import { Field, SectionHeader, Badge } from "./ui";
export function Settings() {
  const { workspace, actor, run, busy, error, demo, resetDemo, notify } =
    useWorkspace();
  const [draft, setDraft] = useState<BusinessSettings | null>(null),
    [resetConfirm, setResetConfirm] = useState(false),
    [factor, setFactor] = useState<{
      id: string;
      qr: string;
      secret: string;
    } | null>(null),
    [code, setCode] = useState(""),
    [mfaError, setMfaError] = useState("");
  if (!workspace) return null;
  const s = draft ?? workspace.settings;
  const update = (patch: Partial<BusinessSettings>) =>
    setDraft({ ...s, ...patch });
  const text = (
    label: string,
    key:
      | "billingName"
      | "billingAddress"
      | "gstin"
      | "phone"
      | "email"
      | "invoicePrefix"
      | "authkeyTemplateId",
    hint?: string,
  ) => (
    <Field label={label} hint={hint}>
      <input
        value={s[key]}
        onChange={(e) => update({ [key]: e.target.value })}
      />
    </Field>
  );
  const security = async (action: "enroll" | "verify") => {
    setMfaError("");
    try {
      const response = await fetch("/api/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, factorId: factor?.id, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (action === "enroll") setFactor(data);
      else {
        setFactor(null);
        setCode("");
        notify("Authenticator verified and enabled.");
      }
    } catch (e) {
      setMfaError(
        e instanceof Error ? e.message : "Authenticator setup failed.",
      );
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>Workspace settings</h1>
          <p>The business details behind every customer experience.</p>
        </div>
        <Badge>{demo ? "Local demo" : "Supabase workspace"}</Badge>
      </div>
      {actor.role === "owner" ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { invoiceSequences: _, ...settings } = s;
            void _;
            if (await run({ type: "settings", settings })) setDraft(null);
          }}
        >
          <section className="panel settings-panel">
            <SectionHeader
              title="Business & billing identity"
              subtitle="Used in new issued documents. Existing snapshots stay unchanged."
            />
            <div className="form-grid">
              {text("Legal / billing business name", "billingName")}
              {text("Business phone", "phone")}
              {text("Billing address", "billingAddress")}
              {text("Business email", "email")}
              {text(
                "GSTIN (if registered)",
                "gstin",
                "Confirm registration, classifications and place-of-supply treatment with your accountant.",
              )}
              {text(
                "Invoice prefix",
                "invoicePrefix",
                "1–6 capital letters, digits or hyphens. Numbering is sequential per Indian financial year.",
              )}
              <div className="full-span consent-field">
                <label>
                  <input
                    type="checkbox"
                    checked={s.taxReviewed}
                    onChange={(e) => update({ taxReviewed: e.target.checked })}
                  />
                  Accountant has reviewed invoice particulars, tax treatment and
                  numbering
                </label>
                <small>
                  Required before invoice issue. Line tax rates still need to be
                  entered correctly for each transaction.
                </small>
              </div>
            </div>
          </section>
          <section className="panel settings-panel">
            <SectionHeader
              title="Default quotation terms"
              subtitle="A starting point for new drafts; published clauses are maintained in the Terms library."
            />
            <textarea
              className="terms-input"
              rows={5}
              value={s.defaultTerms}
              onChange={(e) => update({ defaultTerms: e.target.value })}
            />
          </section>
          <section className="panel settings-panel">
            <SectionHeader
              title="WhatsApp collection policy"
              subtitle="Authkey credentials remain on the server. Demo never dispatches messages."
            />
            <div className="form-grid">
              {text(
                "Approved Authkey template ID",
                "authkeyTemplateId",
                "Template positional fields: customer name, invoice number, current INR balance, due date. Confirm this exact mapping in Authkey.",
              )}
              <Field label="Minimum gap between customer contacts (hours)">
                <input
                  type="number"
                  min={24}
                  max={720}
                  required
                  value={s.contactGapHours}
                  onChange={(e) =>
                    update({ contactGapHours: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Preferred reminder hour (Asia/Kolkata)">
                <input
                  type="number"
                  min={9}
                  max={18}
                  required
                  value={s.reminderHour}
                  onChange={(e) =>
                    update({ reminderHour: Number(e.target.value) })
                  }
                />
              </Field>
              <div className="full-span consent-field">
                <label>
                  <input
                    type="checkbox"
                    checked={s.reminderEnabled}
                    onChange={(e) =>
                      update({ reminderEnabled: e.target.checked })
                    }
                  />
                  Enable dispatch of explicitly scheduled, eligible reminders
                </label>
                <small>
                  Requires customer permission, an approved template, current
                  balance, no dispute/hold, and a configured worker. Contact
                  hours are 09:00–18:59 Asia/Kolkata.
                </small>
              </div>
            </div>
          </section>
          {error && <div className="alert">{error}</div>}
          <div className="settings-save">
            <span>Saved changes are recorded in your audit history.</span>
            <button className="button primary" disabled={busy}>
              <Save size={16} />
              {busy ? "Saving…" : "Save settings"}
            </button>
          </div>
        </form>
      ) : (
        <div className="info-note">
          Only the owner can change billing and automation policies.
        </div>
      )}
      <div className="report-grid">
        <section className="panel settings-panel">
          <SectionHeader
            title="Security & access"
            subtitle="Invite-only staff accounts with role-scoped permissions."
            action={<ShieldCheck size={21} />}
          />
          <ul className="plain-list">
            <li>
              Role: <strong>{actor.role}</strong>
            </li>
            <li>Server-side organization membership verification</li>
            <li>Private documents and audited financial commands</li>
            <li>Owner controls rates, shared terms and automation policies</li>
          </ul>
          {!demo && (
            <>
              <button
                className="button secondary"
                onClick={() => void security("enroll")}
              >
                <KeyRound size={15} />
                Set up authenticator
              </button>
              {factor && (
                <div className="mfa-setup">
                  <p>
                    Scan this QR in your authenticator, then enter its six-digit
                    code.
                  </p>
                  <Image
                    unoptimized
                    alt="Authenticator enrollment QR"
                    src={factor.qr}
                    width={180}
                    height={180}
                  />
                  <small>Manual secret: {factor.secret}</small>
                  <Field label="Six-digit code">
                    <input
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </Field>
                  <button
                    className="button primary"
                    onClick={() => void security("verify")}
                  >
                    Verify authenticator
                  </button>
                </div>
              )}
              {mfaError && <div className="alert">{mfaError}</div>}
            </>
          )}
          {demo && (
            <small>
              Authenticator enrollment is available after Supabase is connected.
            </small>
          )}
        </section>
        <section className="panel settings-panel">
          <SectionHeader
            title="Your data, under your control"
            subtitle="Exports supplement database and storage backups."
            action={<Database size={21} />}
          />
          {actor.role === "owner" && (
            <button
              className="button secondary"
              onClick={() =>
                downloadText(
                  JSON.stringify(workspace, null, 2),
                  `hutashana-${demo ? "demo" : "workspace"}-export.json`,
                  "application/json",
                )
              }
            >
              <Download size={16} />
              Export workspace JSON
            </button>
          )}
          <p className="muted">
            {demo
              ? "This demo is saved in this browser. Clearing browser storage removes it."
              : "Configure off-site PostgreSQL and private-file backups, and test restore before the live pilot."}
          </p>
          {demo && (
            <div className="reset-section">
              {resetConfirm ? (
                <>
                  <p>
                    This replaces local demo changes with the original fictional
                    examples.
                  </p>
                  <button
                    className="button danger"
                    onClick={() => {
                      resetDemo();
                      setDraft(null);
                      setResetConfirm(false);
                    }}
                  >
                    Confirm reset
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => setResetConfirm(false)}
                  >
                    Keep my changes
                  </button>
                </>
              ) : (
                <button
                  className="button secondary"
                  onClick={() => setResetConfirm(true)}
                >
                  <RotateCcw size={15} />
                  Reset demonstration
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      {actor.role === "owner" && (
        <section className="panel report-panel">
          <SectionHeader
            title="Activity & audit trail"
            subtitle="Recent operations. The database retains the full live audit log."
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {workspace.audit.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {new Date(a.at).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </td>
                    <td>{a.actor}</td>
                    <td>{a.action}</td>
                    <td>{a.detail}</td>
                  </tr>
                ))}
                {!workspace.audit.length && (
                  <tr>
                    <td colSpan={4}>
                      Your next saved action will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
