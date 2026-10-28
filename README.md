# Hutāśana CRM

A responsive workspace for a modular-kitchen business: enquiries, customers, quotations, billing, collections and project delivery. Built with Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, Decimal.js and React PDF.

## Run locally

```sh
npm ci
npm run dev
```

Open [the local workspace](http://127.0.0.1:3000). The supplied local configuration enables **demo mode** with explicitly fictional clients, rates and billing details. Changes persist in this browser's local storage. Demo sends no messages, makes no calls and does not connect to a production database. Reset it in Settings. Never enter real customer data into a publicly hosted demo.

Copy `.env.example` to `.env.local` to configure a live workspace. Set `NEXT_PUBLIC_DEMO_MODE=false` and rebuild; public Next.js environment variables are compiled into the browser bundle. Missing configuration fails closed to a setup/sign-in screen; it never falls back to demonstration data.

## Implemented workflows

- Dashboard with actual workspace counts, invoice/collection trends, source mix, tasks and project progress.
- Lead capture, stage pipeline/board, source attribution, CSV preview/import, search, owner and next action. New enquiries create internal follow-up tasks. Won enquiries create a customer/project; contacts can have multiple projects.
- Customers with separate project records, permission evidence, billing information and invoice statements.
- Catalog drafts, publishing, revisions, exact SKU/unit/rate references, cost visibility and shared terms library. Published rates stay readable when replaced.
- Quotation editor: elevation area, running length, items, sets, packages, zones, millimetre inputs, per-line discounts/taxes, internal cost/margin, saved terms, immutable shared revisions and recorded customer acceptance. Final calculations are authoritative on the server.
- Draft/issue invoice workflow, Indian financial-year numbering, frozen billing/customer snapshots, confirmed receipts, partial/overpayments, unapplied advances, allocations, allocation reversals, credit adjustments, refunds, disputes and collection pauses. No silent financial deletion.
- Customer-facing PDF downloads with bundled Noto Latin/Devanagari fonts, page breaks, terms, totals and demo/draft markings. Costs and margins are excluded.
- Project stages, structured site survey checklists/sign-off, evidence references, approved scope changes, estimator-reviewed BOM items, purchase quantities, partial goods receipts, and service/warranty records.
- Reports for receivables aging, source conversion, collections and planned purchases. CSV formula injection is neutralized on export.
- Supabase private evidence upload/download, invite-only staff roles, authenticator enrollment, server-side membership verification, HttpOnly session cookies and transactional audit snapshots.
- Explicit invoice reminder scheduling, transactional outbox, contact frequency reservation, quiet hours, current balance/permission/hold rechecks, Authkey WhatsApp adapter, unknown-send reconciliation and deduplication.
- Signed Meta Lead Ads retrieval webhook; protected website and voice outcome intake. These require actual provider access and pilot validation.

## Live setup

Follow [deployment and provisioning](docs/deployment.md), then [acceptance checks](docs/acceptance.md). The supplied Supabase project is now connected locally and the CRM migration has been applied. Credentials are stored only in the git-ignored `.env.local`, with demo mode disabled. The empty Hutashana organization/workspace is provisioned; the first owner Auth user and membership still require the chosen owner email. No hosted production deployment was performed. See [live connection verification](docs/SUPABASE_STATUS.md).

Vercel Hobby is for personal non-commercial use; a business CRM requires an eligible paid plan or another host. Supabase Free has quotas, inactivity pausing and no automatic backups. Keep the application portable, and test off-site database **and file** restores before relying on live billing. See [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines) and [Supabase pricing](https://supabase.com/pricing).

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests cover financial arithmetic, state transitions, role redaction, allocation/refund scenarios, CSV input, raw-body signatures, provider uncertainty, database privileges, atomic commits, duplicate numbers and jobs, reads over 1,000 records, browser workflows, PDF download and mobile layout. Database tests execute the migration in embedded PostgreSQL/PGlite with minimal Auth/Storage schema stubs; they do not replace live Supabase Auth, Storage, RLS and restore tests.

## Architecture

`src/domain/` contains validated types, pure pricing and commands. `src/components/` contains the responsive workspace. `src/lib/server/` validates sessions and commits server-owned records. `src/lib/integrations/` contains provider adapters and signature verification. `supabase/` contains the migration and owner bootstrap SQL.

Operational records use validated, organization-scoped JSONB rows with indexed kind/customer/SKU/provider identities. Financial transitions are command-controlled. Each business mutation uses one PostgreSQL transaction with an expected organization revision, changed rows, settings/counters, jobs and an append-only audit entry. Concurrent stale writes return HTTP 409 rather than overwrite work. Browser roles cannot directly read/write business tables or invoke privileged RPCs.

The initial deployment is one business per staff user, up to 10,000 active business records. Reads use a single SQL snapshot, avoiding PostgREST's default row cap. At larger scale, move reports/history to paged module queries and narrow entity transactions before increasing that boundary. Telephone audio is handled by a managed voice platform, not a long-running Vercel request.

## Boundaries that still need business/provider input

- Real rates, supplier SKUs/compatibility evidence, warranty terms, company identity, historical balance migration and accountant-approved examples are not invented. Production starts empty.
- Invoice totals and adjustments work, but statutory tax classification, CGST/SGST/IGST presentation, place of supply, legal credit notes, cancellations/e-invoicing and accounting integration require accountant approval and additional configuration. Current credit entries are internal adjustments, not a claim of statutory credit-note compliance.
- BOMs require explicit estimator quantities; this is not automatic cutting optimization, material nesting or full inventory valuation. Procurement tracks orders/receipts, not supplier accounts payable. Manufacturing/installation is milestone and task tracking.
- Voice intake is an integration contract and agent brief, not a provisioned telephone agent. Real number routing, provider tools, real-time transfer, slot booking, language quality and lowest all-in cost must be tested. See [voice pilot](docs/voice-agent.md).
- Authkey submission acknowledgement is not proof of delivery. An unrecognized response/timeout remains Unknown. Provider-specific inbound WhatsApp and delivery-status callback mapping are not enabled; reconcile using the console until that contract is verified.
- No transactional email service, payment gateway settlement sync, WhatsApp quotation delivery, ad-spend sync, public customer portal/e-signature, automatic accounting export integration or Justdial API is provisioned. Manual PDFs/CSV and staff-reviewed evidence remain available. No payment screenshot is treated as cleared funds.

These boundaries are intentional visible setup work, not simulated integrations. Original planning references are in `docs/reference/`; implementation status is documented here.
