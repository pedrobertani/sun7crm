import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../migrations/', import.meta.url);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('histórico e relatórios: autoria, imutabilidade e isolamento por empresa', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const q = (sql, args = []) => db.query(sql, args);
  async function as(role, user, run) {
    await q("select set_config('request.jwt.claim.sub',$1,false)", [user ? id(user) : '']);
    await db.exec(`set role ${role}`);
    try {
      return await run();
    } finally {
      await db.exec('reset role');
      await q("select set_config('request.jwt.claim.sub','',false)");
    }
  }
  const user = (n, run) => as('authenticated', n, run);
  const denied = (promise) => assert.rejects(promise, (error) => error.code === '42501');
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,raw_app_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of (await readdir(root)).filter((name) => name.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(file, root), 'utf8'));
  for (let n = 1; n <= 7; n++) {
    await q('insert into auth.users(id) values($1)', [id(n)]);
    await q(
      'insert into public.crm_profiles(id,display_name,password_change_required) values($1,$2,$3)',
      [id(n), `Pessoa fictícia ${n}`, n === 6],
    );
  }
  for (const n of [100, 200]) {
    await q(
      "insert into public.crm_companies(id,name,segment,enabled) values($1,'Empresa fictícia','Teste',true)",
      [id(n)],
    );
    await q(
      "insert into public.crm_company_billing(company_id,monthly_amount_cents,due_date) values($1,999999,((now() at time zone 'America/Sao_Paulo')::date)+7)",
      [id(n)],
    );
  }
  for (const [n, company, role] of [
    [1, 100, 'manager'],
    [2, 100, 'seller'],
    [3, 100, 'reception'],
    [4, 200, 'manager'],
    [5, 100, 'seller'],
    [6, 100, 'manager'],
  ]) {
    await q('insert into public.crm_memberships(id,company_id,user_id,role) values($1,$2,$3,$4)', [
      id(n + 10),
      id(company),
      id(n),
      role,
    ]);
  }
  for (const kind of ['terms', 'privacy']) {
    await q(
      "insert into public.crm_legal_documents(kind,version,body,content_sha256) values($1,'local-fixture','Fixture local; não publicar','')",
      [kind],
    );
    // A migração de homologação já configura a versão exigida. A fixture local
    // ativa uma versão própria sem alterar documentos imutáveis de homologação.
    await q(
      "insert into public.crm_legal_requirements(kind,version) values($1,'local-fixture') on conflict (kind) do update set version=excluded.version",
      [kind],
    );
    for (const n of [1, 2, 3, 4, 5, 7])
      await user(n, () =>
        q("insert into public.crm_legal_acceptances(kind,version) values($1,'local-fixture')", [
          kind,
        ]),
      );
  }
  await q('insert into crm_private.platform_admins(user_id) values($1)', [id(7)]);

  for (const [contact, company, owner, userId] of [
    [1001, 100, 12, 1],
    [1002, 100, 15, 1],
    [2001, 200, 14, 4],
  ]) {
    await q(
      "insert into public.crm_contacts(id,company_id,owner_membership_id,name,phone) values($1,$2,$3,'Contato fictício',$4)",
      [
        id(contact),
        id(company),
        id(owner),
        contact === 1001 ? '11988771234' : contact === 1002 ? '11988771235' : '11988771236',
      ],
    );
  }
  await t.test('histórico só acompanha os contatos permitidos; sem acesso anônimo', async () => {
    assert.equal(
      (await user(1, () => q('select * from public.crm_contact_history'))).rows.length,
      2,
    );
    assert.equal(
      (await user(2, () => q('select * from public.crm_contact_history'))).rows.length,
      1,
    );
    assert.equal(
      (
        await user(2, () =>
          q('select * from public.crm_contact_history where contact_id=$1', [id(1002)]),
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await user(4, () => q('select * from public.crm_contact_history'))).rows.length,
      1,
    );
    await denied(as('anon', null, () => q('select * from public.crm_contact_history')));
  });
  await t.test('banco atribui notas ao autor real, ignora data e título forjados', async () => {
    await user(2, () =>
      q(
        "insert into public.crm_contact_history(company_id,contact_id,kind,title,body,actor_user_id,actor_name,occurred_at,opportunity_id) values($1,$2,'note','Falso','  Acompanhar retorno  ',$3,'Outro autor','2000-01-01',$4)",
        [id(100), id(1001), id(1), null],
      ),
    );
    const note = (
      await user(1, () => q("select * from public.crm_contact_history where kind='note'"))
    ).rows[0];
    assert.equal(note.actor_user_id, id(2));
    assert.equal(note.actor_name, 'Pessoa fictícia 2');
    assert.equal(note.body, 'Acompanhar retorno');
    assert.equal(note.title, 'Anotação de atendimento');
    assert.equal(note.opportunity_id, null);
    assert.ok(new Date(note.occurred_at) > new Date('2020-01-01'));
  });
  await t.test(
    'não permite forjar evento automático, alterar/apagar histórico ou anotar cliente de outro',
    async () => {
      await denied(
        user(2, () =>
          q(
            "insert into public.crm_contact_history(company_id,contact_id,kind,title) values($1,$2,'card_moved','Forjado')",
            [id(100), id(1001)],
          ),
        ),
      );
      await denied(
        user(2, () =>
          q(
            "insert into public.crm_contact_history(company_id,contact_id,kind,title,body) values($1,$2,'note','Nota','Texto')",
            [id(100), id(1002)],
          ),
        ),
      );
      await denied(user(2, () => q("update public.crm_contact_history set body='Forjado'")));
      await denied(user(1, () => q('delete from public.crm_contact_history')));
      await denied(user(1, () => q('select crm_private.log_contact_history()')));
      await denied(
        user(3, () =>
          q(
            "insert into public.crm_contact_history(company_id,contact_id,kind,title,body) values($1,$2,'note','Nota','Texto')",
            [id(100), id(1001)],
          ),
        ),
      );
    },
  );
  await t.test('WhatsApp registra somente acionamento, com autor e texto confiáveis', async () => {
    await user(2, () =>
      q(
        "insert into public.crm_contact_history(company_id,contact_id,kind,title,body,actor_user_id) values($1,$2,'whatsapp_opened','Mensagem enviada','Mensagem recebida',$3)",
        [id(100), id(1001), id(1)],
      ),
    );
    const event = (
      await user(1, () =>
        q("select * from public.crm_contact_history where kind='whatsapp_opened'"),
      )
    ).rows[0];
    assert.equal(event.actor_user_id, id(2));
    assert.equal(event.title, 'WhatsApp acionado');
    assert.match(event.body, /não são confirmados/);
    await user(3, () =>
      q(
        "insert into public.crm_contact_history(company_id,contact_id,kind,title) values($1,$2,'whatsapp_opened','WhatsApp')",
        [id(100), id(1001)],
      ),
    );
  });
  let opportunityId;
  await t.test(
    'movimentações são gravadas atomicamente e preservam nome da etapa anterior',
    async () => {
      await q(
        "insert into public.crm_boards(id,company_id,kind,name) values($1,$2,'leads','Funil teste')",
        [id(3001), id(100)],
      );
      for (const [stage, position, name] of [
        [3101, 0, 'Primeira'],
        [3102, 1, 'Segunda'],
      ])
        await q(
          'insert into public.crm_stages(id,company_id,board_id,name,position) values($1,$2,$3,$4,$5)',
          [id(stage), id(100), id(3001), name, position],
        );
      opportunityId = (
        await user(2, () =>
          q('select public.crm_save_card($1,null,$2,null) as result', [
            id(100),
            { contact_id: id(1001), board_id: id(3001), stage_id: id(3101) },
          ]),
        )
      ).rows[0].result.id;
      await user(2, () =>
        q(
          'select public.crm_save_card($1,$2,$3,(select row_version from public.crm_opportunities where id=$2))',
          [id(100), opportunityId, { stage_id: id(3102) }],
        ),
      );
      const event = (
        await user(1, () => q("select * from public.crm_contact_history where kind='card_moved'"))
      ).rows[0];
      assert.match(event.body, /Primeira → Funil teste \/ Segunda/);
      const count = (
        await user(1, () => q('select count(*)::int as n from public.crm_contact_history'))
      ).rows[0].n;
      await user(2, () =>
        q(
          'select public.crm_save_card($1,$2,$3,(select row_version from public.crm_opportunities where id=$2))',
          [id(100), opportunityId, { stage_id: id(3102) }],
        ),
      );
      assert.equal(
        (await user(1, () => q('select count(*)::int as n from public.crm_contact_history')))
          .rows[0].n,
        count,
      );
    },
  );
  await t.test(
    'relatórios são exclusivos do gestor, por empresa, e atribuem a ação a quem fez',
    async () => {
      const report = (
        await user(1, () =>
          q('select * from public.crm_contact_activity_report where contact_id=$1', [id(1001)]),
        )
      ).rows[0];
      assert.equal(report.whatsapp_count, 2);
      assert.equal(report.movement_count, 1);
      assert.equal(report.note_count, 1);
      assert.equal(report.owner_membership_id, id(12));
      assert.equal(
        (await user(2, () => q('select * from public.crm_contact_activity_report'))).rows.length,
        0,
      );
      assert.equal(
        (await user(3, () => q('select * from public.crm_team_activity_report'))).rows.length,
        0,
      );
      assert.equal(
        (await user(4, () => q('select * from public.crm_contact_activity_report'))).rows.length,
        1,
      );
      const actor = (
        await user(1, () =>
          q('select * from public.crm_team_activity_report where actor_id=$1', [id(2)]),
        )
      ).rows[0];
      assert.equal(actor.whatsapp_count, 1);
      assert.equal(actor.movement_count, 1);
      assert.equal(actor.note_count, 1);
    },
  );
  await t.test('reatribuição e bloqueio cortam o acesso ao histórico imediatamente', async () => {
    await user(1, () =>
      q(
        'select public.crm_save_contact($1,$2,$3,(select row_version from public.crm_contacts where id=$2))',
        [id(100), id(1001), { owner_membership_id: id(15) }],
      ),
    );
    assert.equal(
      (await user(2, () => q('select * from public.crm_contact_history'))).rows.length,
      0,
    );
    assert.ok((await user(5, () => q('select * from public.crm_contact_history'))).rows.length > 0);
    await q('update public.crm_memberships set active=false where id=$1', [id(15)]);
    assert.equal(
      (await user(5, () => q('select * from public.crm_contact_history'))).rows.length,
      0,
    );
  });
});
