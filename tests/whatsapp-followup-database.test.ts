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
    "202611170001_whatsapp_followup_dispatch.sql",
  ])
    await db.exec(
      (await readFile(`supabase/migrations/${file}`, "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  await db.exec(`insert into organizations(id,name) values('${org}','Studio');
    insert into whatsapp_messages(organization_id,quotation_id,customer_id,phone_number,status,sent_at)
    values('${org}','q','c','919876543210','sent',now());
    insert into quotation_followups(organization_id,quotation_id,customer_id,scheduled_at)
    values('${org}','q','c',now()-interval '1 hour');`);
}, 30000);
afterAll(async () => { await db?.close(); });

it("claims a due follow-up once, retains one provider attempt and processes callbacks", async () => {
  const claim = () => db.query<{ id: string; claim_token: string; attempts: number }>(
    "select * from claim_quotation_followups($1::uuid,$2::integer)", [org, 3],
  );
  const [first, second] = await Promise.all([claim(), claim()]);
  expect(first.rows.length + second.rows.length).toBe(1);
  const row = (first.rows[0] ?? second.rows[0]);
  expect(row.attempts).toBe(1);
  await db.query(
    `insert into whatsapp_messages(organization_id,quotation_id,customer_id,phone_number,
      status,followup_id,provider_message_id)
      values($1,'q','c','919876543210','sent',$2,'followup-1')`, [org, row.id],
  );
  await expect(db.query(
    `insert into whatsapp_messages(organization_id,quotation_id,customer_id,phone_number,
      status,followup_id) values($1,'q','c','919876543210','pending',$2)`, [org, row.id],
  )).rejects.toThrow(/duplicate/);
  await db.query("select process_whatsapp_event($1,$2,$3,$4::jsonb)", [
    org, "followup-1", "message_status_delivered",
    JSON.stringify({ status: "delivered", at: new Date().toISOString() }),
  ]);
  expect((await db.query<{ status: string }>(
    "select status from whatsapp_messages where provider_message_id='followup-1'",
  )).rows[0].status).toBe("delivered");
  expect((await db.query<{ delivery_status: string }>(
    "select delivery_status from quotation_followups where id=$1", [row.id],
  )).rows[0].delivery_status).toBe("delivered");
});

it("records an unambiguous inbound STOP as opt-out and ignores duplicate replay", async () => {
  await db.exec(`insert into crm_records(organization_id,id,kind,data) values
    ('${org}','c','customer','{"id":"c","kind":"customer","phone":"+91 98765 43210"}'),
    ('${org}','q','quote','{"id":"q","kind":"quote","customerId":"c"}');`);
  const payload = JSON.stringify({
    from: "919876543210", at: "2026-11-17T10:00:00Z", messageType: "text", text: " stop ",
  });
  await db.query("select process_whatsapp_event($1,$2,$3,$4::jsonb)", [org,"stop-1","message_inbound",payload]);
  expect((await db.query<{ opt_in_status: string }>(
    "select opt_in_status from whatsapp_contacts where customer_id='c'",
  )).rows[0].opt_in_status).toBe("opted_out");
  await db.exec("update whatsapp_contacts set opt_in_status='opted_in' where customer_id='c'");
  await db.query("select process_whatsapp_event($1,$2,$3,$4::jsonb)", [org,"stop-1","message_inbound",payload]);
  expect((await db.query<{ opt_in_status: string }>(
    "select opt_in_status from whatsapp_contacts where customer_id='c'",
  )).rows[0].opt_in_status).toBe("opted_in");
});

it("moves expired sending lease to unknown without retry", async () => {
  const claimed = (await db.query<{ id: string }>(
    "select * from quotation_followups where quotation_id='q'",
  )).rows[0];
  await db.query(
    "update quotation_followups set claimed_at=now()-interval '11 minutes' where id=$1",
    [claimed.id],
  );
  expect((await db.query("select * from claim_quotation_followups($1::uuid,$2::integer)", [org, 3])).rows)
    .toHaveLength(0);
  expect((await db.query<{ status: string }>(
    "select status from quotation_followups where id=$1", [claimed.id],
  )).rows[0].status).toBe("unknown");
});

it("rejects a second live follow-up for the same quotation", async () => {
  await expect(db.query(
    "insert into quotation_followups(organization_id,quotation_id,customer_id,scheduled_at) values($1,'q','c',now())",
    [org],
  )).rejects.toThrow(/duplicate/);
});
