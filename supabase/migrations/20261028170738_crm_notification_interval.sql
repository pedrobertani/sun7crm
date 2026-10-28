-- Deadline reconciliation is a safety net, not a screen-refresh mechanism.
begin;
do $scheduler$
declare old_job bigint;
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    for old_job in select jobid from cron.job where jobname='sun7crm-notifications-minute'
    loop
      perform cron.unschedule(old_job);
    end loop;
    perform cron.schedule('sun7crm-notifications','*/15 * * * *',
      'select crm_private.run_notification_job();');
  end if;
end;
$scheduler$;
commit;
