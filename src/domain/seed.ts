import type { CRMRecord, QuoteLine, Workspace } from "./types";
import { execute } from "./commands";
export function emptyWorkspace(): Workspace {
  return {
    revision: 0,
    records: [],
    audit: [],
    jobs: [],
    settings: {
      billingName: "",
      billingAddress: "",
      gstin: "",
      phone: "",
      email: "",
      invoicePrefix: "HT",
      taxReviewed: false,
      defaultTerms:
        "Measurements are provisional until site survey sign-off. Final specification, exclusions, payment milestones and supplier warranty must be confirmed before acceptance.",
      reminderEnabled: false,
      authkeyTemplateId: "",
      reminderHour: 10,
      contactGapHours: 48,
      invoiceSequences: {},
    },
  };
}
export const blankLine = (): QuoteLine => ({
  id: crypto.randomUUID(),
  description: "",
  zone: "Base",
  method: "item",
  quantity: "1",
  width: "0",
  height: "0",
  depth: "0",
  unit: "piece",
  rate: "0",
  cost: "0",
  discount: "0",
  taxRate: "0",
  hsn: "",
  catalogId: "",
});

export function demoWorkspace(): Workspace {
  let s = emptyWorkspace();
  const now = new Date().toISOString();
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const key = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const record = (
    n: number,
    kind: CRMRecord["kind"],
    name: string,
    status: string,
    rest: Partial<CRMRecord> = {},
  ): CRMRecord => ({
    id: key(n),
    kind,
    name,
    status,
    createdAt: now,
    updatedAt: now,
    ...rest,
  });
  s.settings = {
    ...s.settings,
    billingName: "Hutāśana · Demo Studio",
    billingAddress: "Demonstration address, Pune, Maharashtra",
    phone: "",
    taxReviewed: true,
  };
  s.records = [
    record(1, "customer", "Ananya Deshmukh", "Active", {
      phone: "+919000000001",
      email: "ananya@example.com",
      address: "Demo residence, Baner, Pune",
      locality: "Baner",
      language: "Marathi",
      consent: false,
      notes: "Fictional demonstration customer. Do not contact.",
    }),
    record(2, "customer", "Rohan Kulkarni", "Active", {
      phone: "+919000000002",
      email: "rohan@example.com",
      address: "Demo residence, Wakad, Pune",
      locality: "Wakad",
      language: "Hindi",
      consent: false,
    }),
    record(3, "customer", "Meera Shah", "Active", {
      phone: "+919000000003",
      address: "Demo residence, Kothrud, Pune",
      locality: "Kothrud",
      consent: false,
    }),
    record(10, "lead", "Aarav Patil", "New", {
      phone: "+919000000010",
      locality: "Hinjewadi",
      source: "Meta Ads",
      budget: "450000",
      dueDate: day(0),
      owner: "Sales team",
      notes: "L-shaped kitchen. Possession expected next month.",
      language: "Marathi",
      consent: false,
    }),
    record(11, "lead", "Priya Joshi", "Qualified", {
      phone: "+919000000011",
      locality: "Aundh",
      source: "Justdial",
      budget: "320000",
      dueDate: day(1),
      owner: "Sales team",
      notes: "Renovation; needs appliance space planned.",
      consent: false,
    }),
    record(12, "lead", "Siddharth Rao", "Survey booked", {
      locality: "Kharadi",
      source: "Instagram",
      budget: "650000",
      dueDate: day(2),
      owner: "Design team",
      consent: false,
    }),
    record(13, "lead", "Neha & Aditya", "Quote shared", {
      locality: "Bavdhan",
      source: "Referral",
      budget: "380000",
      dueDate: day(-1),
      owner: "Sales team",
      consent: false,
    }),
    record(14, "lead", "Vikram Nair", "Negotiation", {
      locality: "Pashan",
      source: "Website",
      budget: "520000",
      dueDate: day(0),
      owner: "Sales team",
      consent: false,
    }),
    record(20, "project", "The Baner residence", "Production", {
      customerId: key(1),
      budget: "486000",
      locality: "Baner",
      owner: "Project team",
      dueDate: day(12),
      notes: "Warm oak finish · L-shaped kitchen · Demo scope",
    }),
    record(21, "project", "Wakad family kitchen", "Design", {
      customerId: key(2),
      budget: "325000",
      locality: "Wakad",
      owner: "Design team",
      dueDate: day(21),
    }),
    record(22, "project", "Kothrud renovation", "Installation", {
      customerId: key(3),
      budget: "278000",
      locality: "Kothrud",
      owner: "Installation team",
      dueDate: day(3),
    }),
    record(30, "catalog", "Demo BWP carcass module", "Published", {
      sku: "DEMO-BASE-01",
      brand: "Sample brand",
      category: "Carcass",
      unit: "ft2",
      rate: "1250",
      cost: "800",
      taxRate: "0",
      hsn: "",
      supplier: "Demo supplier",
      warranty: "Illustrative entry. Replace with supplier evidence.",
      notes: "FICTIONAL RATE — not approved for production.",
    }),
    record(31, "catalog", "Demo acrylic shutter", "Published", {
      sku: "DEMO-SHUT-01",
      brand: "Sample brand",
      category: "Shutter",
      unit: "ft2",
      rate: "1650",
      cost: "1050",
      taxRate: "0",
      notes: "FICTIONAL RATE — not approved for production.",
    }),
    record(32, "catalog", "Demo soft-close hinge pair", "Published", {
      sku: "DEMO-HNG-01",
      brand: "Sample brand",
      category: "Hardware",
      unit: "pair",
      rate: "850",
      cost: "500",
      taxRate: "0",
      notes: "Compatibility requires technical review.",
    }),
    record(40, "task", "Confirm Baner countertop measurement", "Open", {
      customerId: key(1),
      projectId: key(20),
      owner: "Design team",
      dueDate: day(0),
      priority: "High",
      notes: "Confirm sink cut-out and appliance dimensions on site.",
    }),
    record(41, "task", "Follow up on Bavdhan quotation", "Open", {
      dueDate: day(-1),
      owner: "Sales team",
      priority: "High",
    }),
    record(42, "task", "Review Wakad material alternatives", "In progress", {
      customerId: key(2),
      projectId: key(21),
      owner: "Design team",
      dueDate: day(1),
      priority: "Normal",
    }),
    record(50, "purchase", "Baner hardware order", "Ordered", {
      projectId: key(20),
      supplier: "Demo hardware supplier",
      amount: "24500",
      items: [
        {
          id: "demo-hinges",
          description: "Demo hinge pairs",
          sku: "DEMO-HNG-01",
          quantity: "10",
          unit: "pair",
          unitCost: "500",
          received: "0",
        },
        {
          id: "demo-drawers",
          description: "Demo drawer sets",
          sku: "DEMO-DRW-01",
          quantity: "3",
          unit: "set",
          unitCost: "6500",
          received: "0",
        },
      ],
      dueDate: day(4),
      notes: "Verify actual SKUs and supplier ETA before purchasing.",
    }),
    record(51, "purchase", "Kothrud countertop", "Part received", {
      projectId: key(22),
      supplier: "Demo stone supplier",
      amount: "38000",
      items: [
        {
          id: "demo-stone",
          description: "Demo cut stone pieces",
          sku: "DEMO-STONE",
          quantity: "2",
          unit: "piece",
          unitCost: "19000",
          received: "1",
        },
      ],
      dueDate: day(1),
    }),
    record(60, "service", "Align pantry shutter", "Scheduled", {
      customerId: key(3),
      projectId: key(22),
      priority: "Normal",
      dueDate: day(2),
      owner: "Service team",
      notes: "Demo snag: check alignment at handover.",
    }),
    record(70, "clause", "Site readiness & exclusions", "Published", {
      category: "Exclusions",
      terms:
        "Civil, plumbing and electrical work are excluded unless explicitly itemised. Installation requires a dry, accessible and prepared site.",
    }),
    record(71, "clause", "Survey confirmation", "Published", {
      category: "Measurements",
      terms:
        "All dimensions are provisional until the final site survey is reviewed and signed off.",
    }),
    record(80, "survey", "Baner final site survey", "Reviewed", {
      customerId: key(1),
      projectId: key(20),
      notes:
        "All dimensions in millimetres. Confirm appliance clearances before production.",
      checklist: [
        { label: "Wall dimensions and diagonals recorded", done: true },
        { label: "Water, gas and electrical points marked", done: true },
        { label: "Appliance model dimensions confirmed", done: false },
        { label: "Customer sign-off captured", done: false },
      ],
    }),
    record(90, "call", "Demo enquiry · kitchen renovation", "Logged", {
      source: "Manual",
      locality: "Baner",
      language: "Marathi",
      notes: "Illustrative call summary. Voice provider is not connected.",
      dueDate: day(0),
    }),
  ];
  const line = (
    description: string,
    rate: string,
    quantity: string,
  ): QuoteLine => ({
    ...blankLine(),
    description,
    rate,
    cost: String(Number(rate) * 0.6),
    quantity,
  });
  s.records.push(
    record(100, "quote", "Baner · Oak & ivory kitchen", "Draft", {
      customerId: key(1),
      projectId: key(20),
      lines: [
        line("Base cabinetry · demo package", "185000", "1"),
        line("Wall & loft units · demo package", "125000", "1"),
        line("Hardware & accessories · demo package", "58000", "1"),
      ],
      terms: s.settings.defaultTerms,
      dueDate: day(14),
      revision: 1,
    }),
  );
  s.records.push(
    record(101, "quote", "Wakad · Contemporary kitchen", "Draft", {
      customerId: key(2),
      projectId: key(21),
      lines: [
        line("Kitchen cabinetry · demo package", "245000", "1"),
        line("Installation · demo allowance", "18000", "1"),
      ],
      terms: s.settings.defaultTerms,
      dueDate: day(10),
      revision: 1,
    }),
  );
  s.records.push(
    record(110, "invoice", "Baner · Production milestone", "Draft", {
      customerId: key(1),
      projectId: key(20),
      lines: [line("Production milestone · demonstration", "184000", "1")],
      dueDate: day(-3),
    }),
  );
  s.records.push(
    record(111, "invoice", "Kothrud · Final milestone", "Draft", {
      customerId: key(3),
      projectId: key(22),
      lines: [line("Final milestone · demonstration", "74000", "1")],
      dueDate: day(5),
    }),
  );
  const actor = { userId: "demo-owner", role: "owner" as const };
  s = execute(s, { type: "issueInvoice", id: key(110) }, actor, now);
  s = execute(s, { type: "issueInvoice", id: key(111) }, actor, now);
  s = execute(
    s,
    {
      type: "receive",
      invoiceId: key(110),
      amount: "100000",
      reference: "DEMO-BANK-001",
      receivedOn: day(-2),
    },
    actor,
    now,
  );
  s = execute(
    s,
    { type: "transition", id: key(100), status: "Shared" },
    actor,
    now,
  );
  s.audit = [];
  s.revision = 0;
  return s;
}
