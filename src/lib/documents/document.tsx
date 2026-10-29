import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  type TextProps,
} from "@react-pdf/renderer";
import type { PropsWithChildren } from "react";
import type { BusinessSettings, CRMRecord } from "@/domain/types";
import { calculateQuote, inr } from "@/domain/pricing";

export function registerDocumentFonts(base: string) {
  Font.register({ family: "Noto", src: `${base}/NotoSans-Regular.ttf` });
  Font.register({
    family: "Devanagari",
    src: `${base}/NotoSansDevanagari-Regular.ttf`,
  });
}
const styles = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingBottom: 55,
    paddingHorizontal: 38,
    fontSize: 8,
    fontFamily: "Noto",
    color: "#384b3b",
    lineHeight: 1.6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#dbe4d3",
    paddingBottom: 18,
    marginBottom: 18,
  },
  brand: {
    fontSize: 21,
    lineHeight: 1.35,
    marginBottom: 5,
    color: "#35513c",
    maxWidth: 350,
  },
  eyebrow: { fontSize: 7, color: "#8b9b7a", letterSpacing: 1 },
  title: { fontSize: 18, lineHeight: 1.35, marginBottom: 12 },
  muted: { color: "#8b9682" },
  parties: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  party: { width: "47%" },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f0f4e9",
    padding: 8,
    fontSize: 7,
    color: "#80906c",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e4eadd",
    padding: 8,
  },
  desc: { width: "37%", paddingRight: 8 },
  qty: { width: "18%", paddingRight: 5 },
  rate: { width: "15%" },
  tax: { width: "12%" },
  total: { width: "18%", textAlign: "right" },
  summary: {
    alignSelf: "flex-end",
    width: "44%",
    marginTop: 18,
    marginBottom: 22,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  grand: {
    borderTopWidth: 1,
    borderTopColor: "#cfdcc4",
    paddingTop: 9,
    marginTop: 5,
    fontSize: 12,
    lineHeight: 1.5,
  },
  terms: {
    borderTopWidth: 0.5,
    borderTopColor: "#dae4d0",
    paddingTop: 15,
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 38,
    right: 38,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    height: 20,
    lineHeight: 1.4,
    color: "#9da891",
  },
  watermark: {
    fontSize: 9,
    color: "#b1835a",
    marginBottom: 12,
    padding: 8,
    backgroundColor: "#fbf3e6",
  },
});
const rupees = (v: string) =>
  `INR ${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function T({ children, ...props }: PropsWithChildren<TextProps>) {
  const text = String(children ?? "");
  return (
    <Text
      {...props}
      style={[
        props.style ?? {},
        { fontFamily: /[\u0900-\u097f]/.test(text) ? "Devanagari" : "Noto" },
      ]}
    >
      {children}
    </Text>
  );
}
export function FinancialDocument({
  record,
  settings,
  demo = false,
  customer,
}: {
  record: CRMRecord;
  settings: BusinessSettings;
  demo?: boolean;
  customer?: CRMRecord;
}) {
  if (record.kind === "receipt") return <Document title={record.name}><Page size="A4" style={styles.page}><T style={styles.brand}>{settings.billingName || "Hutāśana Kitchens"}</T><T>{settings.billingAddress}</T><T>PAYMENT RECEIPT · {record.status}</T><T>Receipt ID: {record.id}</T><T>Date: {record.dueDate || record.createdAt.slice(0,10)}</T><T>Received from: {customer?.name || "Client"}</T><T>Amount received: {inr(record.amount || "0")}</T><T>Payment reference: {record.reference}</T>{record.allocations?.map(a=><T key={a.invoiceId}>Allocated to {a.invoiceId}: {inr(a.amount)}</T>)}<T>This acknowledges the recorded payment. Retain the bank reference for reconciliation.</T>{demo && <T>DEMO DOCUMENT</T>}</Page></Document>;
  const c = record.calculation ?? calculateQuote(record.lines ?? []),
    snapshot = record.snapshot ?? {
      billingName: settings.billingName,
      billingAddress: settings.billingAddress,
      gstin: settings.gstin,
      phone: settings.phone,
      customerName: customer?.name ?? "Customer details not selected",
      customerAddress: customer?.address ?? "",
      customerGstin: customer?.gstin ?? "",
    };
  return (
    <Document
      title={`${record.number ?? "Draft"} · ${record.name}`}
      author={snapshot?.billingName ?? settings.billingName}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View>
            <T style={styles.brand}>
              {snapshot?.billingName || settings.billingName || "Hutashana"}
            </T>
            <T style={styles.muted}>
              {snapshot?.billingAddress ?? settings.billingAddress}
            </T>
            {(snapshot?.gstin ?? settings.gstin) && (
              <T>GSTIN: {snapshot?.gstin ?? settings.gstin}</T>
            )}
            <T style={styles.muted}>{snapshot?.phone ?? settings.phone}</T>
          </View>
          <View>
            <T style={styles.eyebrow}>
              {record.kind === "invoice" ? "INVOICE" : "QUOTATION"}
            </T>
            <T>{record.number ?? "DRAFT · NOT ISSUED"}</T>
            <T style={styles.muted}>Revision {record.revision ?? 1}</T>
          </View>
        </View>
        {(demo || record.status === "Draft") && (
          <T style={styles.watermark}>
            {demo
              ? "DEMONSTRATION ONLY · FICTIONAL RATES · NOT A VALID TAX INVOICE"
              : "DRAFT · NOT ISSUED · FOR REVIEW ONLY"}
          </T>
        )}
        <T style={styles.title}>{record.name}</T>
        <View style={styles.parties}>
          <View style={styles.party}>
            <T style={styles.eyebrow}>PREPARED FOR</T>
            <T>{snapshot?.customerName ?? "Customer details not frozen yet"}</T>
            <T style={styles.muted}>{snapshot?.customerAddress ?? ""}</T>
            {snapshot?.customerGstin && <T>GSTIN: {snapshot.customerGstin}</T>}
          </View>
          <View style={styles.party}>
            <T>
              {record.kind === "invoice" ? "Due date" : "Valid until"}:{" "}
              {record.dueDate ?? "Not specified"}
            </T>
            <T>
              Document date:{" "}
              {(record.issuedAt ?? record.createdAt).slice(0, 10)}
            </T>
            <T style={styles.muted}>Currency: INR · dimensions: millimetres</T>
          </View>
        </View>
        <View style={styles.tableHead} fixed>
          <T style={styles.desc}>SPECIFICATION</T>
          <T style={styles.qty}>QTY / UNIT</T>
          <T style={styles.rate}>RATE</T>
          <T style={styles.tax}>TAX</T>
          <T style={styles.total}>TOTAL</T>
        </View>
        {c.lines.map((line) => (
          <View key={line.id} style={styles.row} wrap={false}>
            <View style={styles.desc}>
              <T>{line.description}</T>
              <T style={styles.muted}>
                {line.zone} · {line.method}
                {line.hsn ? ` · HSN/SAC ${line.hsn}` : ""}
              </T>
              {["area", "length"].includes(line.method) && (
                <T style={styles.muted}>
                  {line.width} × {line.height} mm
                </T>
              )}
              {Number(line.discount) > 0 && (
                <T style={styles.muted}>Discount: {line.discount}%</T>
              )}
            </View>
            <T style={styles.qty}>
              {Number(line.billableQuantity).toFixed(3)} {line.unit}
            </T>
            <T style={styles.rate}>{rupees(line.rate)}</T>
            <View style={styles.tax}>
              <T>{line.taxRate}%</T>
              <T style={styles.muted}>{line.tax}</T>
            </View>
            <T style={styles.total}>{rupees(line.total)}</T>
          </View>
        ))}
        <View style={styles.summary} wrap={false}>
          {[
            ["Subtotal", c.subtotal],
            ["Discount", Number(c.discount) > 0 ? `-${c.discount}` : "0.00"],
            ["Net value", c.net],
            ["Taxes", c.tax],
          ].map(([label, value]) => (
            <View style={styles.summaryRow} key={label}>
              <T>{label}</T>
              <T>{rupees(value)}</T>
            </View>
          ))}
          <View style={[styles.summaryRow, styles.grand]}>
            <T>Total</T>
            <T>{rupees(c.total)}</T>
          </View>
        </View>
        <View style={styles.terms}>
          <T style={styles.eyebrow}>TERMS, EXCLUSIONS & WARRANTY</T>
          <T>{record.terms ?? "Terms to be confirmed before acceptance."}</T>
        </View>
        {record.acceptance && (
          <View style={styles.terms}>
            <T style={styles.eyebrow}>RECORDED ACCEPTANCE</T>
            <T>{record.acceptance}</T>
          </View>
        )}
        <View style={styles.footer} fixed>
          <T>
            {record.kind === "quote"
              ? "A quotation is not proof of payment."
              : "Payment status is maintained in the customer ledger."}
          </T>
        </View>
      </Page>
    </Document>
  );
}
