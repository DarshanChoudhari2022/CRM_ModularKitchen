# Hutāśana CRM — Implementation Roadmap

Date: 28 October 2026. Status: planning roadmap, not authorization to build, subscribe, deploy, contact customers or create a remote repository. Read [PRD](./PRD.md) and [DESIGN](./DESIGN.md) first.

## 1. Project boundary

The CRM will live in a new folder and private Git repository; proposed name `hutashana-crm`. Copy this planning bundle into that repository's `docs/` when it is created. The documents currently live in the marketing repository only for handover. No change to public-site functionality is part of this documentation task.

Suggested stack: TypeScript, Next.js, PostgreSQL, a supported SQL ORM, established auth, private object storage, transactional email, durable workers and scheduled jobs. Validate deployment/runtime compatibility first. Use a modular application with adapter interfaces for messaging, payments and voice. Avoid locking financial logic into a provider-specific workflow builder.

## 2. Phase 0 — business evidence and decisions

Owner, estimator and accountant walkthroughs: follow several jobs from lead through payment and service. Gather at least 10–20 historical quote variations, one complete job with revisions, representative supplier bills, material catalogs, invoice/receipt examples, payment schedule and open-balance statement. Use redacted/synthetic data in development.

Deliverables: approved unit/pricing glossary; rate import template; account role matrix; quote/invoice layout samples; tax treatment decisions signed off by accountant; billing identity; actual brands/SKUs; supplier warranties; current lead sources and volumes; hosting/budget decision; prioritized scope. Record what is provisional and what is survey-confirmed.

Exit: owner can explain how each sample total was calculated, accountant agrees document distinctions and tax rules, and the team agrees a measurable quotation-time baseline. Resolve any incompatible pricing practices before coding formulas.

## 3. Phase 1 — foundation and catalog

Create new private repository/folder only on implementation authorization. Add environment isolation, migration tooling, auth, server-side roles, database constraints, private uploads, audit infrastructure and CI. Set up organization and staff records. Add customers, contacts, projects and addresses.

Implement catalog variants, brands and suppliers separately; unit conversions; price-book draft/import/validation/publish; compatibility evidence; warranty references; clause draft/publish permissions. Use no invented production rates. Add CSV export to prevent lock-in.

Exit: estimator imports an actual approved rate sheet; invalid units/duplicate ambiguous SKUs are rejected; publishing a new version preserves old data; unauthorized users cannot view purchase costs or edit rates.

## 4. Phase 2 — quotation engine and professional PDFs

Implement pure deterministic calculation functions before UI integrations. Validate quantity rules and rounding using owner-approved examples. Then build quote workspace, template library, alternatives, custom lines, discount approvals, margin panel and revision snapshots.

Implement server-generated PDF from immutable snapshots; private download; template versioning; explicit sharing; accepted revision and evidence; change-order creation. A customer portal signature workflow can follow manual evidence capture rather than delaying the core estimator.

Exit: benchmark all reference quotations; reconcile every difference; prepare standard quotation within proposed target; demonstrate old shared PDF and accepted revision remain unchanged after catalog or clause updates.

## 5. Phase 3 — billing and receivables MVP

Implement accountant-reviewed invoice fields, financial-year numbering, draft/issue transition, snapshots, receipt confirmation, allocations, credit adjustments/refunds/reversals, due dates, milestone tracking, aging report and customer statements. Include CSV/accounting export. Start payment confirmation manually with authorized evidence; add gateway ingestion after the ledger is reliable.

Exit: issue and reconcile a complete sample project, including advance, two invoices, partial receipt, credit note, balance, overpayment and refund. Two staff issuing concurrently cannot generate duplicate numbers. Incorrect entries are reversed with references and audit, not deleted.

Release A pilot: run alongside the existing process for a controlled set of projects. Owner/accounts approve matched totals before using generated documents as the primary process.

## 6. Phase 4 — leads and channel integrations

Implement manual lead capture, CSV import preview, contact match suggestions, owner assignment, stages, next tasks, source attribution and activity timeline. Add website capture endpoint and coordinate public-site integration as a separate reviewed change.

Run Meta access spike with a real authorized test form. Document required permissions, token renewal and failure/recovery behavior. Implement source-event inbox, signature validation, async fetch, idempotency, authorized backfill and monitoring. Justdial begins with confirmed authorized import; automated adapter only after obtaining contract and payload documentation.

Exit: duplicate events create one enquiry; one contact can retain multiple projects/source events; failed provider access is visible and recoverable; test lead travels from each enabled channel into an assigned CRM task. Attribute won value back to source without losing multi-touch events.

## 7. Phase 5 — reminders, messaging and payment sync

Implement transactional outbox, worker scheduling, policy versions, cross-channel contact cap, suppressions, message previews, send attempts, inbound responses and staff escalation. Integrate one verified email sender first, then official WhatsApp/provider templates. Add gateway webhook verification, payment-level deduplication and reconciliation jobs.

Pilot with internal test contacts and then approved existing customers. Owner approves wording, cadence, eligibility and exception handling. Disputes and opt-outs stop pending messages. Payment reports are reconciled by accounts before re-enabling collection contact.

Exit: paid customer receives no due reminder in controlled tests; retry storms do not double-post payments; timeout creates an unknown-send state and reconciliation rather than blind duplicates; failed sends reach staff queue. Ensure messages do not expose another customer's document.

