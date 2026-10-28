# Supabase connection — 28 October 2026

Project: `dmcqlogemfyqkmcknkle`.

The user-supplied URL, publishable key and server-only service-role key are saved in the git-ignored `.env.local`. The redundant legacy anon JWT is not needed by the application. Demo mode is disabled. Keys are not copied into this document or source control.

The initial migration was applied through the authenticated Supabase dashboard as a transaction. It was applied manually, not through `supabase db push`; do not blindly replay the initial migration against this database. The repository migration remains the source for clean environments.

## Created and verified

- Tables: organizations, memberships, workspaces, crm_records, audit_log, outbox_jobs, integration_events, contact_dispatches.
- Functions: commit_workspace, read_workspace, claim_reminders, reserve_contact.
- Unique constraints/indexes for invoices, receipts, SKU versions, source events and active reminders.
- RLS enabled and browser business-table access revoked by the applied migration; authenticated membership self-read is the one intentional client policy.
- `crm-private` storage bucket is private, with the migration's file-size/type restrictions.
- Empty organization: Hutashana Kitchens.
- Organization/workspace ID: `dd2ec210-6a6c-443c-9f28-c977ff5f32f2`.
- Workspace RPC read returned revision 0 and zero business records.
- All eight tables responded successfully with the server key.
- The publishable key was verified against the Auth settings API. Anonymous reads of all eight tables and the privileged workspace RPC were denied; the business-record denial is PostgreSQL code 42501.
- The rebuilt local application returns HTTP 401 “Sign in to continue,” rather than a configuration error or demo data.
- Client bundle scan found no service-role key in the 18 generated static files.

## Remaining account setup

There were no Auth users when checked. The owner email is requested so the first account can be provisioned and linked. `supabase/bootstrap.sql` now reuses the existing studio/workspace rather than creating duplicates. Do not run its placeholder email unchanged.

Supabase's public Auth signup is currently enabled. CRM access still requires a server-verified staff membership, so signing up alone grants no CRM data access. Disable public signup in Supabase Auth before the invite-only staff pilot. No Auth settings, passwords, API keys or account permissions were changed through the dashboard in this task.

No demonstration customers, rates, invoices, telephone calls or outbound messages were added to the live database. Authkey, Meta, voice, scheduling, backups and a hosted Vercel deployment remain separate setup steps.
