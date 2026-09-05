-- Atlas currents v1
-- Privacy-safe projection of historical and future scans into visualizable currents.
-- Raw messages, URLs/domains, contact details, user_context_text and private Journey text are excluded.

create table if not exists public.atlas_scan_signals (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null unique references public.scans(id) on delete cascade,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  lang text null,
  source_type text null,
  risk_tier text not null check (risk_tier in ('low','medium','high')),
  risk_score numeric null,
  scam_family text not null default 'unclassified',
  family_source text not null default 'unclassified'
    check (family_source in ('exact','inferred','unclassified')),
  channel text not null default 'unclassified',
  authority_type text not null default 'unclassified',
  primary_request text not null default 'unclassified',
  payment_intent text not null default 'unclassified',
  payment_method text not null default 'unclassified',
  threat_stage text not null default 'unclassified',
  context_quality text not null default 'unknown',
  tactic_tags text[] not null default '{}'::text[],
  request_tags text[] not null default '{}'::text[],
  emotion_vectors text[] not null default '{}'::text[],
  brand_mentions text[] not null default '{}'::text[],
  artifact_flags jsonb not null default '{}'::jsonb,
  cluster_key text not null,
  backfill_version text not null default 'atlas_v1'
);

comment on table public.atlas_scan_signals is
  'Privacy-safe structured Atlas projection of scans. Does not contain raw messages, free text, contact details, domains, or user context.';

alter table public.atlas_scan_signals enable row level security;
revoke all on table public.atlas_scan_signals from anon, authenticated;
grant select, insert, update, delete on table public.atlas_scan_signals to service_role;

create index if not exists atlas_scan_signals_observed_at_idx on public.atlas_scan_signals (observed_at desc);
create index if not exists atlas_scan_signals_family_idx on public.atlas_scan_signals (scam_family);
create index if not exists atlas_scan_signals_channel_idx on public.atlas_scan_signals (channel);
create index if not exists atlas_scan_signals_request_idx on public.atlas_scan_signals (primary_request);
create index if not exists atlas_scan_signals_cluster_key_idx on public.atlas_scan_signals (cluster_key);
create index if not exists atlas_scan_signals_tactics_gin_idx on public.atlas_scan_signals using gin (tactic_tags);
create index if not exists atlas_scan_signals_requests_gin_idx on public.atlas_scan_signals using gin (request_tags);

create table if not exists public.atlas_clusters (
  id uuid primary key default gen_random_uuid(),
  cluster_key text not null unique,
  scam_family text not null,
  channel text not null,
  primary_request text not null,
  created_at timestamptz not null default now()
);

comment on table public.atlas_clusters is
  'Stable Atlas current identities. Aggregate counts are derived from memberships/signals.';

alter table public.atlas_clusters enable row level security;
revoke all on table public.atlas_clusters from anon, authenticated;
grant select, insert, update, delete on table public.atlas_clusters to service_role;

create table if not exists public.atlas_cluster_members (
  cluster_id uuid not null references public.atlas_clusters(id) on delete cascade,
  atlas_scan_signal_id uuid not null references public.atlas_scan_signals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cluster_id, atlas_scan_signal_id)
);

comment on table public.atlas_cluster_members is
  'Membership edges from privacy-safe scan signals to Atlas currents.';

alter table public.atlas_cluster_members enable row level security;
revoke all on table public.atlas_cluster_members from anon, authenticated;
grant select, insert, update, delete on table public.atlas_cluster_members to service_role;

create index if not exists atlas_cluster_members_signal_idx
  on public.atlas_cluster_members (atlas_scan_signal_id);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to service_role;

create or replace function private.project_scan_to_atlas_v1(p_scan_id uuid)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_signal_id uuid;
  v_cluster_key text;
