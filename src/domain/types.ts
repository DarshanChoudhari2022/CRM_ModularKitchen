import { z } from "zod";

export const kinds = [
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
] as const;
export type Kind = (typeof kinds)[number];
export const roles = [
  "owner",
  "estimator",
  "sales",
  "accounts",
  "manager",
  "installer",
] as const;
export type Role = (typeof roles)[number];
const numeric = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,8})?$/, "Enter a positive decimal number");
export const lineSchema = z.object({
  id: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  zone: z.string().max(100),
  method: z.enum(["area", "length", "item", "package"]),
  quantity: numeric,
  width: numeric,
  height: numeric,
  depth: numeric,
  unit: z.enum(["ft2", "m2", "ft", "m", "piece", "pair", "set", "package"]),
  rate: numeric,
  cost: numeric,
  discount: numeric,
  taxRate: numeric,
  hsn: z.string().max(30),
  catalogId: z.string().max(100),
});
export type QuoteLine = z.infer<typeof lineSchema>;
export interface CalculatedLine extends QuoteLine {
  billableQuantity: string;
  net: string;
  tax: string;
  total: string;
  costTotal: string;
}
export interface Calculation {
  lines: CalculatedLine[];
  subtotal: string;
  discount: string;
  net: string;
  tax: string;
  total: string;
  cost: string;
  margin: string;
}
const adjustmentSchema = z.object({
  id: z.string(),
  amount: numeric,
  reason: z.string().min(3).max(1000),
  createdAt: z.string(),
});
export const materialItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500),
  sku: z.string().max(100),
  quantity: numeric,
  unit: z.string().min(1).max(30),
  unitCost: numeric,
  received: numeric,
});
export type MaterialItem = z.infer<typeof materialItemSchema>;
export const evidenceFileSchema = z.object({
  name: z.string().max(200),
  path: z.string().max(500),
  mime: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(10485760),
  uploadedAt: z.string(),
});
export const recordSchema = z
  .object({
    id: z.string().min(1).max(100),
    kind: z.enum(kinds),
    name: z.string().trim().min(1).max(200),
    status: z.string().max(50),
    createdAt: z.string(),
    updatedAt: z.string(),
    customerId: z.string().max(100).optional(),
    projectId: z.string().max(100).optional(),
    phone: z.string().max(30).optional(),
    email: z.union([z.email(), z.literal("")]).optional(),
    address: z.string().max(1000).optional(),
    locality: z.string().max(100).optional(),
    owner: z.string().max(100).optional(),
    source: z.string().max(100).optional(),
    budget: numeric.optional(),
    amount: numeric.optional(),
    dueDate: z.union([z.iso.date(), z.literal("")]).optional(),
    notes: z.string().max(10000).optional(),
    language: z.string().max(30).optional(),
    consent: z.boolean().optional(),
    consentNote: z.string().max(1000).optional(),
    brand: z.string().max(100).optional(),
    sku: z.string().max(100).optional(),
    category: z.string().max(100).optional(),
    unit: z.string().max(30).optional(),
    rate: numeric.optional(),
    cost: numeric.optional(),
    taxRate: numeric.optional(),
    hsn: z.string().max(30).optional(),
    warranty: z.string().max(2000).optional(),
    supplier: z.string().max(200).optional(),
    lines: z.array(lineSchema).max(200).optional(),
    terms: z.string().max(10000).optional(),
    revision: z.number().int().positive().optional(),
    previousId: z.string().optional(),
    number: z.string().max(100).optional(),
    issuedAt: z.string().optional(),
    calculation: z.custom<Calculation>().optional(),
    acceptance: z.string().max(2000).optional(),
    disputed: z.boolean().optional(),
    paused: z.boolean().optional(),
    reference: z.string().max(200).optional(),
    allocations: z
      .array(z.object({ invoiceId: z.string(), amount: numeric }))
      .optional(),
    allocationReversals: z
      .array(adjustmentSchema.extend({ invoiceId: z.string() }))
      .optional(),
    items: z.array(materialItemSchema).max(200).optional(),
    goodsReceipts: z
      .array(
        z.object({
          reference: z.string(),
          at: z.string(),
          items: z.array(z.object({ itemId: z.string(), quantity: numeric })),
        }),
      )
      .optional(),
    credits: z.array(adjustmentSchema).optional(),
    refunds: z.array(adjustmentSchema).optional(),
    snapshot: z
      .object({
        billingName: z.string(),
        billingAddress: z.string(),
        gstin: z.string(),
        customerName: z.string(),
        customerAddress: z.string(),
        customerGstin: z.string(),
        phone: z.string(),
      })
      .optional(),
    gstin: z.string().max(30).optional(),
    priority: z.enum(["Low", "Normal", "High", "Urgent"]).optional(),
    receivableBalance: numeric.optional(),
    files: z.array(evidenceFileSchema).max(30).optional(),
    checklist: z
      .array(z.object({ label: z.string().max(200), done: z.boolean() }))
      .max(100)
      .optional(),
    sourceEventId: z.string().max(200).optional(),
    campaign: z.string().max(200).optional(),
    attachmentPath: z.string().max(500).optional(),
    recordingPath: z.string().max(500).optional(),
  })
  .strict();
