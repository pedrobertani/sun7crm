import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, id } from './helpers/db.mjs';
test('permissões por funcionário: ações, carteira e delegação', async (t) => {
  const { q, user, db, card } = await fixture(t);
  const company = id(100),
    member = id(12);
  const grant = (keys, scope = 'own', version = 0) =>
    user(1, () =>
      q('select public.crm_set_employee_permissions($1,$2,$3,$4,$5) as value', [
        company,
        member,
        keys,
        scope,
        version,
      ]),
    );
  await t.test(
    'somente gestor configura; outra empresa, autor e gestor raiz protegidos',
    async () => {
      await assert.rejects(
        user(2, () =>
          q('select public.crm_set_employee_permissions($1,$2,$3,$4,0)', [
            company,
            id(15),
            ['contacts.view'],
            'own',
          ]),
        ),
        /CRM_FORBIDDEN/,
      );
      for (const target of [id(11), id(14)])
        await assert.rejects(
          user(1, () =>
            q('select public.crm_set_employee_permissions($1,$2,$3,$4,0)', [
              company,
              target,
              ['contacts.view'],
              'own',
            ]),
          ),
          /CRM_FORBIDDEN/,
        );
      await assert.rejects(grant(['sql.execute']), /CRM_INVALID_PERMISSIONS/);
      await assert.rejects(grant(['contacts.edit']), /CRM_PERMISSION_REQUIRES_VIEW/);
    },
  );
  await t.test(
    'criar sem editar funciona via RPC e SQL direto; carteira própria preservada',
    async () => {
      await grant([
        'contacts.view',
        'contacts.create',
        'cards.view',
        'cards.create',
        'boards.view',
        'history.view',
      ]);
      await user(2, async () => {
        const visible = await q('select id from public.crm_contacts where company_id=$1', [
          company,
        ]);
        assert.deepEqual(
          visible.rows.map((x) => x.id),
          [id(1001)],
        );
        const made = await q('select public.crm_save_contact($1,null,$2,null) as value', [
          company,
          JSON.stringify({ name: 'Teste permissão', phone: '11987654321' }),
        ]);
        assert.equal(made.rows[0].value.name, 'Teste permissão');
        await assert.rejects(
          q('select public.crm_save_contact($1,$2,$3,1)', [
            company,
            id(1001),
            JSON.stringify({ name: 'Alterado' }),
          ]),
          /CRM_FORBIDDEN/,
        );
        assert.equal(
          (
            await q("update public.crm_contacts set name='Negado' where id=$1 returning id", [
              id(1001),
            ])
          ).rows.length,
          0,
        );
        await assert.rejects(
          q('select public.crm_save_card($1,null,$2,null)', [
            company,
            JSON.stringify({ contact_id: id(1002), board_id: id(3001), stage_id: id(3011) }),
          ]),
          /CRM_FORBIDDEN/,
        );
      });
    },
  );
  await t.test('versão impede sobrescrita e revogação vale sem renovar token', async () => {
    await assert.rejects(grant(['contacts.view'], 'own', 0), /CRM_STALE_VERSION/);
    await grant([], 'own', 1);
    await user(2, async () => {
      assert.equal((await q('select id from public.crm_contacts')).rows.length, 0);
      await assert.rejects(
        q('select public.crm_save_contact($1,null,$2,null)', [
          company,
          JSON.stringify({ name: 'Negado' }),
        ]),
        /CRM_FORBIDDEN/,
      );
    });
  });
  await t.test(
    'administrador delegado cria acessos somente dentro de seus próprios direitos',
    async () => {
      await grant(['team.view', 'team.manage', 'contacts.view', 'contacts.create'], 'company', 2);
      await user(2, async () => {
        await q('select public.crm_set_employee_permissions($1,$2,$3,$4,0)', [
          company,
          id(15),
          ['contacts.view'],
          'own',
        ]);
        await assert.rejects(
          q('select public.crm_set_employee_permissions($1,$2,$3,$4,1)', [
            company,
            id(15),
            ['contacts.view', 'contacts.edit'],
            'own',
          ]),
          /CRM_FORBIDDEN/,
        );
        await assert.rejects(
          q('select public.crm_set_employee_permissions($1,$2,$3,$4,0)', [
            company,
            id(14),
            ['contacts.view'],
            'own',
          ]),
          /CRM_FORBIDDEN/,
        );
        await assert.rejects(
          q('select public.crm_set_employee_permissions($1,$2,$3,$4,3)', [
            company,
            member,
            ['team.view', 'team.manage'],
            'own',
          ]),
          /CRM_FORBIDDEN/,
        );
        await assert.rejects(q('select * from crm_private.employee_access'), /permission denied/);
      });
      assert.equal(
        Number((await q('select count(*) as n from crm_private.permission_audit')).rows[0].n),
        4,
      );
    },
  );
  await t.test('empresa inteira e própria são escopos independentes das ações', async () => {
    await grant(['contacts.view'], 'company', 3);
    await user(2, async () => {
      const rows = await q('select id from public.crm_contacts');
      assert(rows.rows.some((x) => x.id === id(1002)));
      assert(!rows.rows.some((x) => x.id === id(2001)));
      await assert.rejects(
        q('select public.crm_save_contact($1,null,\'{"name":"Negado"}\',null)', [company]),
        /CRM_FORBIDDEN/,
      );
    });
  });
  await t.test('etapas validam cada diferença e não usam um check amplo de gestor', async () => {
    await grant(['boards.view', 'stages.edit'], 'own', 4);
    await user(2, async () => {
      const board = (await q('select * from public.crm_boards where id=$1', [id(3001)])).rows[0];
      const stages = (
        await q('select id,name from public.crm_stages where board_id=$1 order by position', [
          id(3001),
        ])
      ).rows;
      await q('select public.crm_configure_board($1,$2,$3,$4,$5)', [
        company,
        id(3001),
        board.name,
        JSON.stringify(stages.map((s, i) => ({ ...s, name: i === 0 ? 'Renomeada' : s.name }))),
        board.row_version,
      ]);
      await assert.rejects(
        q('select public.crm_configure_board($1,$2,$3,$4,$5)', [
          company,
          id(3001),
          'Nome sem permissão',
          JSON.stringify(stages),
          board.row_version + 1,
        ]),
        /CRM_FORBIDDEN/,
      );
      await assert.rejects(
        q('select public.crm_configure_board($1,$2,$3,$4,$5)', [
          company,
          id(3001),
          board.name,
          JSON.stringify(stages.slice(1)),
          board.row_version + 1,
        ]),
        /CRM_FORBIDDEN/,
      );
    });
  });
  await t.test('excluir card exige permissão própria e conserva o histórico', async () => {
    const made = await card(1);
    await user(1, () =>
      q('select public.crm_set_employee_permissions($1,$2,$3,$4,5)', [
        company,
        member,
        ['cards.view', 'cards.delete', 'contacts.view', 'boards.view'],
        'own',
      ]),
    );
    await assert.rejects(
      user(5, () =>
        q('select public.crm_delete_card($1,$2,$3)', [company, made.id, made.row_version]),
      ),
      /CRM_FORBIDDEN/,
    );
    await assert.rejects(
      user(2, () =>
        q('select public.crm_delete_card($1,$2,$3)', [company, made.id, made.row_version + 1]),
      ),
      /CRM_STALE_VERSION/,
    );
    await user(2, () =>
      q('select public.crm_delete_card($1,$2,$3)', [company, made.id, made.row_version]),
    );
    assert.equal(
      (await user(1, () => q('select id from public.crm_opportunities where id=$1', [made.id])))
        .rows.length,
      0,
    );
    assert(
      (await q('select archived_at from public.crm_opportunities where id=$1', [made.id])).rows[0]
        .archived_at,
    );
    assert(
      (
        await q(
          "select id from public.crm_contact_history where opportunity_id=$1 and title='Card excluído'",
          [made.id],
        )
      ).rows.length,
    );
  });
  await t.test(
    'revogar módulo também corta notificações já persistidas e geração posterior',
    async () => {
      await user(1, () =>
        q('select public.crm_set_employee_permissions($1,$2,$3,$4,6)', [
          company,
          member,
          [],
          'own',
        ]),
      );
      await q('select crm_private.run_notification_job()');
      assert.equal(
        (await user(2, () => q('select id from public.crm_notifications where active'))).rows
          .length,
        0,
      );
    },
  );
  await t.test('anon não lê nem grava permissões', async () => {
    await db.exec('set role anon');
    try {
      await assert.rejects(
        q('select public.crm_employee_permissions($1,null)', [company]),
        /permission denied/,
      );
    } finally {
      await db.exec('reset role');
    }
  });
});
