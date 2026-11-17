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

## Meta WhatsApp quotation automation

1. Apply the WhatsApp migrations in `supabase/migrations/` after the CRM migration, in filename order. Use a separate test Supabase project before production. Set `NEXT_PUBLIC_DEMO_MODE=false`, `INTEGRATION_ORGANIZATION_ID` to the CRM organization UUID, and the server-only `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, and a Graph `WHATSAPP_API_VERSION` supported by the Meta app.
2. Connect the business-owned WhatsApp number to Meta Cloud API. Create and get approval for a utility quotation template whose header format is **DOCUMENT** and whose body has exactly three positional variables: customer name, quotation number, quotation total. Set its exact name in `WHATSAPP_QUOTE_TEMPLATE_NAME` and locale in `WHATSAPP_QUOTE_TEMPLATE_LANGUAGE`. The application attaches the generated PDF to that header when the 24-hour service window is closed. Inside the window it sends the PDF as a regular document message. The sender cannot choose a template name in the browser.
3. Create and get approval for a utility text follow-up template with the same three body variables. Set `WHATSAPP_FOLLOWUP_TEMPLATE_NAME`. The follow-up is scheduled for the next calendar day at 10:00 Asia/Kolkata. It is suppressed for a reply, opt-out, missing consent, changed destination, or a quotation that is no longer shared. Follow-up submission requires the authenticated scheduler to call `GET /api/cron/quotation-followups` with `Authorization: Bearer <CRON_SECRET>` during India contact hours. Set a supported schedule at a few-minute interval. No job is blindly retried after an uncertain provider outcome.
4. Configure Meta's WhatsApp messages webhook URL as `https://<CRM-HOST>/api/whatsapp/webhook`, use `WHATSAPP_VERIFY_TOKEN` for verification, and subscribe to message and status notifications. The endpoint checks the raw-body HMAC and phone-number ID. Keep the app secret and token server-only. Record actual customer consent and international phone number on the customer before sending.
5. Pilot with an internal opted-in number: send once with an open service window, once using the approved document template with a closed window, and check the received PDF, status callbacks, inbound reply suppression, opt-out, and follow-up. A Meta API acknowledgement means submitted, not delivered. Investigate unknown or failed attempts in Meta's console before retrying. Do not enable live scheduling until this pilot and template-variable mapping pass.

## Voice

Follow `docs/voice-agent.md`. `VOICE_WEBHOOK_SECRET` protects the mapped outcome contract. A provider relay/tool must supply exactly that schema. `BOLNA_API_KEY`/`BOLNA_AGENT_ID` are reserved configuration; no outbound calling endpoint is exposed and the application does not purchase a number.

## Backups and pilot

Free Supabase does not include automatic backups; arrange encrypted off-site PostgreSQL dumps and separate private-file copies. Protect and rotate backup credentials. Test restore into a separate project, including membership/role rules and issued snapshots. Confirm a named alert owner, usage quotas, failed/unknown jobs and token renewals. Do not rely on free project availability or treat CSV export as a full backup.

Run alongside the owner's existing process for a controlled set of projects. Reconcile real quotations/invoices against accountant-approved reference examples and paper PDFs before making the new system authoritative. Do not recreate historic issued invoices as new current-year invoices. Opening balances need a separately reviewed migration with source evidence.