## 8. Phase 6 — project operations

Implement measurement versions and sign-off, reviewed BOM export, purchase orders, vendor ETA and partial receipt, stock allocation at project level, production milestones, site readiness, dispatch evidence, installation appointments, snag resolution and handover. Tie approved change orders to additional procurement and billing.

Exit: follow one project end to end and compare approved scope with procured/installed scope. Late substitutions require customer/owner approval where relevant. Service staff can locate component warranty evidence without accessing margins.

## 9. Phase 7 — voice pilot and advanced intelligence

Compare two or three telephony/conversation providers using the same recorded test scripts, languages and infrastructure constraints. Select through measured pilot, not a feature list. Verify commercial calling eligibility and provider obligations before outbound use.

Start with supervised payment-date reminders for eligible existing customers. Add identity check, AI disclosure, convenience check, real-time balance lookup, bounded tools, stop/transfer, structured outcomes, call caps and recording controls. Add scheduling and qualification only after the first use case meets acceptance criteria.

Exit: adversarial and real pilot calls handle incorrect recipient, disputed debt, already-paid claim, opt-out, unavailable human, interruptions, mixed language, background noise, currency/date ambiguity and disconnected calls. No direct model action alters financial records. Owner reviews outcome accuracy and complaints before increasing call volume.

## 10. Dependency and acceptance map

| Capability | Depends on | Must prove |
|---|---|---|
| Reliable quote | Approved formulas, units and real rates | Reference quote parity and immutable revisions |
| Invoice issue | Accountant rules, numbering, permissions | Concurrent issue safety and correct document fields |
| Balance display | Confirmed receipts and allocation ledger | No double counting of advance, refund or credit |
| Automated reminders | Reliable balance and suppressions | No send to paid/disputed/opted-out recipient |
| Meta/Justdial sync | Provider access and valid source contract | Real authorized test lead and retry recovery |
| Procurement | Accepted quote/BOM/change order | Purchase traceability and substitution approval |
| Voice collections | All collection controls plus telephony eligibility | Verified recipient, current amount and safe handoff |

## 11. Test strategy

Financial tests: measurement conversions, negative/zero values, unit mismatch, boundaries, package inclusion, decimal rounding, discount allocation, tax configurations, margin versus markup, quote version preservation, invoice sequence races, allocations and reversals. Use owner-approved expected totals rather than implementation-mirroring assertions.

Integration tests: repeated events, different events for one payment, out-of-order delivery, raw-body signature verification, expired tokens, provider outage, import replay, unknown send timeout, payment arriving during reminder dispatch and worker restart. Security tests: organization isolation, role denial, expired file links and protected cost fields.

PDF quality checks: realistic long descriptions, multiple pages, tax tables, customer addresses, Unicode names, total reconciliation, footer/page breaks, and exclusion of internal data. Review rendered output on screen and a printed sample.

Acceptance scripts: estimator builds a kitchen with different brands and sizes; new clause is saved and suggested safely on the next quote; customer accepts revision 2; supplier rate changes; revision 2 stays unchanged; project variation becomes change order; receipts settle invoices; reminder cancels; warranty claim identifies original installed specification.

## 12. Pilot, rollout and operational readiness

Use feature flags for new integrations and all automatic outbound channels. Start in preview/manual approval mode. Migrate rate sheets and opening balances through reviewed import batches with source references and reconciliation totals. Do not recreate historic invoices as newly issued documents. Track historic import versus issued-in-system records explicitly.

Before live pilot: restore backup; run least-privilege review; validate email domain/provider setup; rotate test credentials; verify production configuration; assign alert owner; document rollback. Application rollback must preserve financial records and compatible migrations. Pause outbound automation independently of the UI if necessary.

Training: estimator rate setup and quote revisions; accounts allocation/disputes; sales next-action ownership; project manager substitutions/snags; owner approvals and reporting. Provide one-page operating guides and an exception queue that has a named owner.

## 13. Effort and ongoing costs

No fixed delivery promise is supportable before sample documents, volumes and provider access are known. Plan and estimate each phase after its evidence/exit criteria are agreed. Release A is the first operational milestone; later integrations may proceed independently only once their dependencies are satisfied.

Budget categories: engineering and QA; hosting/database; auth; object storage/backups; PDF jobs; email; WhatsApp/provider usage; telephony plus speech/model minutes; payment fees; monitoring; accountant review; data cleanup; training and ongoing catalog maintenance. Record unit prices from vendors at selection time, expected monthly volume, retry/failure allowance and cost per completed outcome. Do not quote unverified current provider prices.

## 14. Implementation handoff checklist

- Owner approves the scope and proposed separate application architecture.
- Real rate sheet and at least one accepted quote with revisions are available.
- Accountant validates invoice/tax/advance/credit-note treatment.
- Pricing units and formula/rounding examples are approved.
- Brand/series/SKU and warranty evidence have a responsible maintainer.
- Team roles, limits and approval thresholds are set.
- Source accounts and authorized integration capabilities are confirmed.
- Automatic reminders and voice remain disabled until policies and pilot pass.
- New repository, folder, deployment host and responsible maintainers are selected.

These are prerequisites for reliable implementation; the documents are complete planning drafts even while business-specific decisions remain open.
