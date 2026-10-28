# Provisioning and deployment

## Supabase

1. Create a project in a region appropriate for the Pune business. Keep development and production separate.
2. Apply `supabase/migrations/202610280001_crm.sql` in the SQL editor or with the Supabase migration CLI. Do not run seed/demo records against production.
3. Disable public signups. Create/invite the first owner through Supabase Auth. Replace `owner@example.com` in `supabase/bootstrap.sql` with that exact email and run the script once.
4. Obtain the project URL, publishable key and server-only service-role key. Put them in environment variables as named in `.env.example`. Never add the service-role key to a `NEXT_PUBLIC_*` variable or source control.
5. Set `NEXT_PUBLIC_DEMO_MODE=false` and `NEXT_PUBLIC_APP_URL` to the exact HTTPS production origin. Rebuild after changing any `NEXT_PUBLIC_*` value.
6. Sign in, configure legal billing identity and tax review in Settings, then import actual customers/rates. Enrol an authenticator for owner/accounts. Enrolled privileged factors require AAL2 verification on subsequent sessions. Enrollment is not automatically mandated for an account with no factor; require it operationally before the live pilot.
7. Provision additional Auth users and add explicit memberships through the SQL editor; there is no public role-management endpoint. Example (replace all values):

```sql
insert into public.memberships(organization_id,user_id,role)
select 'YOUR-ORGANIZATION-UUID'::uuid,id,'estimator'
from auth.users where email='actual.staff@example.com';
```

Roles: `owner`, `estimator`, `sales`, `accounts`, `manager`, `installer`. Installer `owner` fields on tasks/service records must hold the actual Auth user UUID. Other assignment fields can hold a team label, but individual task accountability is stronger with a UUID. The app currently selects the first membership; assign one business per staff account.

All business tables have RLS enabled with no browser-access policies. Only memberships have a self-read policy. Server APIs verify staff membership and role before service-role access; do not add permissive client policies. The `crm-private` bucket is private and has no client policies. Uploads are server-validated PDF/PNG/JPEG/WebP, at most 10 MB each, with organization/record-scoped paths and 60-second authenticated download links.

## Host

Use an eligible Vercel commercial plan or deploy the standard Next.js Node application to another suitable host. Build: `npm ci && npm run build`. Start: `npm start` (bind configuration can be adjusted for your host). Node 24 is used in development/CI. No hosting purchase or deployment is performed by this repository.

Set all live secrets in the host's secret store. Keep demo mode false, HTTPS origin correct, and database/host region close where available. Test a clean sign-in, expiry/refresh, MFA, role denial, private file and PDF after deployment.

## Authkey WhatsApp

1. Connect the actual WhatsApp Business number in Authkey. Obtain an approved **utility** reminder template and real permission evidence for test contacts.
2. Confirm the template uses `var1=customer name`, `var2=invoice number`, `var3=current balance in INR`, `var4=due date`. The adapter uses Authkey's documented JSON POST format with the key in an Authorization header, never a URL.
3. Set server-only `AUTHKEY_API_KEY` and a random `CRON_SECRET`. Set the approved template ID and enable the explicit scheduling policy in Settings.
4. Call `GET /api/cron/reminders` from an authenticated scheduler, with `Authorization: Bearer <CRON_SECRET>`, every few minutes during India contact hours. For Vercel, configure an eligible schedule under your actual plan; no Hobby-frequency workaround is assumed. Supabase Cron with a securely configured HTTP request is another option.
5. Worker claims at most three jobs/run, with row locks. It rechecks balance, permissions and holds after reserving a customer contact slot. Contacts must be separated by at least the configured interval (minimum 24 hours). Quiet hours are enforced in Asia/Kolkata.
6. Recognized `LogID` acknowledgement is labelled provider-submitted, not delivered. All unrecognized responses/timeouts are Unknown; reconcile the provider console in Integrations before retrying. Confirm the live response contract with an internal number and extend the parser only from observed/documented payloads.

An unavoidable payment-versus-provider-submission race remains between the final check and the external request. Staff can pause collections independently. Contact reservations are conservative: even an uncertain submission consumes the interval, avoiding blind duplicate sends.

## Website and Meta

Set `INTAKE_SECRET`, `INTEGRATION_ORGANIZATION_ID`, `INTEGRATION_ACTOR_ID` for a provisioned sales member. A trusted website **server** POSTs `/api/intake` using Bearer authentication. Keep that secret out of the public website bundle; protect its public form with rate limits/bot controls. Contract: eventId, name, optional phone/email/locality/notes/campaign, source, explicit consent boolean and evidence note. Replaying eventId/source is idempotent.

For Meta, set `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN`, and a currently supported `META_GRAPH_VERSION` such as the version actually configured in your app. Subscribe the Page's leadgen events to `/api/webhooks/meta`, verify ownership/permissions and run Meta's real test lead flow. The POST handler verifies the raw-body HMAC and fetches lead data using a server-side token. It only acknowledges after storing the lead; failed fetch/storage returns an error for provider retry. Long-term durable raw-event ingestion/backfill and token-renewal monitoring should be added before high-volume lead intake. Meta form submission is not assumed to imply WhatsApp consent.

The marketing website is unchanged by this build. Justdial uses reviewed CSV until the account representative confirms an entitled API/export contract.

## Voice

Follow `docs/voice-agent.md`. `VOICE_WEBHOOK_SECRET` protects the mapped outcome contract. A provider relay/tool must supply exactly that schema. `BOLNA_API_KEY`/`BOLNA_AGENT_ID` are reserved configuration; no outbound calling endpoint is exposed and the application does not purchase a number.

## Backups and pilot

Free Supabase does not include automatic backups; arrange encrypted off-site PostgreSQL dumps and separate private-file copies. Protect and rotate backup credentials. Test restore into a separate project, including membership/role rules and issued snapshots. Confirm a named alert owner, usage quotas, failed/unknown jobs and token renewals. Do not rely on free project availability or treat CSV export as a full backup.

Run alongside the owner's existing process for a controlled set of projects. Reconcile real quotations/invoices against accountant-approved reference examples and paper PDFs before making the new system authoritative. Do not recreate historic issued invoices as new current-year invoices. Opening balances need a separately reviewed migration with source evidence.
