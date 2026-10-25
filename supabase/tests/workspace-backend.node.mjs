import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, id } from './helpers/db.mjs';
const denied = (p) => assert.rejects(p, (e) => e.code === '42501');
test('workspace: contatos, tarefas, equipe, identidade e indicadores', async (t) => {
  const { q, user, as, card } = await fixture(t, { storage: true });
  const contact = async (actor, values, contactId = null, version = null) =>
    (
      await user(actor, () =>
        q('select public.crm_save_contact($1,$2,$3,$4) as result', [
          id(100),
          contactId,
          values,
          version,
        ]),
      )
    ).rows[0].result;
  const task = async (actor, values, taskId = null, version = null) =>
    (
      await user(actor, () =>
        q('select public.crm_save_task($1,$2,$3,$4) as result', [id(100), taskId, values, version]),
      )
    ).rows[0].result;
  let created, linkedTask, opportunity;
  await t.test(
    'cria contato normalizado, impede telefone duplicado e alterações sem versão',
    async () => {
      created = await contact(2, {
        name: 'Pessoa fixture',
        phone: '+55 (11) 98877-1234',
        email: 'PESSOA@EXAMPLE.INVALID',
      });
      assert.equal(created.phone, '11988771234');
      assert.equal(created.email, 'pessoa@example.invalid');
      assert.equal(created.owner_membership_id, id(12));
      await assert.rejects(
        contact(2, { name: 'Duplicado', phone: '11988771234' }),
        (e) => e.code === '23505',
      );
      await assert.rejects(
        contact(2, { name: 'Inválido', phone: '123' }),
        (e) => e.code === '22023',
      );
      await denied(contact(3, { name: 'Recepção não cadastra' }));
      await denied(contact(2, { name: 'Outro dono', owner_membership_id: id(15) }));
      created = await contact(2, { notes: 'Registro fixture' }, created.id, created.row_version);
      await assert.rejects(
        contact(2, { name: 'Conflito' }, created.id, 1),
        (e) => e.code === '40001',
      );
      await denied(contact(5, { name: 'Sem acesso' }, created.id, created.row_version));
      await denied(
        user(1, () =>
          q('update public.crm_contacts set owner_membership_id=$1 where id=$2', [
            id(15),
            created.id,
          ]),
        ),
      );
    },
  );
  await t.test(
    'tarefas vinculam card e pessoa, concluem/reabrem com horário do banco',
    async () => {
      opportunity = await card(2, { contact_id: created.id });
      linkedTask = await task(2, {
        title: 'Retornar ao cliente',
        due_date: '2026-12-01',
        opportunity_id: opportunity.id,
      });
      assert.equal(linkedTask.contact_id, created.id);
      assert.equal(linkedTask.opportunity_id, opportunity.id);
      assert.equal(linkedTask.owner_membership_id, id(12));
      linkedTask = await task(2, { status: 'done' }, linkedTask.id, linkedTask.row_version);
      assert.ok(linkedTask.completed_at);
      linkedTask = await task(2, { status: 'todo' }, linkedTask.id, linkedTask.row_version);
      assert.equal(linkedTask.completed_at, null);
      await denied(task(5, { status: 'done' }, linkedTask.id, linkedTask.row_version));
      await assert.rejects(
        task(2, {
          title: 'Pessoa errada',
          due_date: '2026-12-01',
          opportunity_id: opportunity.id,
          contact_id: id(1001),
        }),
        (e) => e.code === '22023',
      );
      await assert.rejects(
        task(1, {
          title: 'Carteira de outro consultor',
          due_date: '2026-12-01',
          contact_id: created.id,
          owner_membership_id: id(15),
        }),
        (e) => e.code === '23514',
      );
    },
  );
  await t.test(
    'indicadores contam só o escopo autorizado e não chamam estimativa de receita',
    async () => {
      const from = (await q("select ((now() at time zone 'America/Sao_Paulo')::date-1)::text as d"))
        .rows[0].d;
      const to = (await q("select ((now() at time zone 'America/Sao_Paulo')::date+1)::text as d"))
        .rows[0].d;
      const own = (
        await user(2, () =>
          q('select public.crm_workspace_metrics($1,$2,$3) as result', [id(100), from, to]),
        )
      ).rows[0].result;
      assert.equal(own.contacts, 2);
      assert.equal(own.open_cards, 1);
      assert.equal(own.pending_tasks, 1);
      assert.ok('estimated_pipeline_cents' in own);
      assert.equal('revenue_cents' in own, false);
      await denied(
        user(4, () => q('select public.crm_workspace_metrics($1,$2,$3)', [id(100), from, to])),
      );
      await assert.rejects(
        user(2, () =>
          q("select public.crm_workspace_metrics($1,'2000-01-01','2030-01-01')", [id(100)]),
        ),
        (e) => e.code === '22023',
      );
    },
  );
  await t.test(
    'gestor vê e-mails da própria equipe; demais perfis não obtêm o cadastro',
    async () => {
      const team = (
        await user(1, () => q('select public.crm_team_members($1) as result', [id(100)]))
      ).rows[0].result;
      assert.ok(team.every((m) => m.email === 'fixture@example.invalid'));
      assert.equal(
        team.some((m) => m.user_id === id(4)),
        false,
      );
      for (const actor of [2, 3, 4, 7])
        await denied(user(actor, () => q('select public.crm_team_members($1)', [id(100)])));
    },
  );
  await t.test(
    'desativação exige destino e redistribui carteira/tarefas sem promover perfis',
    async () => {
      const member = (await q('select * from public.crm_memberships where id=$1', [id(12)]))
        .rows[0];
      const args = [id(100), id(12), { active: false }, null, member.row_version];
      await assert.rejects(
        user(1, () => q('select public.crm_update_team_member($1,$2,$3,$4,$5)', args)),
        (e) => e.code === '23514',
      );
      await assert.rejects(
        user(1, () =>
          q('select public.crm_update_team_member($1,$2,$3,$4,$5)', [
            id(100),
            id(12),
            { role: 'manager' },
            null,
            member.row_version,
          ]),
        ),
        (e) => e.code === '22023',
      );
      await denied(
        user(2, () =>
          q('select public.crm_update_team_member($1,$2,$3,$4,$5)', [
            id(100),
            id(15),
            { active: false },
            id(11),
            1,
          ]),
        ),
      );
      await user(1, () =>
        q('select public.crm_update_team_member($1,$2,$3,$4,$5)', [
          id(100),
          id(12),
          { active: false },
          id(15),
          member.row_version,
        ]),
      );
      assert.equal((await user(2, () => q('select * from public.crm_contacts'))).rows.length, 0);
      assert.equal(
        (
          await user(5, () =>
            q('select owner_membership_id from public.crm_tasks where id=$1', [linkedTask.id]),
          )
        ).rows[0].owner_membership_id,
        id(15),
      );
      assert.equal(
        (await q('select active from public.crm_memberships where id=$1', [id(12)])).rows[0].active,
        false,
      );
      assert.ok(
        (
          await user(5, () =>
            q('select * from public.crm_opportunities where id=$1', [opportunity.id]),
          )
        ).rows.length,
      );
      await denied(
        user(1, () =>
          q('select public.crm_update_team_member($1,$2,$3,$4,$5)', [
            id(100),
            id(11),
            { active: false },
            id(15),
            1,
          ]),
        ),
      );
    },
  );
  await t.test(
    'logo privado só permite arquivos da empresa; identidade não altera cobrança/segmento',
    async () => {
      const ownPath = id(100) + '/fixture.png',
        foreignPath = id(200) + '/fixture.png';
      await user(1, () =>
        q("insert into storage.objects(bucket_id,name) values('crm-company-logos',$1)", [ownPath]),
      );
      await denied(
        user(1, () =>
          q("insert into storage.objects(bucket_id,name) values('crm-company-logos',$1)", [
            foreignPath,
          ]),
        ),
      );
      await denied(
        user(5, () =>
          q("insert into storage.objects(bucket_id,name) values('crm-company-logos',$1)", [
            id(100) + '/vendedor.png',
          ]),
        ),
      );
      assert.equal((await user(4, () => q('select * from storage.objects'))).rows.length, 0);
      const version = (
        await q('select row_version from public.crm_companies where id=$1', [id(100)])
      ).rows[0].row_version;
      const result = (
        await user(1, () =>
          q('select public.crm_update_company_brand($1,$2,$3) as result', [
            id(100),
            { display_name: 'Marca fixture', theme: 'blue', logo_path: ownPath },
            version,
          ]),
        )
      ).rows[0].result;
      assert.equal(result.display_name, 'Marca fixture');
      assert.equal(result.logo_path, ownPath);
      await assert.rejects(
        user(1, () =>
          q('select public.crm_update_company_brand($1,$2,$3)', [
            id(100),
            { logo_path: foreignPath },
            result.row_version,
          ]),
        ),
        (e) => e.code === '22023',
      );
      await assert.rejects(
        user(1, () =>
          q('select public.crm_update_company_brand($1,$2,$3)', [
            id(100),
            { segment: 'Invasão' },
            result.row_version,
          ]),
        ),
        (e) => e.code === '22023',
      );
      await denied(
        user(1, () =>
          q("update public.crm_companies set logo_path='outra/empresa' where id=$1", [id(100)]),
        ),
      );
      const bucket = (await q("select * from storage.buckets where id='crm-company-logos'"))
        .rows[0];
      assert.equal(bucket.public, false);
      assert.equal(bucket.file_size_limit, 2097152);
      assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
    },
  );
  await t.test(
    'identidade compartilhada não é renomeada globalmente; vínculo de outra empresa é preservado',
    async () => {
      await q(
        "insert into public.crm_memberships(id,company_id,user_id,role) values($1,$2,$3,'seller')",
        [id(55), id(200), id(5)],
      );
      const current = (
        await q('select row_version from public.crm_memberships where id=$1', [id(15)])
      ).rows[0].row_version;
      await assert.rejects(
        user(1, () =>
          q('select public.crm_update_team_member($1,$2,$3,$4,$5)', [
            id(100),
            id(15),
            { display_name: 'Nome global indevido' },
            null,
            current,
          ]),
        ),
        (e) => e.code === '23514',
      );
      await user(1, () =>
        q('select public.crm_update_team_member($1,$2,$3,$4,$5)', [
          id(100),
          id(15),
          { active: false },
          id(11),
          current,
        ]),
      );
      assert.equal(
        (await q('select active from public.crm_memberships where id=$1', [id(55)])).rows[0].active,
        true,
      );
      assert.equal(
        (await q('select display_name from public.crm_profiles where id=$1', [id(5)])).rows[0]
          .display_name,
        'Fixture 5',
      );
    },
  );
});
