-- Supports contact reassignment and the composite contact foreign key without
-- scanning every task in the company.
create index crm_tasks_contact_owner_idx
  on public.crm_tasks(company_id, contact_id, owner_membership_id);
