import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your business, in good order/ }),
  ).toBeVisible();
});
test("dashboard and every module render with no runtime exceptions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [slug, title] of [
    ["leads", "Leads"],
    ["customers", "Customers"],
    ["tasks", "Tasks & follow-ups"],
    ["quotations", "Quotations"],
    ["invoices", "Invoices & payments"],
    ["catalog", "Catalog & rates"],
    ["projects", "Projects"],
    ["surveys", "Site surveys"],
    ["purchases", "Procurement"],
    ["service", "Service & warranty"],
    ["calls", "Calls & voice agent"],
    ["clauses", "Terms library"],
    ["reports", "Reports & insights"],
    ["integrations", "A connected business"],
    ["settings", "Workspace settings"],
  ]) {
    await page.goto(`/${slug}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("lead creation, filtering, workflow update and refresh persistence", async ({
  page,
}) => {
  await page.goto("/leads");
  await page.getByRole("button", { name: "New lead", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name / company").fill("E2E Kitchen Enquiry");
  await dialog.getByLabel("Phone (international format)").fill("+919876543210");
  await dialog.getByLabel("Locality", { exact: true }).fill("Baner");
  await dialog.getByLabel("Lead source").selectOption("Referral");
  await dialog.getByRole("button", { name: "Save record" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Search records").fill("E2E Kitchen");
  await page.getByRole("button", { name: /E2E Kitchen Enquiry/ }).click();
  await page
    .getByRole("button", { name: "Mark Contacted", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("Contacted", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await page.getByLabel("Search records").fill("E2E Kitchen");
  await expect(
    page.getByRole("table").getByText("Contacted", { exact: true }),
  ).toBeVisible();
});
test("quotation calculation, immutable revision, acceptance, invoice and partial payment", async ({
  page,
}) => {
  await page.goto("/quotations");
  await page
    .getByRole("button", { name: "New quotation", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quotation title").fill("E2E Modular Kitchen");
  await dialog
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Ananya Deshmukh" });
  await dialog.getByLabel("Valid until").fill("2027-01-01");
  await dialog.getByLabel("Description line 1").fill("Test base cabinetry");
  await dialog.getByLabel("Method line 1").selectOption("area");
  await dialog.getByLabel("Width (mm) line 1").fill("2400");
  await dialog.getByLabel("Billable height (mm) line 1").fill("750");
  await dialog.getByLabel("Rate (INR) line 1").fill("1000");
  await dialog.getByRole("button", { name: "Save draft" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: /E2E Modular Kitchen/ }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("₹19,375.04", { exact: true }).first(),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Freeze for sharing" }).click();
  await expect(
    dialog.getByRole("button", { name: "Edit", exact: true }),
  ).not.toBeVisible();
  await dialog.getByRole("button", { name: "Mark Accepted" }).click();
  await dialog
    .getByLabel("Acceptance evidence / document reference")
    .fill("Customer approved in E2E test");
  await dialog.getByRole("button", { name: "Confirm action" }).click();
  await dialog.getByRole("button", { name: "Create invoice draft" }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("/invoices");
  await page.getByRole("button", { name: /E2E Modular Kitchen/ }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Issue invoice", exact: true })
    .click();
  await expect(dialog.getByText("Issued", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await dialog.getByLabel("Amount (INR)", { exact: true }).fill("10000");
  await dialog
    .getByLabel("Unique bank / payment reference")
    .fill("E2E-BANK-001");
  await dialog.getByRole("button", { name: "Confirm action" }).click();
  await expect(dialog.getByText("₹9,375.04", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download PDF" }).click();
  const pdf = await download;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await pdf.failure()).toBeNull();
  await pdf.saveAs("test-results/sample-invoice.pdf");
});
test("scope approval and partial supplier deliveries preserve their workflow controls", async ({
  page,
}) => {
  await page.goto("/changes");
  await page
    .getByRole("button", { name: "New change order", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name / title").fill("E2E Extra pantry");
  await dialog
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Ananya Deshmukh" });
  await dialog
    .getByLabel("Project", { exact: true })
    .selectOption({ label: "The Baner residence" });
  await dialog.getByLabel("Additional agreed value (INR)").fill("12500");
  await dialog
    .getByLabel("Notes / specification details")
    .fill("Add a tall pantry unit with customer-selected internals.");
  await dialog.getByRole("button", { name: "Save record" }).click();
  await page.getByRole("button", { name: /E2E Extra pantry/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Mark Approved" }).click();
  await dialog
    .getByLabel("Reason / evidence reference")
    .fill("Customer approved reference TEST-APPROVAL-1");
  await dialog.getByRole("button", { name: "Confirm action" }).click();
  await expect(dialog.getByText("Approved", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Edit", exact: true }),
  ).not.toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/purchases");
  await page
    .getByRole("button", { name: "New purchase order", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name / title").fill("E2E Hardware PO");
  await dialog.getByLabel("Supplier", { exact: true }).fill("Test supplier");
  await dialog.getByRole("button", { name: "Add material item" }).click();
  await dialog.getByLabel("Material description 1").fill("Test hinge pairs");
  await dialog.getByLabel("Material quantity 1").fill("10");
  await dialog.getByLabel("Material unitCost 1").fill("100");
  await dialog.getByRole("button", { name: "Save record" }).click();
  await page.getByRole("button", { name: /E2E Hardware PO/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Mark Ordered" }).click();
  await dialog.getByRole("button", { name: "Record goods receipt" }).click();
  await dialog
    .getByLabel("Goods receipt / delivery reference")
    .fill("TEST-GRN-1");
  await dialog.getByRole("spinbutton", { name: /Test hinge pairs/ }).fill("4");
  await dialog.getByRole("button", { name: "Confirm action" }).click();
  await expect(
    dialog.getByText("Part received", { exact: true }),
  ).toBeVisible();
});
test("unconfigured and demo APIs fail closed and reject cross-origin mutations", async ({
  request,
}) => {
  const first=await request.get('/'),second=await request.get('/');
  expect(first.headers()['content-security-policy']).toContain("'nonce-");
  expect(first.headers()['content-security-policy']).not.toBe(second.headers()['content-security-policy']);
  const forged = await request.post("/api/workspace", {
    headers: { Origin: "https://other.example" },
    data: {
      revision: 0,
      command: { type: "settings", settings: { billingName: "Fake" } },
    },
  });
  expect(forged.status()).toBe(403);
  expect((await request.get("/api/workspace")).status()).toBe(503);
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
  expect(
    (
      await request.get(
        "/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong",
      )
    ).status(),
  ).toBe(403);
  expect(
    (await request.post("/api/webhooks/voice", { data: {} })).status(),
  ).toBe(503);
});
test("CSV validation rejects duplicate headings and imports previewed leads", async ({
  page,
}) => {
  await page.goto("/leads");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("CSV content").fill("name,name\nA,B");
  await dialog.getByRole("button", { name: "Validate & preview" }).click();
  await expect(
    dialog.getByText("CSV needs non-empty, unique column headings."),
  ).toBeVisible();
  await dialog
    .getByLabel("CSV content")
    .fill("name,locality,source\nCSV Client,Baner,Referral");
  await dialog.getByRole("button", { name: "Validate & preview" }).click();
  await expect(
    dialog.getByRole("heading", { name: "1 records ready for review" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Import 1 records" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: /CSV Client/ })).toBeVisible();
});
test("mobile navigation and screenshots have no horizontal overflow", async ({
  page,
}) => {
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Your business, in good order/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Quotations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quotations", exact: true }),
  ).toBeVisible();
});
