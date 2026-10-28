# Build status — 28 October 2026

The runnable local CRM and Supabase deployment sources are implemented. Supabase was subsequently connected and migrated as recorded in `SUPABASE_STATUS.md`. Messaging/voice accounts and real business inputs are pending; this is not a declaration that the full planning roadmap is live or that the application is a statutory accounting suite.

## Verification

- ESLint: passed without warnings.
- TypeScript: passed.
- Vitest: 34 tests passed, including embedded PostgreSQL migration/privilege/concurrency tests and multi-page Unicode PDF generation.
- Next.js production build: passed.
- Browser suite: seven workflows cover all modules, enquiry persistence, quote → acceptance → invoice → partial payment/PDF, scope approval, partial goods receipts, CSV validation/import, closed APIs, per-request CSP nonces and mobile overflow.
- PDF visual inspection: single invoice and seven-page Unicode quotation inspected; heading spacing, repeated headers and all numbered footers verified.
- No live Supabase, provider, payment, telephony or deployment action was performed.

## Independent review and fixes

1. Supabase default row cap: replaced multi-query reads with a single SQL MVCC snapshot returning one JSON value. Regression verifies 1,005 records and tenant boundary.
2. Hidden costs overwritten by accounts: server preserves existing confidential costs for roles lacking cost access. Regression reproduces and fixes it.
3. Sales balances missing hidden receipts: server supplies authoritative balances and permitted financial aggregates; receipt detail remains hidden.
4. Installer linked-record denial: relationship existence validation is separate from assigned-record permissions; internal reminder suppression does not inherit installer read restrictions.
5. Old unresolved reminder dedupe: all active/unknown jobs are read regardless of age; a partial unique database index enforces one unresolved job per invoice. Unknown provider results require owner evidence before resolution.
6. Paid-return gap: append-only allocation reversals allow a confirmed paid invoice to be credited and its released funds refunded without silently rewriting allocations.
7. Operational gaps: added customer-approved scope changes, explicit BOM quantities, partial goods receipts and immutable rate versions. Voice, email, legal accounting and automatic provider delivery gaps remain explicitly documented in README.

## Decisions made during implementation

- Worked in the existing empty dedicated repository on `codex/crm-implementation`.
- User requested immediate execution after brainstorming; no further planning approval was requested.
- Used a modular Next.js app with server-owned JSONB business records and transactional optimistic concurrency. One staff business per account and 10,000 active records are explicit initial boundaries; finer-grained queries/transactions are needed beyond this scale.
- Real production rates/taxes are not seeded. Invoice issue requires billing identity and explicit tax-review acknowledgement; statutory presentation still requires accountant validation.
- Demo mode is explicit and browser-only. Live configuration fails closed when missing. Provider availability is never simulated as a successful connection.
- Vercel Hobby commercial-use restriction remains; no hosting plan was purchased.

See README for implemented capabilities, deployment.md for provisioning, acceptance.md for the live pilot, and voice-agent.md for the inbound agent contract and cost-selection criteria.
