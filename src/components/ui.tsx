"use client";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { X, ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import { inr } from "@/domain/pricing";
export function Badge({ children }: { children: ReactNode }) {
  const text = String(children);
  const tone =
    /Accepted|Published|Won|Done|Confirmed|Completed|Received|Resolved|Paid|Active|Signed/.test(
      text,
    )
      ? "green"
      : /Overdue|Lost|Rejected|Reversed|Urgent|Failed|Unknown/.test(text)
        ? "red"
        : /Draft|New|Open|Logged/.test(text)
          ? "neutral"
          : "amber";
  return (
    <span className={`badge ${tone}`}>
      <span />
      {children}
    </span>
  );
}
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  const colors = ["sage", "sand", "clay", "blue"];
  return (
    <span
      className={`avatar ${colors[name.charCodeAt(0) % 4]} ${small ? "small" : ""}`}
    >
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
export function Empty({
  title = "Nothing here yet",
  description = "Create your first record to get started.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">✧</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  inline = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  inline?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!inline) el?.showModal();
    return () => el?.close();
  }, [inline]);
  if (inline)
    return (
      <section className="inline-document">
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="button secondary" onClick={onClose}>
            ← Back
          </button>
        </header>
        {children}
      </section>
    );
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="modal-header">
        <div>
          <span className="eyebrow">HUTĀŚANA WORKSPACE</span>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const control = isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, {
        "aria-labelledby": `${id}-label`,
        "aria-describedby": hint ? `${id}-hint` : undefined,
      })
    : children;
  return (
    <label className="field">
      <span id={`${id}-label`}>{label}</span>
      {control}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}
export function Amount({ value }: { value: string | number }) {
  return <span className="amount">{inr(value)}</span>;
}
export function FilterBar({
  search,
  setSearch,
  status,
  setStatus,
  statuses,
  count,
}: {
  search: string;
  setSearch: (s: string) => void;
  status: string;
  setStatus: (s: string) => void;
  statuses: string[];
  count: number;
}) {
  return (
    <div className="filter-bar">
      <div className="search-input">
        <Search size={17} />
        <input
          aria-label="Search records"
          placeholder="Search by name, customer, locality…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="filter-right">
        <SlidersHorizontal size={15} />
        <select
          aria-label="Filter status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="count">{count} records</span>
      </div>
    </div>
  );
}
export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a className="text-link" href={href}>
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
