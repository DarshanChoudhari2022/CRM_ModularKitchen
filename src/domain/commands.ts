import {
  commandSchema,
  type Actor,
  type CRMRecord,
  type Command,
  type Kind,
  type Role,
  type Workspace,
} from "./types";
import {
  availableReceipt,
  balanceFor,
  businessDate,
  calculateQuote,
  D,
  financialYear,
  money,
  sum,
} from "./pricing";

const permissions: Record<Role, Kind[]> = {
  owner: [
    "lead",
    "customer",
    "project",
    "catalog",
    "quote",
    "invoice",
    "receipt",
    "task",
    "purchase",
    "service",
    "clause",
    "survey",
    "call",
    "bom",
    "changeOrder",
  ],
  estimator: [
    "customer",
    "quote",
    "survey",
    "clause",
    "task",
    "bom",
    "changeOrder",
  ],
  sales: ["lead", "customer", "task", "call"],
  accounts: ["customer", "invoice", "receipt", "task"],
  manager: [
    "project",
    "purchase",
    "survey",
    "task",
    "service",
    "bom",
    "changeOrder",
  ],
  installer: ["task", "service"],
};
export const canWrite = (role: Role, kind: Kind) =>
  permissions[role].includes(kind);
export const hasCosts = (role: Role) =>
  ["owner", "estimator", "manager"].includes(role);
export const canRead = (role: Role, kind: Kind) =>
  role === "installer"
    ? ["task", "service"].includes(kind)
    : role === "sales"
      ? !["receipt", "purchase"].includes(kind)
      : true;
function requirePermission(actor: Actor, kind: Kind) {
  if (!canWrite(actor.role, kind))
    throw new Error("Permission denied for this action.");
}
const graphs: Partial<Record<Kind, Record<string, string[]>>> = {
  quote: {
    Draft: ["Shared"],
    Shared: ["Accepted", "Rejected", "Expired"],
    Accepted: [],
    Rejected: [],
    Expired: [],
  },
  lead: {
    New: ["Contacted", "Lost"],
    Contacted: ["Qualified", "Lost", "On hold"],
    Qualified: ["Survey booked", "Lost", "On hold"],
    "Survey booked": ["Quote shared", "Lost"],
    "Quote shared": ["Negotiation", "Won", "Lost"],
    Negotiation: ["Won", "Lost", "On hold"],
    "On hold": ["Contacted", "Lost"],
    Won: [],
    Lost: ["New"],
  },
  project: {
    Survey: ["Design"],
    Design: ["Approval"],
    Approval: ["Procurement"],
    Procurement: ["Production"],
    Production: ["Installation"],
    Installation: ["Handover"],
    Handover: ["Completed"],
    Completed: [],
  },
  task: {
    Open: ["In progress", "Done"],
    "In progress": ["Done", "Open"],
    Done: ["Open"],
  },
  purchase: {
    Draft: ["Ordered"],
    Ordered: ["Part received", "Received"],
    "Part received": ["Received"],
    Received: [],
  },
  service: {
    Open: ["Scheduled", "In progress"],
    Scheduled: ["In progress"],
    "In progress": ["Resolved"],
    Resolved: ["Open"],
  },
  survey: { Draft: ["Reviewed"], Reviewed: ["Signed off"], "Signed off": [] },
  catalog: { Draft: ["Published"], Published: ["Retired"], Retired: [] },
  clause: { Draft: ["Published"], Published: ["Retired"], Retired: [] },
  bom: { Draft: ["Reviewed"], Reviewed: ["Approved"], Approved: [] },
  changeOrder: { Draft: ["Approved", "Rejected"], Approved: [], Rejected: [] },
};
export const nextStatuses = (record: CRMRecord) =>
  graphs[record.kind]?.[record.status] ?? [];
