-- Persist submitted-by context so MSP secure view can display sender details.

alter table public.partner_escalation_access
  add column if not exists submitted_by_name text null,
  add column if not exists submitted_by_company text null,
  add column if not exists submitted_by_role text null;
