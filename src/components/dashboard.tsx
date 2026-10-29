"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Users,
  FileText,
  IndianRupee,
  PanelsTopLeft,
  Clock3,
  Check,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { modules } from "@/config/modules";
import { collectionSummary } from "@/domain/commands";
import { balanceFor, businessDate, documentTotal, inr } from "@/domain/pricing";
import type { CRMRecord } from "@/domain/types";
import { useWorkspace } from "./workspace-provider";
import { Avatar, Badge, Empty, SectionHeader, TextLink } from "./ui";
import { QuoteEditor } from "./quote-editor";
import { RecordDetail } from "./record-detail";
import { RecordForm } from "./record-form";

function KitchenDrawing() {
  return (
    <svg viewBox="0 0 330 160" fill="none" aria-hidden="true">
      <path
        d="M15 139H315M32 139V77H298V139M32 82H298M111 82V139M204 82V139M49 99H92M222 99H282M222 119H282M164 83V139M125 101H151"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M32 23H109V65H32zM119 23H194V65H119zM204 23H278V65H204zM70 23V65M156 23V65M242 23V65M47 61H56M133 61H142M219 61H228M124 78V67C124 61 136 61 136 67V71M115 78H153M219 78H272M228 73H242M252 73H266"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M290 78V59M285 59C275 49 280 43 287 46C287 32 303 33 298 48C312 46 311 61 290 62"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M284 78H299L302 65H281z" stroke="currentColor" />
      <rect
        x="172"
        y="92"
        width="23"
        height="27"
        rx="2"
        stroke="currentColor"
      />
      <circle cx="179" cy="88" r="1.5" fill="currentColor" />
      <circle cx="188" cy="88" r="1.5" fill="currentColor" />
      <path d="M32 139V145M298 139V145M29 149H301" stroke="currentColor" />
    </svg>
  );
}
export function Dashboard() {
  const router = useRouter();
  const { workspace, actor, run } = useWorkspace();
  const [newQuote, setNewQuote] = useState(false),
    [newLead, setNewLead] = useState(false),
    [selected, setSelected] = useState<CRMRecord | null>(null);
  if (!workspace) return null;
  const records = workspace.records,
    today = businessDate();
  const leads = records.filter(
    (r) => r.kind === "lead" && !["Won", "Lost"].includes(r.status),
  );
  const quotes = records.filter(
    (r) => r.kind === "quote" && ["Draft", "Shared"].includes(r.status),
  );
  const projects = records.filter(
    (r) => r.kind === "project" && r.status !== "Completed",
  );
  const tasks = records
    .filter((r) => r.kind === "task" && r.status !== "Done")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const overdue = records.filter(
    (r) =>
      r.kind === "invoice" &&
      r.status === "Issued" &&
      (r.dueDate ?? "9999") < today &&
      Number(balanceFor(r, records)) > 0,
  );
  const summary = workspace.financialSummary ?? collectionSummary(records);
  const months =
    workspace.monthlyActivity ??
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 5 + i);
      const key = d.toISOString().slice(0, 7);
      return {
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        billed: records
          .filter(
            (r) =>
              r.kind === "invoice" &&
              r.status === "Issued" &&
              r.issuedAt?.startsWith(key),
          )
          .reduce((n, r) => n + Number(documentTotal(r)), 0),
        collected: records
          .filter(
            (r) =>
              r.kind === "receipt" &&
              r.status === "Confirmed" &&
              r.dueDate?.startsWith(key),
          )
          .reduce((n, r) => n + Number(r.amount ?? 0), 0),
      };
    });
  const max = Math.max(100, ...months.flatMap((m) => [m.billed, m.collected]));
  const sources = Array.from(new Set(leads.map((r) => r.source ?? "Manual")))
    .map((source) => ({
      name: source,
      count: leads.filter((r) => (r.source ?? "Manual") === source).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const customer = (r: CRMRecord) =>
    records.find((c) => c.id === r.customerId)?.name ?? "";
  return (
    <>
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">A SPACE FOR EVERYTHING</span>
          <h1>
            Your business, in good order<span className="heading-dot">.</span>
          </h1>
          <p>Here’s what’s happening at your studio today.</p>
        </div>
        <div className="date-chip">
          <CalendarDays size={16} />
          {new Date().toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          })}
        </div>
      </div>
      <Link href="/invoices" className="invoice-module-card"><span>↗</span><div><strong>Invoices</strong><p>Dashboard, billing, quotations, receipts and kitchen rate cards</p></div></Link>
      <section className="welcome-banner">
        <div>
          <span className="eyebrow">LESS ADMIN. MORE CRAFT.</span>
          <h2>
            Great kitchens begin
            <br />
            with the details.
          </h2>
          <p>
            Your enquiries, estimates and projects.
            <br />
            One thoughtfully connected workspace.
          </p>
          <div className="button-group">
            {["owner", "estimator"].includes(actor.role) && (
              <button
                className="button primary"
                onClick={() => setNewQuote(true)}
              >
                Create quotation
                <ArrowUpRight size={16} />
              </button>
            )}
            {["owner", "sales"].includes(actor.role) && (
              <button className="banner-link" onClick={() => setNewLead(true)}>
                Add an enquiry
                <Plus size={15} />
              </button>
            )}
          </div>
        </div>
        <div className="banner-drawing">
          <span>FROM FIRST IDEA TO FINAL FIT.</span>
          <KitchenDrawing />
          <small>DESIGNED FOR THE WAY YOU WORK</small>
        </div>
        <div className="banner-index">01 / YOUR STUDIO</div>
      </section>
      <div className="stats-grid">
        {[
          {
            label: "Active enquiries",
            value: String(leads.length),
            meta: `${leads.filter((r) => r.status === "New").length} waiting for a first response`,
            Icon: Users,
            href: "leads",
            tone: "sage",
          },
          {
            label: "Open quotations",
            value: String(quotes.length),
            meta: `${inr(quotes.reduce((n, r) => n + Number(documentTotal(r)), 0))} in the pipeline`,
            Icon: FileText,
            href: "quotations",
            tone: "sand",
          },
          {
            label: "Outstanding balance",
            value: inr(summary.outstanding),
            meta: `${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"} to review`,
            Icon: IndianRupee,
            href: "invoices",
            tone: "clay",
          },
          {
            label: "Projects in motion",
            value: String(projects.length),
            meta: `${projects.filter((r) => r.status === "Installation").length} at installation stage`,
            Icon: PanelsTopLeft,
            href: "projects",
            tone: "blue",
          },
        ].map(({ label, value, meta, Icon, href, tone }) => (
          <Link href={`/${href}`} className="stat-card" key={label}>
            <div>
              <span>{label}</span>
              <span className={`stat-icon ${tone}`}>
                <Icon size={18} />
              </span>
            </div>
            <strong>{value}</strong>
            <p>
              {meta}
              <ArrowUpRight size={13} />
            </p>
          </Link>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel revenue-panel">
          <SectionHeader
            title="Business at a glance"
            subtitle="Issued invoices and confirmed collections"
            action={
              <Link className="quiet-link" href="/reports">
                Last 6 months
                <ChevronRight size={14} />
              </Link>
            }
          />
          <div className="revenue-total">
            <strong>{inr(summary.net)}</strong>
            <span>net collections recorded</span>
            <div className="chart-legend">
              <span>
                <i />
                Invoiced
              </span>
              <span>
                <i />
                Collected
              </span>
            </div>
          </div>
          <div className="bar-chart">
            <div className="chart-axis">
              {[1, 0.75, 0.5, 0.25, 0].map((n) => (
                <span key={n}>
                  {max * n >= 100000
                    ? `${((max * n) / 100000).toFixed(1)}L`
                    : max * n >= 1000
                      ? `${Math.round((max * n) / 1000)}k`
                      : Math.round(max * n)}
                </span>
              ))}
            </div>
            <div className="chart-plot">
              <div className="chart-grid">
                {[0, 1, 2, 3, 4].map((n) => (
                  <i key={n} />
                ))}
              </div>
              {months.map((m) => (
                <div className="chart-group" key={m.label}>
                  <div className="bars">
                    <div
                      className="bar invoiced"
                      style={{ height: `${(m.billed / max) * 100}%` }}
                      title={`${m.label} invoiced: ${inr(m.billed)}`}
                    />
                    <div
                      className="bar collected"
                      style={{ height: `${(m.collected / max) * 100}%` }}
                      title={`${m.label} collected: ${inr(m.collected)}`}
                    />
                  </div>
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-footnote">
            Based on records in this workspace. Advances and invoices are
            reported separately.
          </div>
        </section>
        <section className="panel source-panel">
          <SectionHeader
            title="Where enquiries begin"
            subtitle="Active leads by first recorded source"
            action={<ArrowUpRight size={18} />}
          />
          <div className="source-total">
            <strong>{leads.length}</strong>
            <span>active enquiries</span>
          </div>
          <div className="source-bars">
            {sources.length ? (
              sources.map((s, i) => (
                <div className="source-metric" key={s.name}>
                  <div>
                    <span>
                      <i className={`source-dot source-${i}`} />
                      {s.name}
                    </span>
                    <strong>
                      {s.count}
                      <small>
                        {Math.round(
                          (s.count / Math.max(leads.length, 1)) * 100,
                        )}
                        %
                      </small>
                    </strong>
                  </div>
                  <div className="progress-track">
                    <span
                      className={`source-fill source-${i}`}
                      style={{
                        width: `${(s.count / Math.max(leads.length, 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <Empty
                title="No enquiries yet"
                description="Your sources will appear as leads arrive."
              />
            )}
          </div>
          <TextLink href="/reports">Explore lead performance</TextLink>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel recent-leads">
          <SectionHeader
            title="Conversations to move forward"
            subtitle="A timely follow-up makes all the difference."
            action={<TextLink href="/leads">All enquiries</TextLink>}
          />
          {leads.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Enquiry</th>
                    <th>Source</th>
                    <th>Stage</th>
                    <th>Budget</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 4).map((r) => (
                    <tr key={r.id}>
                      <td>
                        <button
                          className="record-name"
                          onClick={() => setSelected(r)}
                        >
                          <Avatar name={r.name} />
                          <span>
                            <strong>{r.name}</strong>
                            <small>{r.locality ?? "Locality not set"}</small>
                          </span>
                        </button>
                      </td>
                      <td>{r.source ?? "Manual"}</td>
                      <td>
                        <Badge>{r.status}</Badge>
                      </td>
                      <td className="amount">
                        {r.budget ? inr(r.budget) : "Not set"}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`View ${r.name}`}
                          onClick={() => setSelected(r)}
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Ready for your next enquiry" />
          )}
        </section>
        <section className="panel today-panel">
          <SectionHeader
            title="On your radar"
            subtitle={`${tasks.length} open tasks · keep things moving`}
            action={<Clock3 size={18} />}
          />
          <div className="today-tasks">
            {tasks.length ? (
              tasks.slice(0, 4).map((task) => (
                <div className="today-task" key={task.id}>
                  <button
                    className="task-check"
                    aria-label={`Complete ${task.name}`}
                    onClick={() =>
                      void run({
                        type: "transition",
                        id: task.id,
                        status: "Done",
                      })
                    }
                  >
                    <Check size={13} />
                  </button>
                  <button
                    className="task-title"
                    onClick={() => setSelected(task)}
                  >
                    <strong>{task.name}</strong>
                    <span>
                      {task.owner ?? "Unassigned"} <i>·</i>{" "}
                      <b
                        className={
                          (task.dueDate ?? "") < today ? "overdue-text" : ""
                        }
                      >
                        {task.dueDate === today
                          ? "Today"
                          : (task.dueDate ?? "No date")}
                      </b>
                    </span>
                  </button>
                  {task.priority === "High" && (
                    <span className="priority-dot" />
                  )}
                </div>
              ))
            ) : (
              <Empty
                title="A little breathing room"
                description="No open tasks right now."
              />
            )}
          </div>
          <TextLink href="/tasks">View all tasks</TextLink>
        </section>
      </div>
      <section className="panel projects-panel">
        <SectionHeader
          title="Taking shape"
          subtitle="A little closer to someone's dream kitchen."
          action={<TextLink href="/projects">All projects</TextLink>}
        />
        <div className="project-cards">
          {projects.slice(0, 3).map((project, i) => {
            const stages = modules.find((m) => m.kind === "project")!.statuses;
            const step = stages.indexOf(project.status) + 1;
            return (
              <button
                className={`project-card project-${i}`}
                key={project.id}
                onClick={() => setSelected(project)}
              >
                <div className="project-card-top">
                  <span className="project-number">
                    PROJECT {String(i + 1).padStart(2, "0")}
                  </span>
                  <ArrowUpRight size={18} />
                </div>
                <h3>{project.name}</h3>
                <p>
                  {customer(project)} · {project.locality ?? "Pune"}
                </p>
                <div className="project-progress">
                  <span style={{ width: `${(step / stages.length) * 100}%` }} />
                </div>
                <div className="project-card-bottom">
                  <Badge>{project.status}</Badge>
                  <span>
                    {step} of {stages.length} stages
                  </span>
                </div>
              </button>
            );
          })}
          {!projects.length && (
            <Empty
              title="Your next project starts here"
              action={
                <Link className="button secondary" href="/projects">
                  Add a project
                  <ArrowRight size={15} />
                </Link>
              }
            />
          )}
        </div>
      </section>
      {newQuote && <QuoteEditor onClose={() => setNewQuote(false)} />}{" "}
      {newLead && <RecordForm kind="lead" onClose={() => setNewLead(false)} />}{" "}
      {selected && (
        <RecordDetail
          record={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setSelected(null);
            router.push(
              `/${modules.find((m) => m.kind === selected.kind)?.slug}?record=${selected.id}`,
            );
          }}
        />
      )}
    </>
  );
}