begin
  with prepared as (
    select
      s.id as scan_id,
      s.created_at as observed_at,
      nullif(lower(coalesce(s.language,'')), '') as lang,
      nullif(lower(coalesce(s.source,'')), '') as source_type,
      s.risk_tier,
      case
        when (s.intel_features->>'risk_score_numeric') ~ '^-?[0-9]+([.][0-9]+)?$'
          then (s.intel_features->>'risk_score_numeric')::numeric
        else null
      end as risk_score,
      coalesce(nullif(s.intel_features->>'narrative_family',''), 'unknown') as narrative_family,
      coalesce(nullif(s.intel_features->>'narrative_category',''), 'unknown') as narrative_category,
      coalesce(nullif(s.intel_features->>'channel_type',''), 'unknown') as channel_type,
      coalesce(nullif(s.intel_features->>'authority_type',''), 'unknown') as authority_type_raw,
      coalesce(nullif(s.intel_features->>'requested_action',''), 'unknown') as requested_action_raw,
      coalesce(nullif(s.intel_features->>'payment_intent',''), 'unknown') as payment_intent_raw,
      coalesce(nullif(s.intel_features->>'payment_method',''), 'unknown') as payment_method_raw,
      coalesce(nullif(s.intel_features->>'threat_stage',''), 'unknown') as threat_stage_raw,
      coalesce(nullif(s.intel_features->>'context_quality',''), 'unknown') as context_quality,
      coalesce(nullif(s.intel_features->>'escalation_pattern',''), 'unknown') as escalation_pattern,
      coalesce(s.intel_features->'emotion_vectors','[]'::jsonb) as emotions_json,
      coalesce(s.intel_features->'brand_mentions','[]'::jsonb) as brands_json,
      coalesce(s.intel_features->'micro_signals','{}'::jsonb) as micro,
      lower(coalesce(s.intel_features->>'credential_request','false')) = 'true' as credential_request,
      lower(coalesce(s.intel_features->>'payment_request','false')) = 'true' as payment_request,
      lower(coalesce(s.intel_features->>'link_present','false')) = 'true' as link_present,
      lower(coalesce(s.intel_features->>'callback_number_present','false')) = 'true' as callback_number_present,
      lower(coalesce(s.intel_features->'link_artifact'->>'is_shortened','false')) = 'true' as is_shortened,
      lower(coalesce(s.intel_features->'link_artifact'->>'has_suspicious_tld','false')) = 'true' as suspicious_tld
    from public.scans s
    where s.id = p_scan_id
  ),
  normalized as (
    select
      p.*,
      case
        when p.narrative_family not in ('unknown','none') then p.narrative_family
        when p.narrative_category not in ('unknown','none') then p.narrative_category
        when coalesce((p.micro->>'delivery_keyword_detected')::boolean,false) then 'delivery_scam'
        when coalesce((p.micro->>'reward_keyword_detected')::boolean,false) then 'reward_claim'
        when coalesce((p.micro->>'account_verification_detected')::boolean,false) then 'account_verification'
        when p.authority_type_raw = 'government'
          and p.requested_action_raw in ('pay_money','click_link','call_number')
          then 'government_impersonation'
        when p.authority_type_raw = 'financial_institution'
          and (p.requested_action_raw in ('submit_credentials','click_link') or p.credential_request)
          then 'financial_phishing'
        else 'unclassified'
      end as scam_family,
      case
        when p.narrative_family not in ('unknown','none')
          or p.narrative_category not in ('unknown','none') then 'exact'
        when coalesce((p.micro->>'delivery_keyword_detected')::boolean,false)
          or coalesce((p.micro->>'reward_keyword_detected')::boolean,false)
          or coalesce((p.micro->>'account_verification_detected')::boolean,false)
          or (p.authority_type_raw = 'government' and p.requested_action_raw in ('pay_money','click_link','call_number'))
          or (p.authority_type_raw = 'financial_institution' and (p.requested_action_raw in ('submit_credentials','click_link') or p.credential_request))
          then 'inferred'
        else 'unclassified'
      end as family_source,
      case when p.channel_type in ('unknown','none','') then 'unclassified' else p.channel_type end as channel,
      case when p.authority_type_raw in ('unknown','none','') then 'unclassified' else p.authority_type_raw end as authority_type,
      case
        when p.requested_action_raw not in ('unknown','none','') then p.requested_action_raw
        when p.credential_request then 'submit_credentials'
        when p.payment_request then 'pay_money'
        else 'unclassified'
      end as primary_request,
      case when p.payment_intent_raw in ('unknown','none','') then 'unclassified' else p.payment_intent_raw end as payment_intent,
      case when p.payment_method_raw in ('unknown','none','') then 'unclassified' else p.payment_method_raw end as payment_method,
      case when p.threat_stage_raw in ('unknown','unclear','none','') then 'unclassified' else p.threat_stage_raw end as threat_stage
    from prepared p
  ),
  arrays as (
    select
      n.*,
      coalesce((
        select array_agg(distinct tag order by tag)
        from (
          select value as tag
          from jsonb_array_elements_text(
            case when jsonb_typeof(n.emotions_json)='array' then n.emotions_json else '[]'::jsonb end
          )
          union all select n.escalation_pattern where n.escalation_pattern not in ('unknown','none','')
          union all select 'urgency' where coalesce((n.micro->>'urgency_detected')::boolean,false)
          union all select 'threat' where coalesce((n.micro->>'threat_detected')::boolean,false)
          union all select 'authority' where coalesce((n.micro->>'authority_keyword_detected')::boolean,false)
          union all select 'financial' where coalesce((n.micro->>'financial_keyword_detected')::boolean,false)
          union all select 'credential_request' where coalesce((n.micro->>'credential_request_detected')::boolean,false)
          union all select 'shortened_link' where coalesce((n.micro->>'link_shortened_detected')::boolean,false)
        ) q
        where tag is not null and tag <> ''
      ), '{}'::text[]) as tactic_tags,
      coalesce((
        select array_agg(distinct tag order by tag)
        from (
          select n.primary_request as tag where n.primary_request <> 'unclassified'
          union all select 'credential_request' where n.credential_request
          union all select 'payment_request' where n.payment_request
        ) q
      ), '{}'::text[]) as request_tags,
      coalesce((
        select array_agg(distinct value order by value)
        from jsonb_array_elements_text(
          case when jsonb_typeof(n.emotions_json)='array' then n.emotions_json else '[]'::jsonb end
        )
      ), '{}'::text[]) as emotion_vectors,
      coalesce((
        select array_agg(distinct lower(value) order by lower(value))
        from jsonb_array_elements_text(
          case when jsonb_typeof(n.brands_json)='array' then n.brands_json else '[]'::jsonb end
        )
      ), '{}'::text[]) as brand_mentions
    from normalized n
  ),
  final as (
    select a.*, concat_ws('|', a.scam_family, a.channel, a.primary_request) as cluster_key
    from arrays a
  )
  insert into public.atlas_scan_signals (
    scan_id, observed_at, lang, source_type, risk_tier, risk_score,
    scam_family, family_source, channel, authority_type, primary_request,
    payment_intent, payment_method, threat_stage, context_quality,
    tactic_tags, request_tags, emotion_vectors, brand_mentions,
    artifact_flags, cluster_key, backfill_version
  )
  select
    f.scan_id, f.observed_at, f.lang, f.source_type, f.risk_tier, f.risk_score,
    f.scam_family, f.family_source, f.channel, f.authority_type, f.primary_request,
    f.payment_intent, f.payment_method, f.threat_stage, f.context_quality,
    f.tactic_tags, f.request_tags, f.emotion_vectors, f.brand_mentions,
    jsonb_build_object(
      'link_present', f.link_present,
      'callback_number_present', f.callback_number_present,
      'shortened_link', f.is_shortened,
      'suspicious_tld', f.suspicious_tld,
      'credential_request', f.credential_request,
      'payment_request', f.payment_request
    ),
    f.cluster_key,
    'atlas_v1'
  from final f
  on conflict (scan_id) do update set
    observed_at=excluded.observed_at,
    lang=excluded.lang,
    source_type=excluded.source_type,
    risk_tier=excluded.risk_tier,
    risk_score=excluded.risk_score,
    scam_family=excluded.scam_family,
    family_source=excluded.family_source,
    channel=excluded.channel,
    authority_type=excluded.authority_type,
    primary_request=excluded.primary_request,
    payment_intent=excluded.payment_intent,
    payment_method=excluded.payment_method,
    threat_stage=excluded.threat_stage,
    context_quality=excluded.context_quality,
    tactic_tags=excluded.tactic_tags,
    request_tags=excluded.request_tags,
    emotion_vectors=excluded.emotion_vectors,
    brand_mentions=excluded.brand_mentions,
    artifact_flags=excluded.artifact_flags,
    cluster_key=excluded.cluster_key,
    backfill_version=excluded.backfill_version
  returning id, cluster_key into v_signal_id, v_cluster_key;

  if v_signal_id is null then return; end if;

  insert into public.atlas_clusters (cluster_key, scam_family, channel, primary_request)
  select cluster_key, scam_family, channel, primary_request
  from public.atlas_scan_signals
  where id = v_signal_id
  on conflict (cluster_key) do update set
    scam_family=excluded.scam_family,
    channel=excluded.channel,
    primary_request=excluded.primary_request;

  delete from public.atlas_cluster_members where atlas_scan_signal_id = v_signal_id;

  insert into public.atlas_cluster_members (cluster_id, atlas_scan_signal_id)
  select c.id, v_signal_id
  from public.atlas_clusters c
  where c.cluster_key = v_cluster_key
  on conflict do nothing;
