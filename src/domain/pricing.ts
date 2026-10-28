import Decimal from "decimal.js";
import {
  lineSchema,
  type Calculation,
  type CRMRecord,
  type QuoteLine,
} from "./types";
export const D = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});
export const money = (value: Decimal.Value) => new D(value).toFixed(2);
export const sum = (values: Decimal.Value[]) =>
  values.reduce<Decimal>((n, value) => n.plus(value), new D(0));

export function calculateQuote(inputs: QuoteLine[]): Calculation {
  if (!inputs.length || inputs.length > 200)
    throw new Error("Add between 1 and 200 quotation lines.");
  let subtotal = new D(0),
    discounts = new D(0),
    taxes = new D(0),
    costs = new D(0);
  const lines = inputs.map((input) => {
    const line = lineSchema.parse(input);
    if (new D(line.quantity).lte(0))
      throw new Error("Quantity must be greater than zero.");
    if (new D(line.discount).gt(100) || new D(line.taxRate).gt(100))
      throw new Error("Discount and tax must be between 0 and 100%.");
    let qty = new D(line.quantity);
    if (line.method === "area") {
      if (!["ft2", "m2"].includes(line.unit))
        throw new Error("Area pricing requires ft² or m².");
      if (new D(line.width).lte(0) || new D(line.height).lte(0))
        throw new Error(
          "Area requires positive billable width and height in mm.",
        );
      qty = qty
        .mul(line.width)
        .mul(line.height)
        .div(line.unit === "ft2" ? new D("304.8").pow(2) : "1000000");
    } else if (line.method === "length") {
      if (!["ft", "m"].includes(line.unit))
        throw new Error("Length pricing requires ft or m.");
      if (new D(line.width).lte(0))
        throw new Error("Running length must be positive.");
      qty = qty.mul(line.width).div(line.unit === "ft" ? "304.8" : "1000");
    } else if (!["piece", "pair", "set", "package"].includes(line.unit))
      throw new Error(
        "Item pricing requires a piece, pair, set or package unit.",
      );
    const gross = new D(money(qty.mul(line.rate)));
    const discount = new D(money(gross.mul(line.discount).div(100)));
    const net = gross.minus(discount);
    const tax = new D(money(net.mul(line.taxRate).div(100)));
    const cost = new D(money(qty.mul(line.cost)));
    subtotal = subtotal.plus(gross);
    discounts = discounts.plus(discount);
    taxes = taxes.plus(tax);
    costs = costs.plus(cost);
    return {
      ...line,
      billableQuantity: qty.toFixed(8),
      net: money(net),
      tax: money(tax),
      total: money(net.plus(tax)),
      costTotal: money(cost),
    };
  });
  const net = subtotal.minus(discounts);
  return {
    lines,
    subtotal: money(subtotal),
    discount: money(discounts),
    net: money(net),
    tax: money(taxes),
    total: money(net.plus(taxes)),
    cost: money(costs),
    margin: net.gt(0) ? net.minus(costs).div(net).mul(100).toFixed(2) : "0.00",
  };
}

export function documentTotal(record: CRMRecord): string {
  return (
    record.calculation?.total ??
    (record.lines?.length
      ? calculateQuote(record.lines).total
      : (record.amount ?? "0.00"))
  );
}
export function balanceFor(invoice: CRMRecord, records: CRMRecord[]): string {
  if (invoice.kind !== "invoice" || invoice.status === "Draft") return "0.00";
  if (invoice.receivableBalance !== undefined) return invoice.receivableBalance;
  const receipts = records.filter(
    (r) => r.kind === "receipt" && r.status === "Confirmed",
  );
  const paid = sum(
    receipts.flatMap((r) =>
      (r.allocations ?? [])
        .filter((a) => a.invoiceId === invoice.id)
        .map((a) => a.amount),
    ),
  ).minus(
    sum(
      receipts.flatMap((r) =>
        (r.allocationReversals ?? [])
          .filter((a) => a.invoiceId === invoice.id)
          .map((a) => a.amount),
      ),
    ),
  );
  return money(
    D.max(
      0,
      new D(documentTotal(invoice))
        .minus(paid)
        .minus(sum((invoice.credits ?? []).map((c) => c.amount))),
    ),
  );
}
export function availableReceipt(receipt: CRMRecord): string {
  if (receipt.status !== "Confirmed") return "0.00";
  return money(
    new D(receipt.amount ?? 0)
      .minus(sum((receipt.allocations ?? []).map((a) => a.amount)))
      .plus(sum((receipt.allocationReversals ?? []).map((a) => a.amount)))
      .minus(sum((receipt.refunds ?? []).map((a) => a.amount))),
  );
}
export const inr = (value: string | number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value));
export function businessDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function financialYear(date: string): string {
  const [year, month] = businessDate(new Date(date)).split("-").map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}