export type CRMRecord = z.infer<typeof recordSchema>;
export interface BusinessSettings {
  billingName: string;
  billingAddress: string;
  gstin: string;
  phone: string;
  email: string;
  invoicePrefix: string;
  taxReviewed: boolean;
  defaultTerms: string;
  reminderEnabled: boolean;
  authkeyTemplateId: string;
  reminderHour: number;
  contactGapHours: number;
  invoiceSequences: Record<string, number>;
}
export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  recordId?: string;
  detail: string;
  changes?: { id: string; before?: CRMRecord; after: CRMRecord }[];
}
export interface OutboxJob {
  id: string;
  invoiceId: string;
  customerId: string;
  dueAt: string;
  status: "Pending" | "Sending" | "Sent" | "Suppressed" | "Failed" | "Unknown";
  attempts: number;
  message: string;
  providerId?: string;
}
export interface Workspace {
  revision: number;
  records: CRMRecord[];
  settings: BusinessSettings;
  audit: AuditEntry[];
  jobs: OutboxJob[];
  financialSummary?: {
    outstanding: string;
    gross: string;
    refunds: string;
    net: string;
    advances: string;
  };
  monthlyActivity?: { label: string; billed: number; collected: number }[];
}
export interface Actor {
  userId: string;
  role: Role;
}
export const settingsPatchSchema = z
  .object({
    billingName: z.string().max(200),
    billingAddress: z.string().max(1000),
    gstin: z.string().max(30),
    phone: z.string().max(30),
    email: z.string().max(200),
    invoicePrefix: z.string().regex(/^[A-Z0-9-]{1,6}$/),
    taxReviewed: z.boolean(),
    defaultTerms: z.string().max(10000),
    reminderEnabled: z.boolean(),
    authkeyTemplateId: z.string().max(100),
    reminderHour: z.number().int().min(9).max(18),
    contactGapHours: z.number().int().min(24).max(720),
  })
  .partial()
  .strict();
export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("resolveJob"),
    id: z.string(),
    status: z.enum(["Sent", "Failed"]),
    reason: z.string().min(10).max(1000),
  }),
  z.object({
    type: z.literal("attachEvidence"),
    id: z.string(),
    file: evidenceFileSchema,
  }),
  z.object({ type: z.literal("newVersion"), id: z.string() }),
  z.object({ type: z.literal("save"), record: recordSchema }),
  z.object({
    type: z.literal("import"),
    records: z.array(recordSchema).min(1).max(250),
  }),
  z.object({
    type: z.literal("transition"),
    id: z.string(),
    status: z.string(),
    evidence: z.string().max(2000).optional(),
  }),
  z.object({ type: z.literal("reviseQuote"), id: z.string() }),
  z.object({ type: z.literal("createInvoice"), id: z.string() }),
  z.object({ type: z.literal("issueInvoice"), id: z.string() }),
  z.object({
    type: z.literal("receive"),
    invoiceId: z.string().optional(),
    customerId: z.string().optional(),
    amount: numeric,
    reference: z.string().min(1).max(200),
    receivedOn: z.iso.date(),
  }),
  z.object({
    type: z.literal("allocate"),
    receiptId: z.string(),
    invoiceId: z.string(),
    amount: numeric,
  }),
  z.object({
    type: z.literal("unallocate"),
    receiptId: z.string(),
    invoiceId: z.string(),
    amount: numeric,
    reason: z.string().min(3).max(1000),
  }),
  z.object({
    type: z.literal("receiveGoods"),
    id: z.string(),
    quantities: z
      .array(z.object({ itemId: z.string(), quantity: numeric }))
      .min(1)
      .max(200),
    reference: z.string().min(1).max(100),
  }),
  z.object({ type: z.literal("createBOM"), id: z.string() }),
  z.object({
    type: z.literal("reverseReceipt"),
    id: z.string(),
    reason: z.string().min(3).max(1000),
  }),
  z.object({
    type: z.literal("credit"),
    id: z.string(),
    amount: numeric,
    reason: z.string().min(3).max(1000),
  }),
  z.object({
    type: z.literal("refund"),
    id: z.string(),
    amount: numeric,
    reason: z.string().min(3).max(1000),
  }),
  z.object({
    type: z.literal("collectionHold"),
    id: z.string(),
    disputed: z.boolean(),
    paused: z.boolean(),
  }),
  z.object({
    type: z.literal("scheduleReminder"),
    id: z.string(),
    dueAt: z.iso.datetime(),
  }),
  z.object({ type: z.literal("settings"), settings: settingsPatchSchema }),
]);
export type Command = z.infer<typeof commandSchema>;
