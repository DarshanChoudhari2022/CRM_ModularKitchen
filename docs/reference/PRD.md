# Hutāśana CRM — Product Requirements Document

Date: 28 October 2026. Status: planning draft; proposed defaults require validation during discovery. This is a standalone CRM planned for a new folder and repository. No CRM implementation or external account setup is authorized by this document.

## 1. Purpose

Reduce the effort and errors involved in modular-kitchen quotations, preserve margin through revisions and execution, and give the team one reliable record of leads, projects, invoices, collections, and service commitments.

The owner's stated priorities are a reusable rate catalog, quotations and invoices for different sizes/materials/brands, reusable warranty and remarks text, consolidated marketing leads, customer balances, automated email/WhatsApp reminders, and a voice agent. Additional capabilities below are recommendations, not confirmed business practices.

## 2. Proposed product strategy

Build a separate secure internal web application, provisionally `crm.hutashana.com`, connected to the existing public website. Use a responsive desktop interface for estimation and accounts, with mobile views for sales, surveys, and installation updates. Begin with one Hutāśana business, INR, and Asia/Kolkata scheduling. Support Hindi, Marathi, and English customer communication as a later validated capability.

Alternatives considered:

| Approach | Benefit | Tradeoff |
|---|---|---|
| Custom CRM and modular-kitchen pricing engine — recommended | Exact measurement, component, revision, and margin workflows | Requires software ownership and implementation effort |
| Existing CRM/accounting product plus custom quotation module | Reuses established lead/accounting features | Integration costs and mismatched product/measurement models |
| Spreadsheet estimator plus automation | Fastest pilot with familiar tools | Weak control over revisions, permissions, concurrent edits, and reconciliation |

Recommendation: a custom operational CRM with accounting exports first. Reassess accounting integration after discovering Hutāśana's current system. Do not build a full statutory accounting suite in the initial release.

## 3. Users and access

| Role | Main work | Restrictions |
|---|---|---|
| Owner/admin | Rates, margins, discounts, reports, approvals | Audited changes; cannot erase financial history |
| Estimator/designer | Measurements, configurations, alternatives, quotation revisions | Discount limits; supplier cost visibility configurable |
| Sales/marketing | Leads, appointments, follow-ups, quotation sharing | No unrestricted financial adjustments |
| Accounts | Invoice issue, receipts, allocations, reconciliation, reminders | No silent alteration of accepted quotation scope |
| Procurement/project manager | Purchase orders, production, dispatch, installation | Works from approved scope and change orders |
| Installer/service partner | Assigned tasks, photos, snag closure | Only assigned projects; no margins or unrelated customer data |
| Customer — later portal | View documents, approve scope, pay, request service | Access only their own verified project |

## 4. Workflow and common failure points

These are domain-informed hypotheses for Hutāśana, not measured findings from interviews.

| Stage | Typical hurdle | Proposed control |
|---|---|---|
| Lead capture | Duplicate enquiries across channels; slow response | Source-aware inbox, deduplication, owner and next-action deadline |
| Qualification | Unrealistic budget, unknown possession date/site readiness | Budget range, locality, timeline, decision-maker, serviceable area |
| Survey | Wrong units, missing obstructions, incomplete appliance sizes | Structured measurement sheet, photos, revision and survey sign-off |
| Estimate | Mixing running-foot, area, piece, pair, and set prices | Explicit unit and pricing basis per line |
| Materials | Same brand has different series, thicknesses, finishes and grades | SKU/variant catalog with verified supplier price versions |
| Hardware | Drawer or hinge does not fit chosen cabinet | Compatibility rules and manual review where rules are absent |
| Negotiation | Several versions sent; costs change after acceptance | Revision history, expiry, frozen accepted version |
| Execution | Additions agreed over calls but never charged | Customer-approved change orders before procurement |
| Procurement | Substitutions, late hardware, missing fittings | Vendor orders, expected dates, receipt discrepancies, substitution approval |
| Installation | Site not ready, damage, unfinished snag work | Readiness checklist, delivery evidence, installation and snag sign-off |
| Collections | Advance mistaken for revenue; reminders after payment | Allocation ledger, reconciliation and reminder suppression |
| Warranty | Broad promises not supported by supplier warranty | Separate product and workmanship terms, coverage and start date |

## 5. Release scope

### Release A: quotation and receivables foundation

Authentication and roles; customer/project records; rate catalog; configurable kitchen quote builder; saved clauses; quotation PDF and version history; approval record; invoice drafts/issue; receipts and allocations; customer statement and aging; manual lead capture and CSV import; accountant export; audit trail and backups.

