import { describe, expect, it } from "vitest";
import {
  calculateQuote,
  balanceFor,
  availableReceipt,
} from "../src/domain/pricing";
import {
  execute,
  canWrite,
  reminderEligible,
  redactWorkspace,
} from "../src/domain/commands";
import { emptyWorkspace } from "../src/domain/seed";
import type { CRMRecord, QuoteLine, Workspace } from "../src/domain/types";

const now = "2026-10-28T10:00:00.000Z";
const owner = { userId: "owner", role: "owner" as const };
const line: QuoteLine = {
  id: "line-1",
  description: "Fictional base unit",
  zone: "Base",
  method: "area",
  quantity: "1",
  width: "2400",
  height: "750",
  depth: "560",
  unit: "ft2",
  rate: "1000",
  cost: "500",
  discount: "0",
  taxRate: "0",
  hsn: "",
  catalogId: "",
};
function invoiceState(): Workspace {
  const s = emptyWorkspace();
  s.settings = {
    ...s.settings,
    billingName: "Test Kitchen",
    billingAddress: "Pune",
    taxReviewed: true,
  };
  s.records = [
    {
      id: "c1",
      kind: "customer",
      name: "Test Client",
      status: "Active",
      createdAt: now,
      updatedAt: now,
      phone: "+919876543210",
      address: "Test address, Pune",
      consent: true,
    },
    {
      id: "i1",
      kind: "invoice",
      name: "Test invoice",
      customerId: "c1",
      status: "Draft",
      createdAt: now,
      updatedAt: now,
      lines: [{ ...line, method: "item", quantity: "1", unit: "piece" }],
    },
  ];
  return s;
}

describe("authoritative pricing", () => {
  it("uses elevation area, exact mm conversion, and per-line paise rounding", () => {
    const result = calculateQuote([line]);
    expect(result.total).toBe("19375.04");
    expect(result.lines[0].billableQuantity).toBe("19.37503875");
    expect(result.cost).toBe("9687.52");
  });
  it("apportions discount before line tax without binary float errors", () => {
    const result = calculateQuote([
      {
        ...line,
        method: "item",
        unit: "piece",
        quantity: "3",
        rate: "0.10",
        cost: "0",
        discount: "10",
        taxRate: "18",
      },
    ]);
    expect(result.subtotal).toBe("0.30");
    expect(result.discount).toBe("0.03");
    expect(result.tax).toBe("0.05");
    expect(result.total).toBe("0.32");
  });
  it("rejects negative rates, invalid units, excessive tax and dimensionless area", () => {
    expect(() => calculateQuote([{ ...line, rate: "-1" }])).toThrow();
    expect(() => calculateQuote([{ ...line, unit: "piece" }])).toThrow();
    expect(() => calculateQuote([{ ...line, taxRate: "101" }])).toThrow();
    expect(() => calculateQuote([{ ...line, width: "0" }])).toThrow();
  });
  it("does not multiply running length by depth or height", () => {
    expect(
      calculateQuote([
        { ...line, method: "length", unit: "ft", rate: "100", quantity: "1" },
      ]).total,
    ).toBe("787.40");
  });
});

