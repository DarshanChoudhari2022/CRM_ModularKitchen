"use client";
import { Download, Printer } from "lucide-react";
import { balanceFor, businessDate, documentTotal, inr } from "@/domain/pricing";
import { collectionSummary } from "@/domain/commands";
import { exportCSV, downloadText } from "@/domain/csv";
import { useWorkspace } from "./workspace-provider";
import { Badge, SectionHeader } from "./ui";
export function Reports() {
  const { workspace } = useWorkspace();
  if (!workspace) return null;
  const records = workspace.records,
    summary = workspace.financialSummary ?? collectionSummary(records),
    today = businessDate();
  const invoices = records.filter(
    (r) => r.kind === "invoice" && r.status === "Issued",
  );
  const aging = invoices.map((r) => ({
    number: r.number,
    customer: records.find((c) => c.id === r.customerId)?.name ?? "",
    dueDate: r.dueDate ?? "",
    total: documentTotal(r),
    outstanding: balanceFor(r, records),
    days: r.dueDate
      ? Math.max(
          0,
          Math.floor(
            (new Date(today).getTime() - new Date(r.dueDate).getTime()) /
              86400000,
          ),
        )
      : 0,
  }));
  const buckets = [
    { label: "Not due", min: -1, max: -1 },
    { label: "1–7 days", min: 1, max: 7 },
    { label: "8–30 days", min: 8, max: 30 },
    { label: "31–60 days", min: 31, max: 60 },
    { label: "60+ days", min: 61, max: 99999 },
  ];
  const sources = [
    ...new Set(
      records.filter((r) => r.kind === "lead").map((r) => r.source ?? "Manual"),
    ),
  ].map((source) => {
    const leads = records.filter(
      (r) => r.kind === "lead" && (r.source ?? "Manual") === source,
    );
    const won = leads.filter((r) => r.status === "Won");
    return {
      source,
      enquiries: leads.length,
      won: won.length,
      lost: leads.filter((r) => r.status === "Lost").length,
      conversion: `${Math.round((won.length / Math.max(1, leads.length)) * 100)}%`,
    };
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE BIGGER PICTURE</span>
          <h1>Reports & insights</h1>
          <p>Understand the work. Make room for what’s next.</p>
        </div>
        <div className="button-group">
          <button className="button secondary" onClick={() => window.print()}>
            <Printer size={16} />
            Print report
          </button>
          <button
            className="button primary"
            onClick={() =>
              downloadText(
                exportCSV(aging, [
                  "number",
                  "customer",
                  "dueDate",
                  "total",
                  "outstanding",
                  "days",
                ]),
                `receivables-${today}.csv`,
              )
            }
          >
            <Download size={16} />
            Export receivables
          </button>
        </div>
      </div>
      <div className="mini-stats">
        <div>
          <span>Gross collections</span>
          <strong>{inr(summary.gross)}</strong>
        </div>
        <div>
          <span>Net of refunds</span>
          <strong>{inr(summary.net)}</strong>
        </div>
        <div>
          <span>Receivables</span>
          <strong>{inr(summary.outstanding)}</strong>
        </div>
        <div>
          <span>Unapplied advances</span>
          <strong>{inr(summary.advances)}</strong>
        </div>
      </div>
      <section className="panel report-panel">
        <SectionHeader
          title="Receivables aging"
          subtitle="Issued invoices less confirmed allocations and credit adjustments"
        />
        <div className="aging-buckets">
          {buckets.map((b) => {
            const total = aging
              .filter((a) =>
                b.min === -1
                  ? !a.dueDate || a.dueDate >= today
                  : a.days >= b.min && a.days <= b.max,
              )
              .reduce((n, a) => n + Number(a.outstanding), 0);
            return (
              <div key={b.label}>
                <span>{b.label}</span>
                <strong>{inr(total)}</strong>
              </div>
            );
          })}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Due date</th>
                <th>Age</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {aging.map((r) => (
                <tr key={r.number}>
                  <td>{r.number}</td>
                  <td>{r.customer}</td>
                  <td>{r.dueDate || "Not set"}</td>
                  <td>
                    <Badge>
                      {r.days ? `${r.days} days overdue` : "Current"}
                    </Badge>
                  </td>
                  <td className="amount">{inr(r.outstanding)}</td>
                </tr>
              ))}
              {!aging.length && (
                <tr>
                  <td colSpan={5}>No issued invoices yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <div className="report-grid">
        <section className="panel report-panel">
          <SectionHeader
            title="Lead source performance"
            subtitle="Won opportunities retain their original enquiry source"
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Enquiries</th>
                  <th>Won</th>
                  <th>Lost</th>
                  <th>Conversion</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source}>
                    <td>{s.source}</td>
                    <td>{s.enquiries}</td>
                    <td>{s.won}</td>
                    <td>{s.lost}</td>
                    <td>{s.conversion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="report-note">
            Ad spend is not connected. Cost per lead and ROAS are not inferred
            from these counts.
          </p>
        </section>
        <section className="panel report-panel">
          <SectionHeader
            title="Project commercial view"
            subtitle="Planned budget alongside recorded purchase orders"
          />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Budget</th>
                  <th>Purchases</th>
                </tr>
              </thead>
              <tbody>
                {records
                  .filter((r) => r.kind === "project")
                  .map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{inr(p.budget ?? 0)}</td>
                      <td>
                        {inr(
                          records
                            .filter(
                              (r) =>
                                r.kind === "purchase" && r.projectId === p.id,
                            )
                            .reduce((n, r) => n + Number(r.amount ?? 0), 0),
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="report-note">
            Purchase orders are commitments, not confirmed costs. Labour,
            supplier invoices and final profit require reconciliation.
          </p>
        </section>
      </div>
    </>
  );
}
