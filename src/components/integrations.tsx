"use client";
import { useEffect, useState } from "react";
import {
  MessageCircle,
  Contact,
  Phone,
  Globe2,
  FileSpreadsheet,
  Database,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Badge, SectionHeader, Modal, Field } from "./ui";
export function Integrations() {
  const { workspace, demo, run, busy, error } = useWorkspace();
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [resolveId, setResolveId] = useState(""),
    [reason, setReason] = useState(""),
    [outcome, setOutcome] = useState<"Sent" | "Failed">("Failed");
  useEffect(() => {
    if (!demo)
      void fetch("/api/integrations")
        .then((r) => (r.ok ? r.json() : {}))
        .then(setConfigured);
  }, [demo]);
  if (!workspace) return null;
  const cards = [
    {
      name: "Supabase",
      category: "DATABASE & AUTHENTICATION",
      Icon: Database,
      ready: !demo,
      description:
        "Organization-scoped records, private documents, staff access and an append-only audit trail.",
      action: "Apply migration and provision staff",
      url: "https://supabase.com/dashboard",
    },
    {
      name: "Authkey.io",
      category: "WHATSAPP BUSINESS",
      Icon: MessageCircle,
      ready: configured.authkey,
      description:
        "Approved templates for quotation and payment follow-ups, with permission checks and a durable dispatch queue.",
      action: "Configure WhatsApp templates",
      url: "https://console.authkey.io/",
    },
    {
      name: "Meta Lead Ads",
      category: "FACEBOOK & INSTAGRAM",
      Icon: Contact,
      ready: configured.meta,
      description:
        "Signed lead-form webhook intake, deduplication and source attribution. Page access and a verified test lead are required.",
      action: "Set up Meta app & Page access",
      url: "https://developers.facebook.com/",
    },
    {
      name: "Voice assistant",
      category: "INBOUND ENQUIRIES",
      Icon: Phone,
      ready: configured.voice,
      description:
        "Provider adapter and protected call-outcome intake. Configure an Indian number, language-tested agent and human transfer before routing calls.",
      action: "Evaluate Bolna for a pilot",
      url: "https://www.bolna.ai/pricing",
    },
    {
      name: "Justdial",
      category: "DIRECTORY ENQUIRIES",
      Icon: FileSpreadsheet,
      ready: false,
      description:
        "Use reviewed CSV imports now. Automated sync depends on the API or export access included with your Justdial account.",
      action: "Import leads from CSV",
      url: "/leads",
    },
    {
      name: "Website enquiries",
      category: "HUTASHANA.COM",
      Icon: Globe2,
      ready: false,
      description:
        "The public website is separate. Connect its server-side enquiry handler to the authenticated intake endpoint; preserve the existing WhatsApp flow.",
      action: "Review intake setup",
      url: "/settings",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">BETTER TOGETHER</span>
          <h1>A connected business</h1>
          <p>Bring your conversations and daily work into one place.</p>
        </div>
        <span className="secure-chip">
          <ShieldCheck size={16} />
          Secrets stay on the server
        </span>
      </div>
      <div className="info-note integration-note">
        {demo
          ? "You are exploring a local demonstration. All external providers are disconnected and no messages or calls can be sent."
          : "Configured means credentials are present; it does not confirm account permissions or a successful provider test. Test each connection before enabling automation."}
      </div>
      <div className="integration-grid">
        {cards.map(
          ({ name, category, Icon, ready, description, action, url }) => (
            <section className="panel integration-card" key={name}>
              <div className="integration-card-head">
                <span
                  className={`integration-icon ${name === "Authkey.io" ? "whatsapp" : ""}`}
                >
                  <Icon size={25} />
                </span>
                <Badge>{ready ? "Configured" : "Setup needed"}</Badge>
              </div>
              <span className="eyebrow">{category}</span>
              <h2>{name}</h2>
              <p>{description}</p>
              <a
                className="text-link"
                href={url}
                target={url.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
              >
                {action}
                <ArrowUpRight size={15} />
              </a>
            </section>
          ),
        )}
      </div>
      <section className="panel report-panel">
        <SectionHeader
          title="Automation dispatch queue"
          subtitle="Paid, paused, disputed and opted-out accounts are suppressed before dispatch."
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {workspace.jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    {workspace.records.find((r) => r.id === j.invoiceId)
                      ?.number ?? j.invoiceId}
                  </td>
                  <td>
                    {new Date(j.dueAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                  <td>
                    <Badge>{j.status}</Badge>
                  </td>
                  <td>{j.attempts}</td>
                  <td>
                    {j.message}
                    {j.status === "Unknown" && (
                      <button
                        className="table-action"
                        onClick={() => {
                          setResolveId(j.id);
                          setReason("");
                        }}
                      >
                        Reconcile provider outcome
                        <ArrowUpRight size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!workspace.jobs.length && (
                <tr>
                  <td colSpan={5}>
                    No reminders scheduled. Schedule an eligible reminder from
                    an issued invoice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="report-note">
          Unknown dispatch results require provider reconciliation before any
          retry. Voice calling is not an automatic fallback for WhatsApp.
        </p>
      </section>
      {resolveId && (
        <Modal
          title="Reconcile uncertain message"
          onClose={() => setResolveId("")}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run({
                  type: "resolveJob",
                  id: resolveId,
                  status: outcome,
                  reason,
                })
              )
                setResolveId("");
            }}
          >
            <div className="modal-body">
              <p className="muted">
                Check the Authkey console using the customer, invoice and
                dispatch time. Do not assume that a timeout means no message was
                submitted.
              </p>
              <div className="form-grid">
                <Field label="Verified provider outcome">
                  <select
                    value={outcome}
                    onChange={(e) =>
                      setOutcome(e.target.value as "Sent" | "Failed")
                    }
                  >
                    <option value="Failed">
                      Confirmed not submitted / failed
                    </option>
                    <option value="Sent">Confirmed provider submission</option>
                  </select>
                </Field>
                <Field label="Evidence / provider log reference">
                  <textarea
                    required
                    minLength={10}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              </div>
              {error && <div className="alert">{error}</div>}
            </div>
            <footer className="modal-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => setResolveId("")}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                Record reconciliation
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