describe("financial transitions", () => {
  it("requires verified billing configuration before issuing", () => {
    const s = invoiceState();
    s.settings.taxReviewed = false;
    expect(() =>
      execute(s, { type: "issueInvoice", id: "i1" }, owner, now),
    ).toThrow(/billing|tax/i);
  });
  it("issues financial-year numbers and freezes issued invoice content", () => {
    const s = execute(
      invoiceState(),
      { type: "issueInvoice", id: "i1" },
      owner,
      now,
    );
    expect(s.records.find((r) => r.id === "i1")?.number).toBe(
      "HT/2026-27/0001",
    );
    const invoice = s.records.find((r) => r.id === "i1")!;
    expect(() =>
      execute(
        s,
        { type: "save", record: { ...invoice, name: "Changed" } },
        owner,
        now,
      ),
    ).toThrow(/immutable|issued/i);
  });
  it("retains advances, allocates once, reverses with history and never double subtracts", () => {
    let s = execute(
      invoiceState(),
      { type: "issueInvoice", id: "i1" },
      owner,
      now,
    );
    s = execute(
      s,
      {
        type: "receive",
        invoiceId: "i1",
        amount: "1200",
        reference: "BANK-01",
        receivedOn: "2026-10-28",
      },
      owner,
      now,
    );
    const invoice = s.records.find((r) => r.id === "i1")!;
    const receipt = s.records.find((r) => r.kind === "receipt")!;
    expect(balanceFor(invoice, s.records)).toBe("0.00");
    expect(availableReceipt(receipt)).toBe("200.00");
    expect(() =>
      execute(
        s,
        {
          type: "allocate",
          receiptId: receipt.id,
          invoiceId: "i1",
          amount: "1",
        },
        owner,
        now,
      ),
    ).toThrow();
    s = execute(
      s,
      {
        type: "reverseReceipt",
        id: receipt.id,
        reason: "Bank transfer reversed",
      },
      owner,
      now,
    );
    expect(balanceFor(invoice, s.records)).toBe("1000.00");
    expect(s.records.find((r) => r.id === receipt.id)?.status).toBe("Reversed");
  });
  it("rejects a duplicate bank reference for the same customer", () => {
    let s = execute(
      invoiceState(),
      { type: "issueInvoice", id: "i1" },
      owner,
      now,
    );
    s = execute(
      s,
      {
        type: "receive",
        invoiceId: "i1",
        amount: "10",
        reference: "BANK-01",
        receivedOn: "2026-10-28",
      },
      owner,
      now,
    );
    expect(() =>
      execute(
        s,
        {
          type: "receive",
          invoiceId: "i1",
          amount: "10",
          reference: "BANK-01",
          receivedOn: "2026-10-28",
        },
        owner,
        now,
      ),
    ).toThrow(/reference/i);
  });
  it("forks a shared quote without changing its rates or terms", () => {
    const s = emptyWorkspace();
    s.records = [
      {
        id: "q1",
        kind: "quote",
        name: "Kitchen",
        status: "Shared",
        revision: 1,
        lines: [line],
        terms: "Original",
        createdAt: now,
        updatedAt: now,
      },
    ];
    expect(() =>
      execute(
        s,
        { type: "save", record: { ...s.records[0], terms: "New" } },
        owner,
        now,
      ),
    ).toThrow(/immutable|revision/i);
    const next = execute(s, { type: "reviseQuote", id: "q1" }, owner, now);
    expect(next.records).toHaveLength(2);
    expect(next.records.find((r) => r.id === "q1")?.terms).toBe("Original");
    expect(next.records.find((r) => r.id !== "q1")?.revision).toBe(2);
  });
});

