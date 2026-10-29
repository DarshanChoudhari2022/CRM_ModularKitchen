# Modular Kitchen Invoice Module Design

## Intent

Create one dedicated invoice workspace inside the Hutashana CRM. After login,
the user opens an Invoice module card and gets a connected, end-to-end billing
workspace for modular-kitchen projects: dashboard, invoice ledger, invoice
builder with live PDF preview, quotations, credit/debit notes, receipts,
client payment recording, client ledger, and a kitchen-specific service/rate
catalog.

The screenshots are the interaction reference. The CRM keeps its existing
secure command model, Supabase RLS boundary, immutable issued documents,
audit history, FY numbering, receipt allocation, and PDF renderer.

## Goals

- Make Invoice a first-class module card after login, with a clear entry point.
- Match the reference information architecture while retaining Hutashana's
  warm ivory, charcoal, copper visual system.
- Support the complete flow: quotation -> accepted scope -> invoice -> issue ->
  payment -> receipt -> share/download -> client ledger.
- Provide invoice, quote, receipt, credit-note and debit-note numbering,
  statuses, filters, search, date ranges and exportable PDF documents.
- Let owner/authorized staff add, edit, retire and version service catalog
  entries without changing historical invoice snapshots.
- Model modular-kitchen quantities by explicit dimensions/quantity and unit,
  not by unsafe automatic board-consumption assumptions.
- Keep prices initially as editable draft benchmark placeholders marked
  `verify before publishing`; no benchmark value may be silently published.

## Non-goals

- Statutory e-invoicing, IRN generation, GSTR filing or legal tax advice.
- Payment-gateway settlement reconciliation.
- Automatic design-to-BOM/cutting-list calculation from images or elevations.
- Automatic WhatsApp/email sending without configured provider credentials and
  explicit consent.
- Inventing Hutashana's actual selling rates.

## Reference UI and navigation

After authentication, the module launcher shows an **Invoices** card. Selecting
it opens `/invoices` with a persistent module sidebar:

1. Dashboard
2. Invoice Ledger
3. Raise Invoice
4. Credit & Debit Notes
5. Quotations
6. Proforma Invoices
7. Recurring Invoices
8. Receipts
9. Client Directory / Client Ledger
10. Service Catalog / Rate Card
11. Invoice Settings

The active section uses the Hutashana copper accent. Content uses an airy
two-column workspace where the editor is on the left and a sticky live document
preview is on the right at desktop widths; on mobile the preview follows the
editor and remains accessible through a preview toggle.

## Screens and behavior

### Dashboard

Show financial-year selector and cards for net invoiced, amount collected,
outstanding, average invoice value, overdue value and unapplied advances.
Provide quick actions for Raise Invoice, Add Client, New Quotation, Record
Payment and Issue Note. Include revenue trend, billed-vs-collected chart,
outstanding ageing buckets and recent invoice/payment activity.

### Invoice Ledger

Table columns: date/time, invoice number, client, project, due date, total,
amount collected, balance due, status and actions. Filters include status,
client, number/amount search, project and date range. Actions include view,
download, share, record payment, reminder, dispute/hold and credit/debit note.
Issued invoice rows are immutable; corrections are represented by notes or
controlled reversal workflows.

### Raise Invoice

The editor follows the reference screenshot:

- client/project search with Add Client shortcut;
- invoice date, due date, place of supply and reverse-charge toggle;
- quick-add service chips and searchable catalog;
- repeatable lines with description, HSN/SAC, unit, dimensions, quantity,
  unit rate, discount, GST rate, taxable amount and total;
- invoice-level flat or percentage discount;
- payment terms, notes/remarks, issued-by/signatory and optional milestone;
- Save as Draft, Duplicate, Save Revision and Issue Invoice actions;
- sticky live preview showing business identity, client snapshot, line table,
  tax split, totals, payment details, terms and watermark/status.

The preview must update without mutating an issued snapshot. Issuing performs
all current business/tax/settings validation and assigns a unique India FY
number through the existing server command.

### Quotations

Quotation builder mirrors the invoice editor but supports validity date,
revision history, reusable clauses and an explicit Send/Share action. An
accepted quotation creates an invoice draft with a frozen scope snapshot.
Changes after acceptance require a revision or approved scope-change order.

### Credit & Debit Notes

