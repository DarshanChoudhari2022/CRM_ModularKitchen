import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, expect, it } from "vitest";
let db: PGlite;
const org = "10000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as 'select null::uuid';
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  for (const file of [
    "202610280001_crm.sql",
    "202611050001_whatsapp_quotation_automation.sql",
    "202611160001_whatsapp_webhook_processing.sql",
  ])
    await db.exec(
      (await readFile(`supabase/migrations/${file}`, "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  await db.exec(`insert into organizations(id,name) values('${org}','Studio');
    insert into crm_records(organization_id,id,kind,data) values
    ('${org}','c','customer','{"id":"c","kind":"customer","phone":"+91 (98765) 43210"}'),
    ('${org}','q','quote','{"id":"q","kind":"quote","customerId":"c","updatedAt":"2026-11-01"}');`);
}, 30000);
afterAll(async () => {
  await db?.close();
});
const event = (id: string, type: string, payload: object) =>
  db.query("select process_whatsapp_event($1,$2,$3,$4::jsonb)", [
    org,
    id,
    type,
    JSON.stringify(payload),
  ]);
it("records inbound exactly once, normalizes phone and opens window without granting consent", async () => {
  const body = {
    from: "919876543210",
    at: "2026-11-01T10:00:00Z",
    messageType: "text",
  };
  await event("in-1", "message_inbound", body);
  await event("in-1", "message_inbound", body);
  const contact = (
    await db.query<{ opt_in_status: string; service_window_expires_at: Date }>(
      "select * from whatsapp_contacts",
    )
  ).rows[0];
  expect(contact.opt_in_status).toBe("unknown");
  expect(contact.service_window_expires_at.toISOString()).toBe(
    "2026-11-02T10:00:00.000Z",
  );
  expect(
    (
      await db.query(
        "select * from whatsapp_messages where provider_message_id='in-1'",
      )
    ).rows,
  ).toHaveLength(1);
  await event("in-old", "message_inbound", {
    ...body,
    at: "2026-10-01T10:00:00Z",
  });
  expect(
    (
      await db.query<{ service_window_expires_at: Date }>(
        "select service_window_expires_at from whatsapp_contacts",
      )
    ).rows[0].service_window_expires_at.toISOString(),
  ).toBe("2026-11-02T10:00:00.000Z");
});
it("rolls back unknown status events so callbacks can retry, and preserves monotonic delivery", async () => {
  await expect(
    event("out-1", "message_status_read", {
      status: "read",
      at: "2026-11-01T10:00:00Z",
    }),
  ).rejects.toThrow();
  expect(
    (
      await db.query(
        "select * from webhook_events where provider_event_id='out-1'",
      )
    ).rows,
  ).toHaveLength(0);
  await db.exec(
    `insert into whatsapp_messages(organization_id,quotation_id,customer_id,phone_number,provider_message_id) values('${org}','q','c','919876543210','out-1')`,
  );
  await event("out-1", "message_status_read", {
    status: "read",
    at: "2026-11-01T10:00:00Z",
  });
  await event("out-1", "message_status_delivered", {
    status: "delivered",
    at: "2026-11-01T09:59:00Z",
  });
  const message = (
    await db.query<{ status: string; read_at: Date; delivered_at: Date }>(
      "select * from whatsapp_messages where provider_message_id='out-1'",
    )
  ).rows[0];
  expect(message.status).toBe("read");
  expect(message.read_at.toISOString()).toBe("2026-11-01T10:00:00.000Z");
  expect(message.delivered_at.toISOString()).toBe("2026-11-01T09:59:00.000Z");
  await expect(
    db.exec(
      `insert into whatsapp_messages(organization_id,quotation_id,customer_id,phone_number) values('${org}','q','c','919876543210')`,
    ),
  ).rejects.toThrow(/duplicate/);
});
it("denies browser execution of callback RPC", async () => {
  await db.exec("set role authenticated");
  try {
    await expect(event("bad", "message_inbound", {})).rejects.toThrow(
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
});
it("replaces stale phone windows without carrying opt-in to a new number", async () => {
  await db.exec(
    `update whatsapp_contacts set phone_number='919111111111',opt_in_status='opted_in',service_window_expires_at='2027-01-01' where customer_id='c'`,
  );
  await event("in-new-phone", "message_inbound", {
    from: "919876543210",
    at: "2026-11-03T10:00:00Z",
    messageType: "text",
  });
  const contact = (
    await db.query<{
      phone_number: string;
      opt_in_status: string;
      service_window_expires_at: Date;
    }>("select * from whatsapp_contacts where customer_id='c'")
  ).rows[0];
  expect(contact.phone_number).toBe("919876543210");
  expect(contact.opt_in_status).toBe("unknown");
  expect(contact.service_window_expires_at.toISOString()).toBe(
    "2026-11-04T10:00:00.000Z",
  );
});