describe("permissions and communications", () => {
  it("requires owner reconciliation before resolving an unknown provider submission", () => {
    const s = emptyWorkspace();
    s.jobs = [
      {
        id: "job",
        invoiceId: "i1",
        customerId: "c1",
        dueAt: now,
        status: "Unknown",
        attempts: 1,
        message: "Timeout",
      },
    ];
    expect(() =>
      execute(
        s,
        {
          type: "resolveJob",
          id: "job",
          status: "Failed",
          reason: "Checked provider logs; not submitted",
        } as never,
        { userId: "sales", role: "sales" },
        now,
      ),
    ).toThrow();
    const next = execute(
      s,
      {
        type: "resolveJob",
        id: "job",
        status: "Failed",
        reason: "Checked provider logs; not submitted",
      } as never,
      owner,
      now,
    );
    expect(next.jobs[0].status).toBe("Failed");
  });
  it("returns authoritative balances when a role cannot view receipt details", () => {
    let s = execute(
      invoiceState(),
      { type: "issueInvoice", id: "i1" },
      owner,
      now,
    );
    s = execute(
      s,
      {
        type: "receive",
        invoiceId: "i1",
        amount: "1000",
        reference: "PAID",
        receivedOn: "2026-10-28",
      },
      owner,
      now,
    );
    const view = redactWorkspace(s, { userId: "sales", role: "sales" });
    expect(view.records.some((r) => r.kind === "receipt")).toBe(false);
    expect(
      balanceFor(
        view.records.find((r) => r.id === "i1")!,
        view.records,
      ),
    ).toBe("0.00");
  });
  it("preserves hidden purchase costs when accounts edits an invoice draft", () => {
    const s = invoiceState();
    const accounts = { userId: "accounts", role: "accounts" as const };
    const visible = redactWorkspace(s, accounts).records.find(
      (r) => r.id === "i1",
    )!;
    expect(visible.lines?.[0].cost).toBe("0");
    const next = execute(
      s,
      { type: "save", record: { ...visible, name: "Updated title" } },
      accounts,
      now,
    );
    expect(next.records.find((r) => r.id === "i1")?.lines?.[0].cost).toBe(
      "500",
    );
  });
  it("lets installers update their own linked tasks without granting access to customer records", () => {
    const s = invoiceState();
    s.records.push({
      id: "t1",
      kind: "task",
      name: "Install kitchen",
      status: "Open",
      owner: "installer",
      customerId: "c1",
      createdAt: now,
      updatedAt: now,
    });
    const next = execute(
      s,
      { type: "save", record: { ...s.records[2], notes: "Site ready" } },
      { userId: "installer", role: "installer" },
      now,
    );
    expect(next.records.find((r) => r.id === "t1")?.notes).toBe("Site ready");
    expect(
      redactWorkspace(next, { userId: "installer", role: "installer" }).records,
    ).toHaveLength(1);
  });
  it("does not apply installer record permissions to internal suppression checks", () => {
    const s = invoiceState();
    s.records.push({
      id: "own-task",
      kind: "task",
      name: "Install",
      status: "Open",
      owner: "installer",
      createdAt: now,
      updatedAt: now,
    });
    s.jobs = [
      {
        id: "pending",
        invoiceId: "i1",
        customerId: "c1",
        dueAt: now,
        status: "Pending",
        attempts: 0,
        message: "Reminder",
      },
    ];
    const next = execute(
      s,
      { type: "transition", id: "own-task", status: "Done" },
      { userId: "installer", role: "installer" },
      now,
    );
    expect(next.records.find((r) => r.id === "own-task")?.status).toBe("Done");
  });
  it("blocks installers from financial writes and sales from invoice issue", () => {
    expect(canWrite("installer", "invoice")).toBe(false);
    expect(() =>
      execute(
        invoiceState(),
        { type: "issueInvoice", id: "i1" },
        { userId: "sales", role: "sales" },
        now,
      ),
    ).toThrow(/permission/i);
    expect(() =>
      execute(
        invoiceState(),
        { type: "settings", settings: { billingName: "Stolen" } },
        { userId: "sales", role: "sales" },
        now,
      ),
    ).toThrow(/permission/i);
  });
  it("suppresses paid, disputed, paused and opted-out reminders", () => {
    const s = invoiceState();
    const invoice = s.records[1];
    invoice.status = "Issued";
    expect(reminderEligible(invoice, s.records)).toBe(true);
    s.records[0].consent = false;
    expect(reminderEligible(invoice, s.records)).toBe(false);
    s.records[0].consent = true;
    invoice.disputed = true;
    expect(reminderEligible(invoice, s.records)).toBe(false);
    invoice.disputed = false;
    invoice.paused = true;
    expect(reminderEligible(invoice, s.records)).toBe(false);
    invoice.paused = false;
    invoice.status = "Draft";
    expect(reminderEligible(invoice, s.records)).toBe(false);
  });
  it("requires owner approval to accept quotations with no customer", () => {
    const s = emptyWorkspace();
    s.records = [
      {
        id: "q1",
        kind: "quote",
        name: "Kitchen",
        status: "Draft",
        lines: [line],
        createdAt: now,
        updatedAt: now,
      } as CRMRecord,
    ];
    expect(() =>
      execute(
        s,
        { type: "transition", id: "q1", status: "Shared" },
        owner,
        now,
      ),
    ).toThrow(/customer/i);
  });
});