Provide note type toggle, source invoice, reason/basis, repeatable line items,
tax treatment, preview and issue/share actions. Notes reference the original
invoice and never rewrite its issued totals. Legal classification remains an
owner/accountant responsibility and is displayed as a review checkpoint.

### Receipts and Record Payment

Receipts list confirmed, reversed and refunded payments with search, client,
mode and date filters. Record Payment supports against-invoice and advance/on-
account modes, amount, date, payment mode, bank/UPI reference, notes and
optional allocation. On confirmation it creates an immutable receipt, allocates
the selected invoice amount within available balances, generates a numbered
receipt PDF and exposes Download/Share/Copy Link actions. Partial, overpayment,
unapplied advance, refund and allocation reversal remain visible in the client
ledger.

### Client Directory and Client Ledger

Show client identity, GSTIN/PAN, contact/WhatsApp, billing and place-of-supply
details. The ledger shows opening balance, invoices/debits, receipts/credits,
running balance, unapplied advances, ageing and document links for a selected
financial-year/date range.

### Service Catalog / Rate Card

Owner/authorized estimator can search, filter by category and unit, add, edit,
retire and create a new price revision. Published entries are immutable for
historical documents. Each entry includes:

- SKU and display name;
- category and subcategory;
- customer-facing description and internal estimator note;
- unit (`sqft`, `rft`, `running_m`, `nos`, `set`, `pair`, `job`, `day`, `kg`);
- required dimensions (width, height, depth, thickness where applicable);
- default quantity and minimum billable quantity;
- draft selling rate, cost rate and margin visibility by role;
- HSN/SAC, GST rate and tax-inclusive/exclusive default;
- finish/material/brand options;
- effective-from date, revision, status and review note.

Initial seed categories are draft-only and require review before publishing:

- carcass and cabinet modules;
- shutters and finishes (laminate, acrylic, PU, veneer, glass);
- drawers, hinges, channels and baskets;
- tall units, lofts, islands and breakfast counters;
- countertops, backsplashes and edge profiles;
- handles, profiles, sinks and accessories;
- appliances and appliance installation;
- measurement, delivery, installation, dismantling and service/warranty jobs.

The seed must include representative dimension prompts and units, but rates are
explicitly labelled `Indicative — verify before publishing` until Hutashana's
price sheet is imported.

### Invoice Settings

Tabs: firm/legal identity, bank and UPI payment details, branding/document
template, numbering and policy, terms/conditions and sharing preferences.
Settings are owner-controlled, audited and snapshotted into issued documents.
Configure invoice/quote/receipt/note prefixes, FY reset, credit period, default
GST behavior, RCM default, terms, document colors and provider toggles.

## Data and security decisions

- Reuse `crm_records` for invoice, quote, receipt, clause and catalog records;
  extend validated schemas rather than introducing a parallel ledger.
- Add typed invoice settings for payment accounts, document preferences and
  sharing policy.
- Preserve server-only service-role access and command-based mutations; browser
  clients never receive service-role credentials.
- Keep issued invoices, receipts, notes and published catalog revisions
  immutable; corrections are append-only records.
- Enforce owner/role permissions for settings, catalog publishing, issuing,
  receipt confirmation and refunds.
- Re-check consent, holds, balances, quiet hours and provider configuration
  immediately before any outbound share/reminder.
- Use private evidence/document storage and short-lived signed downloads.

## Acceptance criteria

- A signed-in owner sees one Invoice module card and can enter every listed
  section without losing workspace context.
- A quotation can be created, previewed, revised, accepted and converted to an
  invoice draft with a frozen scope snapshot.
- An invoice can be drafted with kitchen catalog lines and dimensions,
  previewed, saved, issued and downloaded as a correctly paginated PDF.
- A recorded partial/full/advance payment creates a receipt, updates balances,
  and can be downloaded/shared without exposing internal cost data.
- Credit/debit notes, refunds, allocation reversals and client ledger balances
  preserve an auditable history.
- Catalog add/edit/retire/revision works by role and cannot alter old document
  snapshots.
- Draft seed prices are visibly unverified; publishing requires explicit owner
  action and review metadata.
- Existing 35-test suite remains green and new domain, route, PDF and Playwright
  coverage proves the flows above.

## Open input needed before rate publishing

Hutashana's actual rate sheet, preferred GST/HSN classifications and invoice
branding/bank details must be supplied before the draft catalog or document
settings can be marked production-ready.

