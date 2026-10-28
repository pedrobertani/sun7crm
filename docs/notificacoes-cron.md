# Job de notificações

O Supabase executa `sun7crm-notifications` a cada 15 minutos (`*/15 * * * *`) pelo `pg_cron`. O comando chama `crm_private.run_notification_job()`, sem JWT, navegador ou Edge Function. A projeção usa os vínculos ativos, empresas habilitadas, primeiro acesso concluído e documentos aceitos de cada destinatário. Avisos operacionais exigem plano válido; cobrança permanece restrita ao gestor, inclusive após bloqueio.

O sininho lê os avisos ao entrar e abrir sua janela, e acompanha as alterações pelo canal privado do próprio usuário. Ao retornar à página ou reconectar, confere novamente os registros. Apenas se o canal estiver indisponível usa uma consulta de segurança a cada 60 segundos com a página visível e online. Não oferece botão Atualizar. Marcar avisos como lidos continua restrito aos próprios registros.

Alterações de contatos, tarefas, cards, vínculos e cobranças reconciliam os destinatários afetados ao final da transação, sem aguardar o cron. A rotina de 15 minutos cobre a passagem do tempo e recupera projeções eventualmente perdidas. O aviso pode aparecer até 15 minutos após atingir um prazo. O worker continua privado; não interfere na confirmação de pagamentos nem na aplicação das regras de acesso, verificadas pelo banco.

## Persistência

- A chave única por destinatário, empresa, tipo e evento evita duplicações.
- A reconciliação mantém ID, data original e `read_at`; não regrava avisos que continuam iguais.
- A passagem de 24 horas para três dias ou sete dias é outro evento. Uma nova atividade vinculada ao card inicia outro ciclo de acompanhamento.
- Cards encerrados, retornos futuros, tarefas concluídas, renovações e acessos revogados retiram avisos que deixaram de se aplicar.
- Um lock transacional impede que duas projeções concorrentes processem o mesmo conjunto ao mesmo tempo.
- O RPC antigo de atualização individual continua autorizado apenas para o próprio usuário, por compatibilidade com abas antigas. Usa a mesma projeção e deduplicação do job.

Os helpers e o job ficam no schema privado, com execução negada a `anon`, `authenticated`, `service_role` e `PUBLIC`. A execução agendada usa o proprietário do banco. A rotina não modifica claims, senhas, aceites, clientes ou pagamentos.

## Implantação e verificação

A migração foi criada pela CLI e inclui a ativação do `pg_cron` quando disponível e o agendamento pelo nome. O nome fixo evita um segundo job ao reaplicar o agendamento. O PostgreSQL/PGlite local não possui a extensão: a suíte testa o processamento e as permissões; a ativação e os disparos do scheduler são conferidos no Supabase.

No SQL Editor administrativo:

```sql
select jobid, jobname, schedule, active
from cron.job where jobname = 'sun7crm-notifications';

select r.status, r.start_time, r.end_time, r.return_message
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname = 'sun7crm-notifications'
order by r.start_time desc limit 10;
```

Monitorar duração e falhas em Integrations > Cron. O histórico de execuções do `pg_cron` cresce com o tempo; a política de retenção técnica deve ser definida conforme o uso. Não há limpeza automática dos avisos nesta entrega.

Gerar registros com o site fechado não equivale a enviar push, e-mail ou WhatsApp. O sininho os apresenta na próxima consulta. A homologação com contas pessoais e a validação final da matriz de permissões continuam separadas.

## Conferência de 25/10/2026

Migração `20261025172331_crm_notification_job` aplicada no Supabase; `pg_cron` 1.6.4 e um único job ativo com o agendamento de minuto. Execuções automáticas às 14h24 e 14h25 (São Paulo) concluíram com status `succeeded`. Helpers e worker tiveram execução negada aos três papéis clientes. A execução manual também terminou sem alterações, pois o ambiente ainda não possui empresas. Nenhum usuário, aceite, cliente ou pagamento de teste foi cadastrado remotamente.

Passaram 146 testes da aplicação e 136 testes de banco, incluindo oito verificações do job sem sessão, deduplicação, leitura preservada, mudança de evento, resolução e isolamento. A conferência de segurança manteve somente os avisos já existentes, documentados em `seguranca.md`. O sininho foi conferido em fixture local, com rede bloqueada e a antiga RPC de geração recusada.



## Ajuste de 28/10/2026

O agendamento atual é `sun7crm-notifications`, com `*/15 * * * *`. A migração `20261028170738_crm_notification_interval` remove o agendamento anterior de minuto e mantém um único job ativo. São 96 execuções diárias, em vez de 1.440. A implantação dos eventos é uma migração separada e deve ser conferida no ambiente antes de considerar os avisos por alteração ativos.