export function reminderEligible(
  invoice: CRMRecord,
  records: CRMRecord[],
): boolean {
  const contact = records.find(
    (r) => r.id === invoice.customerId && r.kind === "customer",
  );
  return (
    invoice.kind === "invoice" &&
    invoice.status === "Issued" &&
    !invoice.disputed &&
    !invoice.paused &&
    !!contact?.consent &&
    !!contact.phone &&
    new D(balanceFor(invoice, records)).gt(0)
  );
}
export function redactWorkspace(state: Workspace, actor: Actor): Workspace {
  const s = structuredClone(state);
  if (actor.role !== "installer")
    s.financialSummary = collectionSummary(state.records);
  if (actor.role === "sales")
    s.monthlyActivity = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 5 + i);
      const key = d.toISOString().slice(0, 7);
      return {
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        billed: state.records
          .filter(
            (r) =>
              r.kind === "invoice" &&
              r.status === "Issued" &&
              r.issuedAt?.startsWith(key),
          )
          .reduce(
            (n, r) => n + Number(r.calculation?.total ?? r.amount ?? 0),
            0,
          ),
        collected: state.records
          .filter(
            (r) =>
              r.kind === "receipt" &&
              r.status === "Confirmed" &&
              r.dueDate?.startsWith(key),
          )
          .reduce((n, r) => n + Number(r.amount ?? 0), 0),
      };
    });
  s.records = s.records.filter(
    (r) =>
      canRead(actor.role, r.kind) &&
      (actor.role !== "installer" || r.owner === actor.userId),
  );
  for (const record of s.records)
    if (record.kind === "invoice")
      record.receivableBalance = balanceFor(record, state.records);
  if (!hasCosts(actor.role))
    for (const r of s.records) {
      delete r.cost;
      if (r.lines) r.lines = r.lines.map((l) => ({ ...l, cost: "0" }));
      if (r.items) r.items = r.items.map((i) => ({ ...i, unitCost: "0" }));
      if (r.calculation) {
        r.calculation.cost = "0.00";
        r.calculation.margin = "0.00";
        r.calculation.lines = r.calculation.lines.map((l) => ({
          ...l,
          cost: "0",
          costTotal: "0",
        }));
      }
    }
  if (actor.role !== "owner") {
    s.audit = [];
    s.jobs = [];
  }
  return s;
}
export function execute(
  original: Workspace,
  raw: Command,
  actor: Actor,
  now = new Date().toISOString(),
): Workspace {
  const command = commandSchema.parse(raw);
  const s = structuredClone(original);
  const id = () => crypto.randomUUID();
  const get = (recordId: string, kind?: Kind) => {
    const record = s.records.find(
      (r) => r.id === recordId && (!kind || r.kind === kind),
    );
    if (!record) throw new Error("Record not found.");
    if (actor.role === "installer" && record.owner !== actor.userId)
      throw new Error("Permission denied: this record is not assigned to you.");
    return record;
  };
  const add = (record: CRMRecord) => {
    s.records.push(record);
    return record;
  };
  const stamp = (record: CRMRecord) => {
    record.updatedAt = now;
  };
  const amount = (value: string) => {
    const v = new D(value);
    if (v.lte(0) || v.decimalPlaces() > 2)
      throw new Error(
        "Amount must be positive with at most two decimal places.",
      );
    return v;
  };
  const save = (record: CRMRecord) => {
    requirePermission(actor, record.kind);
    const existing = s.records.find((r) => r.id === record.id);
    if (existing && existing.kind !== record.kind)
      throw new Error("Record type cannot change.");
    if (
      existing &&
      actor.role === "installer" &&
      existing.owner !== actor.userId
    )
      throw new Error("Permission denied.");
    if (actor.role === "installer" && record.owner !== actor.userId)
      throw new Error("Permission denied.");
    if (record.kind === "receipt")
      throw new Error("Use receipt commands to preserve the ledger.");
    if (existing?.kind === "invoice" && existing.status !== "Draft")
      throw new Error(
        "Issued invoices are immutable; use credit notes or collection controls.",
      );
    if (existing?.kind === "quote" && existing.status !== "Draft")
      throw new Error("Shared quotations are immutable; create a revision.");
    if (
      existing &&
      ["catalog", "clause", "changeOrder"].includes(existing.kind) &&
      existing.status !== "Draft"
    )
      throw new Error(
        "Published or approved records are immutable. Create a new version.",
      );
    if (existing?.kind === "survey" && existing.status === "Signed off")
      throw new Error(
        "Signed-off surveys are immutable. Create a new version.",
      );
    if (existing?.kind === "bom" && existing.status === "Approved")
      throw new Error("Approved BOM is immutable. Create a new version.");
    if (existing?.kind === "purchase" && existing.status !== "Draft")
      throw new Error(
        "Ordered purchases are immutable. Record goods receipts instead.",
      );
    if (existing && record.status !== existing.status)
      throw new Error("Use a workflow transition to change status.");
    const initial: Record<Kind, string> = {
      lead: "New",
      customer: "Active",
      project: "Survey",
      catalog: "Draft",
      quote: "Draft",
      invoice: "Draft",
      receipt: "Confirmed",
      task: "Open",
      purchase: "Draft",
      service: "Open",
      clause: "Draft",
      survey: "Draft",
      call: "Logged",
      bom: "Draft",
      changeOrder: "Draft",
    };
    if (!existing && record.status !== initial[record.kind])
      throw new Error(
        `New ${record.kind} must start as ${initial[record.kind]}.`,
      );
    const linked = (linkedId: string, kind: Kind) => {
      if (!s.records.some((r) => r.id === linkedId && r.kind === kind))
        throw new Error("Linked record not found.");
    };
    if (record.customerId) linked(record.customerId, "customer");
    if (record.projectId) linked(record.projectId, "project");
    const clean = {
      ...record,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    delete clean.number;
    delete clean.issuedAt;
    delete clean.snapshot;
    delete clean.allocations;
    delete clean.allocationReversals;
    delete clean.refunds;
    delete clean.credits;
    delete clean.receivableBalance;
    delete clean.goodsReceipts;
    if (["bom", "purchase"].includes(record.kind)) {
      if (
        new Set((clean.items ?? []).map((i) => i.id)).size !==
        (clean.items ?? []).length
      )
        throw new Error("Material item IDs must be unique.");
      clean.items = (clean.items ?? []).map((item) => {
        if (new D(item.quantity).lte(0))
          throw new Error("Material quantity must be positive.");
        return { ...item, received: "0" };
      });
      if (record.kind === "purchase" && clean.items.length)
        clean.amount = money(
          sum(clean.items.map((i) => new D(i.quantity).mul(i.unitCost))),
        );
    }
    if (["quote", "invoice"].includes(record.kind)) {
      if (record.kind === "invoice") requirePermission(actor, "invoice");
      if (!hasCosts(actor.role))
        clean.lines = (clean.lines ?? []).map((line) => ({
          ...line,
          cost: existing?.lines?.find((old) => old.id === line.id)?.cost ?? "0",
        }));
      clean.calculation = calculateQuote(clean.lines ?? []);
      clean.revision = existing?.revision ?? 1;
      if (
        record.kind === "quote" &&
        actor.role !== "owner" &&
        (record.lines ?? []).some((l) => new D(l.discount).gt(20))
      )
        throw new Error("Owner approval required for discounts above 20%.");
    } else delete clean.calculation;
    if (existing)
      s.records[s.records.findIndex((r) => r.id === record.id)] = clean;
    else add(clean);
    if (!existing && record.kind === "lead")
      add({
        id: id(),
        kind: "task",
        name: `Contact ${clean.name}`,
        status: "Open",
        owner: clean.owner ?? actor.userId,
        dueDate: businessDate(new Date(now)),
        reference: clean.id,
        priority: "High",
        createdAt: now,
        updatedAt: now,
      });
  };
  switch (command.type) {
    case "resolveJob": {
      if (actor.role !== "owner")
        throw new Error("Permission denied. Owner reconciliation is required.");
      const job = s.jobs.find((j) => j.id === command.id);
      if (!job || job.status !== "Unknown")
        throw new Error("Only an unknown provider outcome can be reconciled.");
      job.status = command.status;
      job.message = `Reconciled by owner: ${command.reason}`;
      break;
    }
    case "attachEvidence": {
      const record = get(command.id);
      requirePermission(actor, record.kind);
      if ((record.files?.length ?? 0) >= 30)
        throw new Error("A record supports at most 30 evidence files.");
      (record.files ??= []).push(command.file);
      stamp(record);
      break;
    }
    case "newVersion": {
      const old = get(command.id);
      requirePermission(actor, old.kind);
      if (!["catalog", "clause", "survey", "bom"].includes(old.kind))
        throw new Error("This record does not support published versions.");
      if (old.status === "Draft")
        throw new Error("Edit the existing draft first.");
      const version =
        Math.max(
          ...s.records
            .filter(
              (r) =>
                r.kind === old.kind &&
                (old.sku ? r.sku === old.sku : r.name === old.name),
            )
            .map((r) => r.revision ?? 1),
        ) + 1;
      add({
        ...structuredClone(old),
        id: id(),
        status: "Draft",
        previousId: old.id,
        revision: version,
        acceptance: undefined,
        createdAt: now,
        updatedAt: now,
      });
      break;
    }
    case "save":
      save(command.record);
      break;
    case "import":
      for (const record of command.records) {
        if (!["lead", "customer", "catalog"].includes(record.kind))
          throw new Error("Import supports leads, customers and catalog only.");
        if (
          s.records.some(
            (r) =>
              r.id === record.id ||
              (record.sku &&
                r.kind === "catalog" &&
                r.sku?.toLowerCase() === record.sku.toLowerCase()),
          )
        )
          throw new Error("Duplicate record ID or SKU in import.");
        save(record);
      }
      break;
    case "settings":
      if (actor.role !== "owner")
        throw new Error(
          "Permission denied. Only the owner can change settings.",
        );
      s.settings = { ...s.settings, ...command.settings };
      break;
    case "transition": {
      const record = get(command.id);
      requirePermission(actor, record.kind);
      if (!nextStatuses(record).includes(command.status))
        throw new Error("This workflow transition is not allowed.");
      if (record.kind === "quote" && command.status === "Shared") {
        if (!record.customerId)
          throw new Error("Select a customer before sharing a quotation.");
        const customer = get(record.customerId, "customer");
        record.calculation = calculateQuote(record.lines ?? []);
        record.snapshot = {
          billingName: s.settings.billingName,
          billingAddress: s.settings.billingAddress,
          gstin: s.settings.gstin,
          customerName: customer.name,
          customerAddress: customer.address ?? "",
          customerGstin: customer.gstin ?? "",
          phone: s.settings.phone,
        };
        record.number = `QT-${record.id.slice(0, 8).toUpperCase()}-R${record.revision ?? 1}`;
      }
      if (record.kind === "quote" && command.status === "Accepted") {
        if (!command.evidence?.trim())
          throw new Error("Record customer acceptance evidence.");
        record.acceptance = command.evidence;
      }
      if (
        record.kind === "catalog" &&
        command.status === "Published" &&
        (!record.sku || !record.unit || new D(record.rate ?? 0).lte(0))
      )
        throw new Error(
          "Published catalog entries need a unique SKU, unit and positive selling rate.",
        );
      if (record.kind === "catalog" && command.status === "Published")
        for (const previous of s.records)
          if (
            previous.id !== record.id &&
            previous.kind === "catalog" &&
            previous.sku?.toLowerCase() === record.sku?.toLowerCase() &&
            previous.status === "Published"
          ) {
            previous.status = "Retired";
            stamp(previous);
          }
      if (
        record.kind === "clause" &&
        command.status === "Published" &&
        actor.role !== "owner"
      )
        throw new Error("Only the owner may publish shared clauses.");
      if (record.kind === "survey" && command.status === "Signed off") {
        if (
          !record.checklist?.length ||
          record.checklist.some((c) => !c.done) ||
          !command.evidence?.trim()
        )
          throw new Error(
            "Complete the survey checklist and record customer sign-off evidence.",
          );
        record.acceptance = command.evidence;
      }
      if (record.kind === "bom" && (!record.items?.length || !record.projectId))
        throw new Error(
          "Review requires a project and explicit material quantities. Do not use elevation area as board quantity.",
        );
      if (record.kind === "changeOrder" && command.status === "Approved") {
        if (
          !record.customerId ||
          !record.projectId ||
          !record.notes?.trim() ||
          !command.evidence?.trim()
        )
          throw new Error(
            "Scope change needs customer, project, scope details and explicit acceptance evidence.",
          );
        record.acceptance = command.evidence;
      }
      if (record.kind === "purchase") {
        if (
          command.status === "Ordered" &&
          (!record.items?.length || !record.supplier)
        )
          throw new Error(
            "Add supplier and explicit line quantities before ordering.",
          );
        if (["Part received", "Received"].includes(command.status))
          throw new Error(
            "Use Record goods receipt with actual received quantities.",
          );
      }
      record.status = command.status;
      stamp(record);
      if (record.kind === "lead" && command.status === "Won") {
        let customer = s.records.find(
          (r) => r.kind === "customer" && r.id === record.customerId,
        );
        if (!customer) {
          customer = add({
            id: id(),
            kind: "customer",
            name: record.name,
            status: "Active",
            phone: record.phone,
            email: record.email,
            address: record.address,
            locality: record.locality,
            consent: record.consent,
            consentNote: record.consentNote,
            createdAt: now,
            updatedAt: now,
          });
          record.customerId = customer.id;
        }
        add({
          id: id(),
          kind: "project",
          name: `${record.name} · Kitchen`,
          status: "Survey",
          customerId: customer.id,
          budget: record.budget,
          owner: record.owner,
          source: record.source,
          createdAt: now,
          updatedAt: now,
        });
      }
      break;
    }
    case "reviseQuote": {
      requirePermission(actor, "quote");
      const old = get(command.id, "quote");
      add({
        ...structuredClone(old),
        id: id(),
        number: undefined,
        snapshot: undefined,
        acceptance: undefined,
        previousId: old.id,
        revision: (old.revision ?? 1) + 1,
        status: "Draft",
        createdAt: now,
        updatedAt: now,
      });
      break;
    }
    case "createInvoice": {
      requirePermission(actor, "invoice");
      const quote = get(command.id, "quote");
      if (quote.status !== "Accepted")
        throw new Error("Accept the quotation before creating an invoice.");
      add({
        id: id(),
        kind: "invoice",
        name: quote.name,
        customerId: quote.customerId,
        projectId: quote.projectId,
        previousId: quote.id,
        status: "Draft",
        lines: structuredClone(quote.lines),
        calculation: structuredClone(quote.calculation),
        terms: quote.terms,
        dueDate: businessDate(new Date(now)),
        createdAt: now,
        updatedAt: now,
      });
      break;
    }
    case "issueInvoice": {
      requirePermission(actor, "invoice");
      const invoice = get(command.id, "invoice");
      if (invoice.status !== "Draft")
        throw new Error("Invoice is already issued.");
      if (
        !s.settings.billingName.trim() ||
        !s.settings.billingAddress.trim() ||
        !s.settings.taxReviewed
      )
        throw new Error(
          "Complete billing identity and confirm accountant tax review in Settings first.",
        );
      const customer = get(invoice.customerId ?? "", "customer");
      if (!customer.address?.trim())
        throw new Error(
          "Add the customer billing address before invoice issue.",
        );
      if (
        s.settings.gstin &&
        !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(
          s.settings.gstin,
        )
      )
        throw new Error("Check your billing GSTIN.");
      invoice.calculation = calculateQuote(invoice.lines ?? []);
      const fy = financialYear(now);
      const n = (s.settings.invoiceSequences[fy] ?? 0) + 1;
      s.settings.invoiceSequences[fy] = n;
      invoice.number = `${s.settings.invoicePrefix}/${fy}/${String(n).padStart(4, "0")}`;
      if (invoice.number.length > 16)
        throw new Error(
          "Invoice number exceeds 16 characters. Shorten the prefix or review numbering with your accountant.",
        );
      invoice.snapshot = {
        billingName: s.settings.billingName,
        billingAddress: s.settings.billingAddress,
        gstin: s.settings.gstin,
        customerName: customer.name,
        customerAddress: customer.address ?? "",
        customerGstin: customer.gstin ?? "",
        phone: s.settings.phone,
      };
      invoice.issuedAt = now;
      invoice.status = "Issued";
      stamp(invoice);
      break;
    }
    case "receive": {
      requirePermission(actor, "receipt");
      const value = amount(command.amount);
      const invoice = command.invoiceId
        ? get(command.invoiceId, "invoice")
        : undefined;
      if (invoice?.status === "Draft")
        throw new Error("Issue the invoice before allocating payment.");
      const customerId = invoice?.customerId ?? command.customerId;
      get(customerId ?? "", "customer");
      if (
        s.records.some(
          (r) =>
            r.kind === "receipt" &&
            r.reference === command.reference.trim() &&
            r.customerId === customerId,
        )
      )
        throw new Error(
          "This payment reference already exists for this customer.",
        );
      const allocation = invoice
        ? D.min(value, balanceFor(invoice, s.records))
        : new D(0);
      add({
        id: id(),
        kind: "receipt",
        name: `Receipt · ${command.reference}`,
        status: "Confirmed",
        customerId,
        amount: money(value),
        reference: command.reference.trim(),
        dueDate: command.receivedOn,
        allocations:
          invoice && allocation.gt(0)
            ? [{ invoiceId: invoice.id, amount: money(allocation) }]
            : [],
        refunds: [],
        createdAt: now,
        updatedAt: now,
      });
      break;
    }
    case "allocate": {
      requirePermission(actor, "receipt");
      const receipt = get(command.receiptId, "receipt");
      const invoice = get(command.invoiceId, "invoice");
      const value = amount(command.amount);
      if (
        invoice.status !== "Issued" ||
        receipt.status !== "Confirmed" ||
        receipt.customerId !== invoice.customerId
      )
        throw new Error(
          "Allocation requires a confirmed receipt and issued invoice for the same customer.",
        );
      if (
        value.gt(availableReceipt(receipt)) ||
        value.gt(balanceFor(invoice, s.records))
      )
        throw new Error(
          "Allocation exceeds available receipt or invoice balance.",
        );
      (receipt.allocations ??= []).push({
        invoiceId: invoice.id,
        amount: money(value),
      });
      stamp(receipt);
      break;
    }
    case "unallocate": {
      requirePermission(actor, "receipt");
      const receipt = get(command.receiptId, "receipt"),
        invoice = get(command.invoiceId, "invoice"),
        value = amount(command.amount);
      const applied = sum(
        (receipt.allocations ?? [])
          .filter((a) => a.invoiceId === invoice.id)
          .map((a) => a.amount),
      ).minus(
        sum(
          (receipt.allocationReversals ?? [])
            .filter((a) => a.invoiceId === invoice.id)
            .map((a) => a.amount),
        ),
      );
      if (
        receipt.status !== "Confirmed" ||
        receipt.customerId !== invoice.customerId ||
        value.gt(applied)
      )
        throw new Error(
          "Allocation reversal exceeds the currently allocated receipt amount.",
        );
      (receipt.allocationReversals ??= []).push({
        id: id(),
        invoiceId: invoice.id,
        amount: money(value),
        reason: command.reason,
        createdAt: now,
      });
      stamp(receipt);
      break;
    }
    case "receiveGoods": {
      requirePermission(actor, "purchase");
      const purchase = get(command.id, "purchase");
      if (
        !["Ordered", "Part received"].includes(purchase.status) ||
        !purchase.items?.length
      )
        throw new Error("An ordered purchase with explicit lines is required.");
      if (
        purchase.goodsReceipts?.some((r) => r.reference === command.reference)
      )
        throw new Error(
          "This goods receipt reference has already been recorded.",
        );
      if (
        new Set(command.quantities.map((q) => q.itemId)).size !==
        command.quantities.length
      )
        throw new Error("Duplicate item in goods receipt.");
      for (const q of command.quantities) {
        const item = purchase.items.find((i) => i.id === q.itemId),
          qty = new D(q.quantity);
        if (
          !item ||
          qty.lte(0) ||
          new D(item.received).plus(qty).gt(item.quantity)
        )
          throw new Error(
            "Received quantity exceeds ordered quantity or item is invalid.",
          );
        item.received = new D(item.received).plus(qty).toString();
      }
      (purchase.goodsReceipts ??= []).push({
        reference: command.reference,
        at: now,
        items: command.quantities,
      });
      purchase.status = purchase.items.every((i) =>
        new D(i.received).eq(i.quantity),
      )
        ? "Received"
        : "Part received";
      stamp(purchase);
      break;
    }
    case "createBOM": {
      requirePermission(actor, "bom");
      const quote = get(command.id, "quote");
      if (quote.status !== "Accepted")
        throw new Error("A BOM must reference an accepted quotation.");
      add({
        id: id(),
        kind: "bom",
        name: `BOM · ${quote.name}`,
        status: "Draft",
        customerId: quote.customerId,
        projectId: quote.projectId,
        previousId: quote.id,
        items: [],
        notes: `Scope reference: ${quote.number ?? quote.id}. Enter construction quantities after technical review; customer-facing elevation area does not determine board consumption.`,
        createdAt: now,
        updatedAt: now,
      });
      break;
    }
    case "reverseReceipt": {
      requirePermission(actor, "receipt");
      const receipt = get(command.id, "receipt");
      if (receipt.status !== "Confirmed" || (receipt.refunds?.length ?? 0) > 0)
        throw new Error(
          "Only a confirmed, non-refunded receipt can be reversed.",
        );
      receipt.status = "Reversed";
      receipt.notes = command.reason;
      stamp(receipt);
      break;
    }
    case "credit": {
      requirePermission(actor, "invoice");
      const invoice = get(command.id, "invoice");
      const value = amount(command.amount);
      if (
        invoice.status !== "Issued" ||
        value.gt(balanceFor(invoice, s.records))
      )
        throw new Error("Credit exceeds the current issued invoice balance.");
      (invoice.credits ??= []).push({
        id: id(),
        amount: money(value),
        reason: command.reason,
        createdAt: now,
      });
      stamp(invoice);
      break;
    }
    case "refund": {
      requirePermission(actor, "receipt");
      const receipt = get(command.id, "receipt");
      const value = amount(command.amount);
      if (value.gt(availableReceipt(receipt)))
        throw new Error("Refund exceeds unapplied receipt funds.");
      (receipt.refunds ??= []).push({
        id: id(),
        amount: money(value),
        reason: command.reason,
        createdAt: now,
      });
      stamp(receipt);
      break;
    }
    case "collectionHold": {
      requirePermission(actor, "invoice");
      const invoice = get(command.id, "invoice");
      invoice.disputed = command.disputed;
      invoice.paused = command.paused;
      stamp(invoice);
      break;
    }
    case "scheduleReminder": {
      requirePermission(actor, "invoice");
      const invoice = get(command.id, "invoice");
      if (!reminderEligible(invoice, s.records))
        throw new Error(
          "Reminder blocked: check issued status, balance, consent and collection holds.",
        );
      if (!s.settings.reminderEnabled || !s.settings.authkeyTemplateId)
        throw new Error(
          "Enable the reminder policy and configure an Authkey template in Settings.",
        );
      if (new Date(command.dueAt).getTime() <= new Date(now).getTime())
        throw new Error("Choose a future reminder time.");
      if (
        s.jobs.some(
          (j) =>
            j.invoiceId === invoice.id &&
            ["Pending", "Sending", "Unknown"].includes(j.status),
        )
      )
        throw new Error(
          "This invoice already has an active or unresolved reminder.",
        );
      s.jobs.push({
        id: id(),
        invoiceId: invoice.id,
        customerId: invoice.customerId!,
        dueAt: command.dueAt,
        status: "Pending",
        attempts: 0,
        message: "Invoice balance reminder",
      });
      break;
    }
  }
  for (const job of s.jobs) {
    const invoice = s.records.find(
      (r) => r.id === job.invoiceId && r.kind === "invoice",
    );
    if (
      job.status === "Pending" &&
      (!invoice || !reminderEligible(invoice, s.records))
    )
      job.status = "Suppressed";
  }
  if (s.records.length > 10000)
    throw new Error(
      "Workspace active-record limit reached. Contact the maintainer to enable paginated storage.",
    );
  s.audit.unshift({
    id: id(),
    at: now,
    actor: actor.userId,
    action: command.type,
    recordId:
      "id" in command
        ? command.id
        : command.type === "save"
          ? command.record.id
          : undefined,
    changes: s.records
      .filter(
        (r) =>
          JSON.stringify(r) !==
          JSON.stringify(original.records.find((old) => old.id === r.id)),
      )
      .map((r) => ({
        id: r.id,
        before: original.records.find((old) => old.id === r.id),
        after: structuredClone(r),
      })),
    detail:
      command.type === "receive"
        ? `Confirmed ${money(command.amount)} INR; reference ${command.reference}`
        : command.type === "import"
          ? `${command.records.length} records imported`
          : "reason" in command
            ? command.reason
            : "Audited business operation",
  });
  s.audit = s.audit.slice(0, 250);
  s.revision++;
  return s;
}
export function collectionSummary(records: CRMRecord[]) {
  const invoices = records.filter(
    (r) => r.kind === "invoice" && r.status === "Issued",
  );
  const receipts = records.filter(
    (r) => r.kind === "receipt" && r.status === "Confirmed",
  );
  const gross = sum(receipts.map((r) => r.amount ?? 0));
  const refunds = sum(
    receipts.flatMap((r) => (r.refunds ?? []).map((f) => f.amount)),
  );
  return {
    outstanding: money(sum(invoices.map((i) => balanceFor(i, records)))),
    gross: money(gross),
    refunds: money(refunds),
    net: money(gross.minus(refunds)),
    advances: money(sum(receipts.map(availableReceipt))),
  };
}