### Release B: lead and communication automation

Website intake, Meta lead adapter after access validation, Justdial adapter if commercially available, shared activity timeline, sales tasks, approved email/WhatsApp templates, scheduled reminders, inbound responses, payment integration and reconciliation.

### Release C: operational delivery

Survey mobile forms; approved bill of materials; vendor purchase orders; partial receipts; production milestones; dispatch; installation readiness; snag list; warranty/service register; planned versus actual project profitability.

### Release D: voice and advanced assistance

Supervised voice pilot; customer portal; supplier chase calls; permissioned reactivation; document extraction; recommendations based on approved templates; marketing attribution and forecasting.

## 6. Catalog and quotation requirements

### Catalog

Treat manufacturer/brand, supplier/vendor, customer company, and Hutāśana billing entity as distinct records. A dropdown labelled only 'company' would mix different business concepts.

Support material groups: carcass boards, shutters, laminate/acrylic/PU/veneer finish, edge banding, countertops, profiles, glass, hinges, runners/drawer systems, SS baskets, tall/pantry units, corner accessories, handles, skirting, appliances, transport and installation.

Suggested starting brands, to be confirmed by actual purchasing: Blum, Hettich, Häfele, Ebco, Godrej; board/laminate brands from Hutāśana's invoices. These are catalog examples, not supplier relationships or endorsements. Seed no invented selling rates or warranties.

Each SKU/variant records category, brand, series, model/code, dimensions, thickness, finish/colour, material grade (including SS grade when applicable), load rating where relevant, purchase unit, sales unit, tax classification, supplier, cost, selling rate, effective date, lead time, warranty reference, active status and evidence attachment. Distinguish TANDEM-branded products from generic drawer systems; do not treat 'tandem', 'SS', or a brand as a complete specification.

Rate updates have draft/published status, author and effective date. Bulk import requires preview, validation, duplicate review and explicit publish. Old documents retain their original rates. Expired or unknown cost blocks margin approval or requires an authorized override.

### Quote builder

1. Choose customer and site/project; reuse contact details while allowing separate billing and installation addresses.
2. Choose quote template and pricing method: module, front elevation area, running length, item/set, or approved package.
3. Add zones: base, wall, loft, tall unit, island and accessories.
4. Enter width/height/depth with visible units. Store normalized millimetres and the original input. Require a confirmed pricing basis; do not assume width × depth is the billable area.
5. Filter material and hardware dropdowns by specification and compatibility. Support manual custom lines with reason, owner and approval.
6. Calculate using published rules. Show rate source, quantity, net price, tax and internal margin breakdown.
7. Offer basic/standard/premium alternatives from approved configurations; explain price differences.
8. Add discounts, installation, delivery, exclusions, warranty clauses, validity and milestone schedule.
9. Save revision, preview PDF, obtain internal approval where needed, then share the immutable revision.
10. Record customer acceptance against that specific revision, with date, actor, evidence and included attachments.

Pricing exclusions must clarify plumbing, electrical work, civil work, appliance supply, stone cut-outs and site preparation where relevant. Measurements before survey are explicitly provisional. Customer changes after acceptance create change orders; never overwrite accepted scope.

### Reuse and suggestions

Save commonly used remarks, payment terms and warranty clauses as a searchable clause library. After typing a new clause, offer 'save for future use'; save it to a private draft library by default. Only an authorized user publishes shared defaults. Rank suggestions by category, brand, recent use and approved template. Keep personal customer details out of shared clauses. Do not automatically convert a promise to one customer into a standard warranty.

Customer history can suggest previous materials for that same customer. Shared configuration recommendations must omit customer identity and confidential negotiated prices. Every suggestion remains editable and requires selection.

## 7. Billing, payments and collections

Separate quotation, pro forma/payment request, sales order, tax invoice, receipt, credit note and refund. An accepted quote does not by itself issue a tax invoice or prove payment.

Store financial-year invoice sequence, issue date, due date, billing entity, recipient and GST details where applicable, HSN/SAC, line descriptions, quantities/units, taxable value, discounts, tax breakdown, total and relevant supply information. Accountant validates classification, rates, place-of-supply handling, advance treatment and e-invoice applicability before live billing. No blanket tax rate for every kitchen component or contract.

Drafts may be edited. Issued invoices retain their financial snapshot and are corrected through the approved cancellation/credit-note process. Allocate confirmed receipts to one or more invoices; keep unapplied advances visible. Support partial payments, refunds, disputed balances, credit adjustments and bank reference attachments.

