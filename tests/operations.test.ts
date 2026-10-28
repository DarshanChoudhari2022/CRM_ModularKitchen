import { expect, it } from "vitest";
import { execute } from "../src/domain/commands";
import { emptyWorkspace } from "../src/domain/seed";
import { availableReceipt, balanceFor } from "../src/domain/pricing";
import type { Command, CRMRecord } from "../src/domain/types";
const now = "2026-10-28T10:00:00Z",
  owner = { userId: "owner", role: "owner" as const };
const base = (
  id: string,
  kind: CRMRecord["kind"],
  rest: Partial<CRMRecord> = {},
): CRMRecord => ({
  id,
  kind,
  name: "Test record",
  status: "Draft",
  createdAt: now,
  updatedAt: now,
  ...rest,
});
it("releases an allocation with recorded reason before credit and refund of a paid invoice", () => {
  let s = emptyWorkspace();
  s.records = [
    base("c", "customer", { status: "Active" }),
    base("i", "invoice", { status: "Issued", customerId: "c", amount: "1000" }),
    base("r", "receipt", {
      status: "Confirmed",
      customerId: "c",
      amount: "1000",
      allocations: [{ invoiceId: "i", amount: "1000" }],
    }),
  ];
  s = execute(
    s,
    {
      type: "unallocate",
      receiptId: "r",
      invoiceId: "i",
      amount: "200",
      reason: "Customer returned an accessory",
    } as Command,
    owner,
    now,
  );
  expect(balanceFor(s.records[1], s.records)).toBe("200.00");
  expect(availableReceipt(s.records[2])).toBe("200.00");
  s = execute(
    s,
    { type: "credit", id: "i", amount: "200", reason: "Returned accessory" },
    owner,
    now,
  );
  s = execute(
    s,
    {
      type: "refund",
      id: "r",
      amount: "200",
      reason: "Bank refund reference REF-1",
    },
    owner,
    now,
  );
  expect(balanceFor(s.records[1], s.records)).toBe("0.00");
  expect(availableReceipt(s.records[2])).toBe("0.00");
  expect(() =>
    execute(
      s,
      {
        type: "unallocate",
        receiptId: "r",
        invoiceId: "i",
        amount: "900",
        reason: "Invalid reversal",
      } as Command,
      owner,
      now,
    ),
  ).toThrow();
});
it("receives purchase quantities partially and refuses over-receipts", () => {
  let s = emptyWorkspace();
  s.records = [
    base("po", "purchase", {
      status: "Ordered",
      items: [
        {
          id: "part",
          description: "Hinge pairs",
          sku: "H1",
          quantity: "10",
          unit: "pair",
          unitCost: "100",
          received: "0",
        },
      ],
    } as Partial<CRMRecord>),
  ];
  s = execute(
    s,
    {
      type: "receiveGoods",
      id: "po",
      quantities: [{ itemId: "part", quantity: "4" }],
      reference: "GRN-1",
    } as Command,
    owner,
    now,
  );
  expect(s.records[0].status).toBe("Part received");
  expect(() =>
    execute(
      s,
      {
        type: "receiveGoods",
        id: "po",
        quantities: [{ itemId: "part", quantity: "7" }],
        reference: "GRN-2",
      } as Command,
      owner,
      now,
    ),
  ).toThrow();
  s = execute(
    s,
    {
      type: "receiveGoods",
      id: "po",
      quantities: [{ itemId: "part", quantity: "6" }],
      reference: "GRN-2",
    } as Command,
    owner,
    now,
  );
  expect(s.records[0].status).toBe("Received");
});
it("requires explicit customer evidence to approve a scope change", () => {
  const s = emptyWorkspace();
  s.records = [
    base("c", "customer", { status: "Active" }),
    base("p", "project", { status: "Design", customerId: "c" }),
    base("change", "changeOrder" as CRMRecord["kind"], {
      status: "Draft",
      customerId: "c",
      projectId: "p",
      amount: "1000",
      notes: "Additional tall pantry unit",
    }),
  ];
  expect(() =>
    execute(
      s,
      { type: "transition", id: "change", status: "Approved" },
      owner,
      now,
    ),
  ).toThrow();
  const next = execute(
    s,
    {
      type: "transition",
      id: "change",
      status: "Approved",
      evidence: "Customer confirmation attached under reference A1",
    },
    owner,
    now,
  );
  expect(next.records[2].status).toBe("Approved");
  expect(() =>
    execute(
      next,
      { type: "save", record: { ...next.records[2], amount: "9999" } },
      owner,
      now,
    ),
  ).toThrow(/immutable/i);
});
it("versions catalog rates without changing historical rates", () => {
  let s = emptyWorkspace();
  s.records = [
    base("sku1", "catalog", {
      name: "Board",
      status: "Published",
      sku: "B1",
      unit: "piece",
      rate: "100",
      cost: "60",
      revision: 1,
    }),
  ];
  s = execute(s, { type: "newVersion", id: "sku1" } as Command, owner, now);
  const next = s.records.find((r) => r.id !== "sku1")!;
  expect(next.status).toBe("Draft");
  expect(next.revision).toBe(2);
  s = execute(
    s,
    { type: "save", record: { ...next, rate: "120" } },
    owner,
    now,
  );
  s = execute(
    s,
    { type: "transition", id: next.id, status: "Published" },
    owner,
    now,
  );
  expect(s.records.find((r) => r.id === "sku1")?.rate).toBe("100");
  expect(s.records.find((r) => r.id === "sku1")?.status).toBe("Retired");
});
