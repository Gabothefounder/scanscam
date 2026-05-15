-- Landing-page survey experiments (parking ticket text, future variants).
-- Service-role writes from Next.js only (RLS enabled, no permissive policies).

create table if not exists public.survey_experiment_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  experiment_id text not null,
  page_version text not null,
  checklist_version text not null,
  privacy_note_version text not null,
  concern_note_id text not null,
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_content text not null default '',
  utm_term text not null default '',
  referrer text not null default '',
  page_url text not null default '',
  language text not null default 'en',
  q1_status text not null default '',
  q1_other text not null default '',
  q2_main_concern text not null default '',
  q2_other text not null default '',
  q3_product_discovery text not null default '',
  q4_open_text text not null default '',
  checklist_branch text not null default '',
  copied_checklist boolean not null default false,
  copied_checklist_at timestamptz null,
  checklist_useful text not null default '',
  checklist_missing_feedback text not null default '',
  checklist_feedback_at timestamptz null,
  user_agent text null,
  constraint survey_experiment_responses_session_id_key unique (session_id),
  constraint survey_experiment_responses_checklist_useful_chk
    check (checklist_useful in ('', 'Yes', 'Somewhat', 'No')),
  constraint survey_experiment_responses_q1_other_len
    check (char_length(q1_other) <= 500),
  constraint survey_experiment_responses_q2_other_len
    check (char_length(q2_other) <= 500),
  constraint survey_experiment_responses_q4_open_len
    check (char_length(q4_open_text) <= 500),
  constraint survey_experiment_responses_missing_len
    check (char_length(checklist_missing_feedback) <= 500)
);

create index if not exists survey_experiment_responses_created_at_idx
  on public.survey_experiment_responses (created_at desc);

create index if not exists survey_experiment_responses_experiment_id_idx
  on public.survey_experiment_responses (experiment_id, created_at desc);

alter table public.survey_experiment_responses enable row level security;

create or replace function public.survey_experiment_responses_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists survey_experiment_responses_updated_at on public.survey_experiment_responses;

create trigger survey_experiment_responses_updated_at
before update on public.survey_experiment_responses
for each row
execute function public.survey_experiment_responses_set_updated_at();

-- Founder Control Panel export (sheet-friendly column order).
create or replace view public.ops_survey_experiment_export_v1 as
select
  created_at,
  page_version,
  checklist_version,
  privacy_note_version,
  concern_note_id,
  session_id::text as session_id,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_content,
  utm_term,
  referrer,
  page_url,
  language,
  q1_status,
  q1_other,
  q2_main_concern,
  q2_other,
  q3_product_discovery,
  q4_open_text,
  checklist_branch,
  copied_checklist,
  copied_checklist_at,
  checklist_useful,
  checklist_missing_feedback,
  checklist_feedback_at,
  user_agent,
  experiment_id,
  updated_at
from public.survey_experiment_responses
order by created_at desc;