end;
$$;

revoke all on function private.project_scan_to_atlas_v1(uuid) from public, anon, authenticated;
grant execute on function private.project_scan_to_atlas_v1(uuid) to service_role;

create or replace function private.atlas_scan_sync_trigger_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  perform private.project_scan_to_atlas_v1(new.id);
  return new;
end;
$$;

revoke all on function private.atlas_scan_sync_trigger_v1() from public, anon, authenticated;
grant execute on function private.atlas_scan_sync_trigger_v1() to service_role;

drop trigger if exists scans_atlas_sync_v1 on public.scans;
create trigger scans_atlas_sync_v1
after insert or update of intel_features, risk_tier, language, source
on public.scans
for each row
execute function private.atlas_scan_sync_trigger_v1();

-- Idempotent historical backfill.
do $$
declare
  r record;
begin
  for r in select id from public.scans loop
    perform private.project_scan_to_atlas_v1(r.id);
  end loop;
end;
$$;

create or replace view public.atlas_current_summary
with (security_invoker = true)
as
select
  c.id,
  c.cluster_key,
  c.scam_family,
  c.channel,
  c.primary_request,
  count(s.id)::bigint as signal_count,
  count(s.id) filter (where s.risk_tier='high')::bigint as high_risk_count,
  count(s.id) filter (where s.observed_at >= now() - interval '30 days')::bigint as recent_30d_count,
  min(s.observed_at) as first_seen,
  max(s.observed_at) as last_seen,
  count(ac.id)::bigint as light_count