Balance = issued invoice total − applied credit notes − valid receipt allocations, adjusted by allocation reversals. Project contracted value and unbilled milestones are separate from invoice receivables. Do not subtract advances twice. Report gross collections, refunds, net collections and outstanding separately.

Reminder policies are configurable per channel and customer: before due date, due date, overdue and staff escalation. Suggested pilot: 3 days before, due date, 7 days overdue, then manual review; owner must approve cadence. Recheck current balance, disputes, consent, payment reconciliation and recent contact immediately before every send. A promise-to-pay creates a dated follow-up, not a payment. Paid, paused, disputed or opted-out accounts suppress relevant reminders.

## 8. Leads and marketing

Unified inbox for website submissions, manual referrals, CSV, authorized Meta forms and available Justdial integration. Public directory scraping is not the default ingestion method. Unknown integration availability must not block manual import.

Capture source, provider lead ID, campaign/ad/form identifiers where supplied, UTM tags, timestamp, contact details, locality, requirements, budget, language, consent evidence, owner, stage, next task and loss reason. Preserve each source event even when enquiries are merged into one contact. Normalize phone numbers; similar phone/email is a match suggestion, not permission to merge unrelated projects automatically.

Sales stages: new → assigned → contacted → qualified → survey booked → estimated → quote shared → negotiation → won/lost/on hold. A won opportunity creates a project without losing original attribution. Track response time, quotation turnaround, source-to-sale conversion and booked margin; do not optimize ads only for low-cost leads.

## 9. Voice agent opportunities

| Use case | Value | Conditions and human handoff |
|---|---|---|
| Inbound enquiries/missed-call callback | Capture requirements outside staff availability | State business and AI identity; verify callback permission |
| Lead qualification | Gather locality, budget range and timeline | No binding price or unverified product promise |
| Survey/consultation scheduling | Reduce coordination and missed visits | Book only real available slots; confirm address |
| Quote follow-up | Discover objections and next action | No unauthorized discounts or acceptance on customer's behalf |
| Payment reminder | Confirm receipt of invoice and expected payment date | Verify recipient before financial detail; dispute goes to accounts |
| Site-readiness check | Confirm civil/electrical/appliance readiness | Site manager reviews uncertain responses |
| Delivery/installation confirmation | Reduce failed visits | Use approved operational schedule |
| Supplier order follow-up | Capture ETA and missing items | No purchase or substitution commitment |
| Snag/warranty intake | Categorize issue, collect callback request | No diagnosis or warranty coverage promise |
| Post-installation feedback | Identify service problems and referrals | Respect permission and stop request |
| Internal staff voice notes | Turn site notes into draft tasks | Staff confirms extracted measurements before use |

Pilot one use case first: reminders to existing customers who agreed to calls. Support English first unless language testing shows a different business need. Evaluate Hindi/Marathi on real speech, names, amounts, interruptions and mixed-language conversation before rollout.

## 10. Success and acceptance

Targets below are proposed pilot targets, measured against a baseline collected in week one:

- Standard quotation prepared in under 10 minutes after survey/catalog setup; benchmark at least 20 real historical examples.
- No unexplained amount variance against owner-approved reference quotations.
- Every issued invoice and receipt traceable to an actor, project and immutable source document.
- Every active lead has an owner and next action; duplicates preserve source history.
- Zero duplicate invoice issuance, double payment posting or reminder send from replayed events in acceptance tests.
- No collection reminder after confirmed full allocation, suppression or opt-out.
- Rate changes never change old issued PDFs or accepted quotation amounts.
- All critical financial actions enforce server-side role checks; installer access cannot expose unrelated customers.
- Voice pilot has no invented balances, unauthorized commitments or identity-related disclosure incidents. Evaluate task completion, human transfers, complaints and cost per successful outcome.

## 11. Open decisions before implementation

Obtain sample quotations/invoices, real supplier lists and units, measurement practices, GST/billing entity details, accountant workflow, team roles, monthly lead/quote volume, budget and preferred hosting. Confirm whether manufacturing is internal or outsourced, whether multiple branches/legal entities are needed, existing accounting software, Justdial contract capabilities, Meta asset ownership, WhatsApp number/provider, and customer communication permissions. These affect delivery effort; none are assumed resolved.

## 12. Research references

See [DESIGN.md](./DESIGN.md#research-register) for checked sources, integration gaps and the distinction between observed product constraints and proposed business improvements.
