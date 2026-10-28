# Acceptance checklist

Automated verification is reproducible with the commands in README. The following live checks need the actual business accounts, rates and credentials.

## Financial pilot

- Import approved catalog rows; reject invalid units/ambiguous SKUs. Publish a new version and check old shared document totals remain unchanged.
- Reproduce at least 20 actual kitchen quotations, including area versus length, brands, hardware allowances, installation/exclusions, discounts and rounding. Record every variance before using real documents.
- Have the accountant approve actual tax classifications, invoice particulars, place-of-supply and credit/cancellation treatment. The existing tax-review switch does not validate legal correctness.
- Share a specific revision, record customer approval/evidence, then create an invoice draft. Verify generated PDF totals, long terms, Unicode, pagination and absence of internal costs.
- In two sessions issue invoices concurrently: one must retry after a conflict; committed numbers must be unique.
- Record an advance, partial allocation, overpayment, allocation reversal, credit adjustment and refund. Compare the customer statement to the bank/accounting record. Reversed receipts must remain visible.
- Check sales sees authoritative balances without receipt details or margins. Check accounts edits preserve hidden costs. Check installers can update assigned linked work and cannot access other projects/clients.

## Operations

- Customer-approved scope changes preserve the original accepted quotation.
- BOM reviewer enters actual construction quantities; no quote area is presented as material consumption.
- Order supplier items, record two partial goods receipts, and reject over-receipt/duplicate delivery references.
- Complete survey checklist and record sign-off evidence. Approved versions cannot be silently rewritten.
- Create service/snags, attach evidence, and locate actual warranty references without a broad invented guarantee.

## Communications

- Internal Authkey test: exact template variable mapping, provider acknowledgement and console delivery check.
- Settle an invoice before its pending reminder: job is suppressed. Repeat with dispute, hold, opt-out and disabled policy.
- Payment reported but not cleared creates an accounts task/hold; no automatic receipt confirmation.
- Retry worker invocation and replay provider lead events: no duplicate active reminder or source enquiry.
- Simulate timeout after submission: Unknown stays unresolved until owner checks provider evidence. Never auto-fallback to a voice call.
- Verify India quiet hours and cross-invoice contact gaps for one customer.
- Test real Meta lead permissions/token failure and one Justdial CSV import.
- Test voice disclosure, Marathi/Hindi/English, human transfer, unavailable staff, caller opt-out, mixed speech and callback-permission accuracy before routing customer calls.

## Release

- Production demo flag false; public signups off; secrets server-only; privileged MFA enrolled.
- Restore both database and files in another project; verify record and document access with separate accounts.
- Confirm hosting plan eligibility, quotas, alerts, retention owner and incident/rollback procedures.
- Confirm public-site form intake separately, preserving its currently working lead path until the new one is verified.
