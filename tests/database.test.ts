import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, expect, it } from "vitest";
let db: PGlite;
const org = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  actor = "20000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  // Minimal Supabase-owned schemas in an actual embedded PostgreSQL engine.
  // Supabase auth and storage service behavior itself still needs a live pilot.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  const sql = (
    await readFile("supabase/migrations/202610280001_crm.sql", "utf8")
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(sql);
  await db.exec(
    `insert into auth.users values('${actor}','owner@example.com');insert into public.organizations(id,name) values('${org}','Studio A'),('${other}','Studio B');insert into public.memberships values('${org}','${actor}','owner');insert into public.workspaces(organization_id) values('${org}'),('${other}');`,
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
it("provisions the first owner into an existing empty studio rather than creating a duplicate organization", async () => {
  const ownerId = "20000000-0000-4000-8000-000000000003",
    studioId = "10000000-0000-4000-8000-000000000003";
  await db.exec(
    `insert into auth.users values('${ownerId}','bootstrap@example.com');insert into public.organizations(id,name) values('${studioId}','Hutashana Kitchens');insert into public.workspaces(organization_id) values('${studioId}');`,
  );
  const sql = (await readFile("supabase/bootstrap.sql", "utf8")).replaceAll(
    "owner@example.com",
    "bootstrap@example.com",
  );
  await db.exec(sql);
  expect(
    (
      await db.query(
        "select id from public.organizations where name='Hutashana Kitchens'",
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query<{ organization_id: string }>(
        "select organization_id from public.memberships where user_id=$1",
        [ownerId],
      )
    ).rows[0].organization_id,
  ).toBe(studioId);
});
it("denies browser-token reads and RPC access to private workspace data", async () => {
  await db.exec("set role authenticated");
  try {
    await expect(db.query("select * from public.crm_records")).rejects.toThrow(
      /permission denied/i,
    );
    await expect(
      db.query("select public.read_workspace($1)", [org]),
    ).rejects.toThrow(/permission denied/i);
  } finally {
    await db.exec("reset role");
  }
});
it("reads more than 1000 records atomically without dropping another organization boundary", async () => {
  await db.exec(`insert into public.crm_records(organization_id,id,kind,data) select '${org}', 'customer-'||n,'customer',jsonb_build_object('id','customer-'||n,'kind','customer','name','Client '||n) from generate_series(1,1005) n;
    insert into public.crm_records values('${other}','other-client','customer','{"id":"other-client","kind":"customer","name":"Private client"}',now());`);
  const { rows } = await db.query<{ data: { records: { id: string }[] } }>(
    "select public.read_workspace($1) as data",
    [org],
  );
  expect(rows[0].data.records).toHaveLength(1005);
  expect(rows[0].data.records.some((r) => r.id === "other-client")).toBe(false);
});
it("commits records and audit together and rejects stale concurrent revisions", async () => {
  const record = {
    id: "transaction-task",
    kind: "task",
    name: "Survey",
    status: "Open",
  };
  const args = [
    org,
    actor,
    0,
    {},
    [record],
    [],
    { id: "audit-1", action: "save" },
  ];
  await db.query("select public.commit_workspace($1,$2,$3,$4,$5,$6,$7)", args);
  await expect(
    db.query("select public.commit_workspace($1,$2,$3,$4,$5,$6,$7)", [
      org,
      actor,
      0,
      {},
      [{ ...record, name: "Lost update" }],
      [],
      { id: "audit-2" },
    ]),
  ).rejects.toThrow(/Workspace changed/i);
  const { rows } = await db.query<{ name: string }>(
    "select data->>'name' as name from public.crm_records where organization_id=$1 and id=$2",
    [org, "transaction-task"],
  );
  expect(rows[0].name).toBe("Survey");
  expect(
    (await db.query("select * from public.audit_log where id='audit-2'")).rows,
  ).toHaveLength(0);
});
it("rejects duplicate invoice numbers transactionally without partially committing audit", async () => {
  const invoice = {
    id: "invoice-a",
    kind: "invoice",
    number: "HT/2026-27/0001",
  };
  await expect(
    db.query("select public.commit_workspace($1,$2,$3,$4,$5,$6,$7)", [
      org,
      actor,
      1,
      {},
      [invoice, { ...invoice, id: "invoice-b" }],
      [],
      { id: "audit-duplicate" },
    ]),
  ).rejects.toThrow(/duplicate key/i);
  expect(
    (await db.query("select * from public.crm_records where id='invoice-a'"))
      .rows,
  ).toHaveLength(0);
});
it("retains old unknown dispatches and enforces only one unresolved reminder per invoice", async () => {
  await db.exec(`insert into public.outbox_jobs(id,organization_id,status,due_at,data) values('old-unknown','${org}','Unknown',now(),'{"id":"old-unknown","invoiceId":"i1","status":"Unknown"}');
    insert into public.outbox_jobs(id,organization_id,status,due_at,data,updated_at) select 'sent-'||n,'${org}','Sent',now(),jsonb_build_object('id','sent-'||n,'invoiceId','i'||n,'status','Sent'),now()+interval '1 hour' from generate_series(1,550) n;`);
  const { rows } = await db.query<{ data: { jobs: { id: string }[] } }>(
    "select public.read_workspace($1) as data",
    [org],
  );
  expect(rows[0].data.jobs.some((j) => j.id === "old-unknown")).toBe(true);
  await expect(
    db.exec(
      `insert into public.outbox_jobs(id,organization_id,status,due_at,data) values('duplicate-job','${org}','Pending',now(),'{"id":"duplicate-job","invoiceId":"i1"}')`,
    ),
  ).rejects.toThrow(/duplicate key/i);
});
it("allows only one customer contact reservation within the contact interval", async () => {
  expect(
    (
      await db.query<{ ok: boolean }>(
        "select public.reserve_contact($1,$2,24) as ok",
        [org, "customer-1"],
      )
    ).rows[0].ok,
  ).toBe(true);
  expect(
    (
      await db.query<{ ok: boolean }>(
        "select public.reserve_contact($1,$2,24) as ok",
        [org, "customer-1"],
      )
    ).rows[0].ok,
  ).toBe(false);
});
