"use client";

import { useCallback, useEffect, useState } from "react";
import type { CRMRecord } from "@/domain/types";
import type {
  QuotationFollowup,
  WhatsAppContact,
  WhatsAppMessage,
} from "@/lib/whatsapp/types";
import { useWorkspace } from "./workspace-provider";

type Status = {
  configured: boolean;
  templateName: string | null;
  templateLanguage: string | null;
  messages: WhatsAppMessage[];
  followups: QuotationFollowup[];
  contact: WhatsAppContact | null;
};

const messageLabel: Record<WhatsAppMessage["status"], string> = {
  pending: "Submission pending — verify before retrying",
  sent: "Submitted to WhatsApp — delivery pending",
  delivered: "Delivered to customer",
  read: "Read by customer",
  failed: "Delivery failed",
  unknown: "Outcome unknown — reconcile before retrying",
};

const dateLabel = (value?: string) =>
  value ? new Date(value).toLocaleString() : "Not recorded";

export function QuoteWhatsApp({
  quote,
  customer,
  canSend,
}: {
  quote: CRMRecord;
  customer?: CRMRecord;
  canSend: boolean;
}) {
  const { demo, refresh } = useWorkspace();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (demo) return;
    try {
      const response = await fetch(
        `/api/whatsapp/quotation/${encodeURIComponent(quote.id)}`,
        { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load WhatsApp status.");
      setStatus(body as Status);
      setNow(Date.now());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load WhatsApp status.");
    } finally {
      setLoading(false);
    }
  }, [demo, quote.id]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearTimeout(handle);
      window.clearInterval(clock);
    };
  }, [load]);

  const phone = customer?.phone?.replace(/[\s()+-]/g, "") ?? "";
  const validPhone = /^[1-9]\d{7,14}$/.test(phone);
  const contact = status?.contact;
  const windowOpen =
    !!contact &&
    contact.phoneNumber.replace(/[\s()+-]/g, "") === phone &&
    new Date(contact.serviceWindowExpiresAt ?? "").getTime() > now;
  const priorSubmission = status?.messages.some(
    (message) => message.direction === "outbound" && message.status !== "failed",
  );
  const sendBlock = demo
    ? "WhatsApp sending is unavailable in demo mode."
    : !status
      ? "WhatsApp status is unavailable."
      : !status.configured
        ? "WhatsApp provider credentials are not configured."
        : !canSend
          ? "Your role cannot send quotations."
          : !["Draft", "Shared"].includes(quote.status)
            ? "Only draft or shared quotations can be sent."
            : !customer || !quote.customerId
              ? "Select a customer for this quotation."
              : !validPhone
                ? "Save the customer's international phone number first."
                : !customer.consent || contact?.optInStatus === "opted_out"
                  ? "Record customer permission before sending."
                  : priorSubmission
                    ? "This quotation already has a submitted or unresolved message. Reconcile before retrying."
                    : !windowOpen && !status.templateName
                      ? "The service window is closed. Configure an approved PDF template first."
                      : "";

  const send = async () => {
    if (sendBlock || !customer || !quote.customerId) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotationId: quote.id,
          customerId: quote.customerId,
          phoneNumber: phone,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "WhatsApp submission failed.");
      setNotice("Submitted to WhatsApp. Delivery is pending provider confirmation.");
      refresh();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "WhatsApp submission failed.");
      await load();
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="quote-whatsapp" aria-label="WhatsApp quotation">
      <h3>WhatsApp quotation</h3>
      <p>
        Recipient: {customer?.name ?? "No customer selected"} · {customer?.phone || "No phone saved"}
      </p>
      <p>
        Permission: {customer?.consent ? "Recorded" : "Missing"}
        {customer?.consentNote ? ` · ${customer.consentNote}` : ""}
        {contact?.optInStatus === "opted_out" ? " · Customer opted out" : ""}
      </p>
      <p>
        Delivery method: {windowOpen
          ? "PDF inside the customer service window"
          : status?.templateName
            ? `Approved PDF template (${status.templateName}${status.templateLanguage ? `, ${status.templateLanguage}` : ""}) outside the service window`
            : "Approved PDF template required outside the service window"}
      </p>
      {loading && <p>Loading WhatsApp status…</p>}
      {sendBlock && <p role="status">{sendBlock}</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button className="button primary" disabled={!!sendBlock || sending || loading} onClick={() => void send()}>
        {sending ? "Submitting…" : "Send quotation on WhatsApp"}
      </button>
      {!!status?.messages.length && (
        <div className="quote-whatsapp-history">
          <h4>Messages</h4>
          {status.messages.map((message) => (
            <div className="audit-row" key={message.id}>
              <span>
                {message.direction === "inbound"
                  ? "Customer reply"
                  : message.followupId
                    ? "Follow-up"
                    : "Quotation"} · {messageLabel[message.status]} · {dateLabel(message.sentAt ?? message.createdAt)}
                {message.errorMessage ? ` · ${message.errorMessage}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
      {!!status?.followups.length && (
        <div className="quote-whatsapp-history">
          <h4>Follow-ups</h4>
          {status.followups.map((followup) => (
            <div className="audit-row" key={followup.id}>
              <span>
                {followup.status} · {dateLabel(followup.scheduledAt)}
                {followup.skipReason ? ` · ${followup.skipReason}` : ""}
                {followup.lastError ? ` · ${followup.lastError}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