from public.atlas_clusters c
join public.atlas_cluster_members m on m.cluster_id=c.id
join public.atlas_scan_signals s on s.id=m.atlas_scan_signal_id
left join public.atlas_contributions ac on ac.scan_id=s.scan_id
group by c.id, c.cluster_key, c.scam_family, c.channel, c.primary_request;

revoke all on public.atlas_current_summary from anon, authenticated;
grant select on public.atlas_current_summary to service_role;

create or replace view public.atlas_tactic_summary
with (security_invoker = true)
as
select
  t.tag as tactic,
  count(*)::bigint as signal_count,
  count(*) filter (where s.risk_tier='high')::bigint as high_risk_count,
  max(s.observed_at) as last_seen
from public.atlas_scan_signals s
cross join lateral unnest(s.tactic_tags) as t(tag)
group by t.tag;

revoke all on public.atlas_tactic_summary from anon, authenticated;
grant select on public.atlas_tactic_summary to service_role;

create or replace view public.atlas_family_summary
with (security_invoker = true)
as
select
  scam_family,
  count(*)::bigint as signal_count,
  count(*) filter (where family_source='exact')::bigint as exact_count,
  count(*) filter (where family_source='inferred')::bigint as inferred_count,
  count(*) filter (where risk_tier='high')::bigint as high_risk_count,
  max(observed_at) as last_seen
from public.atlas_scan_signals
group by scam_family;

revoke all on public.atlas_family_summary from anon, authenticated;
grant select on public.atlas_family_summary to service_role;
