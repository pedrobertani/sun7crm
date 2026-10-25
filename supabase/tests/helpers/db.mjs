import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export async function fixture(t, { storage = false } = {}) {
  const db = new PGlite();
  t.after(() => db.close());
  const q = (sql, args = []) => db.query(sql, args);
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text not null default 'fixture@example.invalid',raw_app_meta_data jsonb not null default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;
 grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  if (storage)
    await db.exec(
      `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`,
    );
  const root = new URL('../../migrations/', import.meta.url);
  for (const file of (await readdir(root)).filter((n) => n.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(file, root), 'utf8'));
  async function as(role, n, run) {
    await q("select set_config('request.jwt.claim.sub',$1,false)", [n ? id(n) : '']);
    await db.exec(`set role ${role}`);
    try {
      return await run();
    } finally {
      await db.exec('reset role');
      await q("select set_config('request.jwt.claim.sub','',false)");
    }
  }
  const user = (n, run) => as('authenticated', n, run);
  for (let n = 1; n <= 8; n++) {
    await q('insert into auth.users(id) values($1)', [id(n)]);
    await q(
      'insert into public.crm_profiles(id,display_name,password_change_required) values($1,$2,$3)',
      [id(n), `Fixture ${n}`, n === 8],
    );
  }
  for (const kind of ['terms', 'privacy']) {
    await q(
      "insert into public.crm_legal_documents(kind,version,body,content_sha256) values($1,'backend-fixture','Documento exclusivamente local de teste','')",
      [kind],
    );
    await q("update public.crm_legal_requirements set version='backend-fixture' where kind=$1", [
      kind,
    ]);
    for (const n of [1, 2, 3, 4, 5, 7])
      await user(n, () =>
        q("insert into public.crm_legal_acceptances(kind,version) values($1,'backend-fixture')", [
          kind,
        ]),
      );
  }
  await q('insert into crm_private.platform_admins(user_id) values($1)', [id(7)]);
  for (const company of [100, 200]) {
    await q(
      "insert into public.crm_companies(id,name,segment,enabled) values($1,'Empresa fixture','Teste',true)",
      [id(company)],
    );
    await q(
      "insert into public.crm_company_billing(company_id,monthly_amount_cents,due_date) values($1,18990,(now() at time zone 'America/Sao_Paulo')::date+30)",
      [id(company)],
    );
  }
  for (const [n, c, role] of [
    [1, 100, 'manager'],
    [2, 100, 'seller'],
    [3, 100, 'reception'],
    [4, 200, 'manager'],
    [5, 100, 'seller'],
    [6, 100, 'manager'],
    [8, 100, 'manager'],
  ])
    await q('insert into public.crm_memberships(id,company_id,user_id,role) values($1,$2,$3,$4)', [
      id(n + 10),
      id(c),
      id(n),
      role,
    ]);
  for (const [contact, c, owner] of [
    [1001, 100, 12],
    [1002, 100, 15],
    [2001, 200, 14],
  ])
    await q(
      "insert into public.crm_contacts(id,company_id,owner_membership_id,name) values($1,$2,$3,'Contato fixture')",
      [id(contact), id(c), id(owner)],
    );
  for (const [board, c] of [
    [3001, 100],
    [4001, 200],
  ]) {
    await q(
      "insert into public.crm_boards(id,company_id,kind,name) values($1,$2,'leads','Funil inicial')",
      [id(board), id(c)],
    );
    for (const [n, name] of [
      [1, 'Primeira'],
      [2, 'Segunda'],
      [3, 'Terceira'],
    ])
      await q(
        'insert into public.crm_stages(id,company_id,board_id,name,position) values($1,$2,$3,$4,$5)',
        [id(board + 100 + n - 1), id(c), id(board), name, n - 1],
      );
  }
  const card = async (actor = 2, values = {}, cardId = null, version = null, company = 100) =>
    (
      await user(actor, () =>
        q('select public.crm_save_card($1,$2,$3,$4) as result', [
          id(company),
          cardId,
          {
            ...(cardId
              ? {}
              : {
                  contact_id: id(1001),
                  board_id: id(3001),
                  stage_id: id(3101),
                  title: 'Oportunidade fixture',
                }),
            ...values,
          },
          version,
        ]),
      )
    ).rows[0].result;
  return { db, q, as, user, card, id };
}
