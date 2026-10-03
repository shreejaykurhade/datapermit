create table if not exists public.auth_challenges (
 nonce text primary key, address text not null, message text not null, expires_at timestamptz not null
);
create table if not exists public.datasets (
 id text primary key, title text not null, description text not null, category text not null,
 language text not null, publisher text not null, price numeric(18,6) not null check(price>0),
 duration_days integer not null check(duration_days between 1 and 365), quota integer not null check(quota>0),
 version text not null, terms text not null, digest text not null, records jsonb not null,
 sample jsonb not null, record_count integer not null, created_at timestamptz not null default now()
);
create table if not exists public.permits (
 id text primary key, dataset_id text not null references public.datasets(id), title text not null,
 owner text not null, expires_at timestamptz not null, quota integer not null check(quota>0),
 used integer not null default 0, revoked boolean not null default false,
 token_hash text not null unique, tx_hash text not null unique, created_at timestamptz not null default now()
);
create table if not exists public.access_receipts (
 id bigint generated always as identity primary key, permit_id text not null references public.permits(id),
 used integer not null, created_at timestamptz not null default now()
);
alter table public.auth_challenges enable row level security;
alter table public.datasets enable row level security;
alter table public.permits enable row level security;
alter table public.access_receipts enable row level security;
-- All access is server-side through the service role; no public policies expose records or tokens.
create or replace function public.consume_permit(p_token_hash text)
returns table(used integer, quota integer)
language plpgsql security definer set search_path = public as $$
declare p public.permits;
begin
 update public.permits set used=public.permits.used+1
 where token_hash=p_token_hash and revoked=false and expires_at>now() and public.permits.used<public.permits.quota and provisioning_status='ready'
 returning * into p;
 if not found then raise exception 'Access denied'; end if;
 insert into public.access_receipts(permit_id,used) values(p.id,p.used);
 return query select p.used,p.quota;
end; $$;
revoke all on function public.consume_permit(text) from public, anon, authenticated;
grant execute on function public.consume_permit(text) to service_role;

create table if not exists public.rate_limits (
 key text primary key, window_start timestamptz not null, requests integer not null
);
alter table public.rate_limits enable row level security;
create or replace function public.consume_rate_limit(p_key text,p_limit integer)
returns void language plpgsql security definer set search_path=public as $$
declare current_count integer;
begin
 insert into public.rate_limits(key,window_start,requests) values(p_key,date_trunc('minute',now()),1)
 on conflict(key) do update set
 requests=case when public.rate_limits.window_start=date_trunc('minute',now()) then public.rate_limits.requests+1 else 1 end,
 window_start=date_trunc('minute',now())
 returning requests into current_count;
 if current_count>p_limit then raise exception 'Rate limit'; end if;
end; $$;
revoke all on function public.consume_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer) to service_role;

alter table public.datasets add column if not exists encrypted_data jsonb;
alter table public.datasets add column if not exists gateway_envelope jsonb;
alter table public.permits add column if not exists provisioning_status text not null default 'ready' check(provisioning_status in ('pending','ready'));
create table if not exists public.workflow_results (
 id text primary key, permit_id text not null unique references public.permits(id),
 tx_hash text not null, workflow text not null, verified_block text not null,
 created_at timestamptz not null default now()
);
alter table public.workflow_results enable row level security;
create or replace function public.provision_permit(p_id text,p_tx text,p_block text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.permits where id=p_id and tx_hash=p_tx and revoked=false and expires_at>now()) then raise exception 'Invalid permit'; end if;
 insert into public.workflow_results(id,permit_id,tx_hash,workflow,verified_block)
 values('cre-'||p_id,p_id,p_tx,'Chainlink CRE',p_block) on conflict(permit_id) do nothing;
 update public.permits set provisioning_status='ready' where id=p_id;
end; $$;
revoke all on function public.provision_permit(text,text,text) from public,anon,authenticated;
grant execute on function public.provision_permit(text,text,text) to service_role;
alter table public.datasets add column if not exists family_id text;
alter table public.datasets add column if not exists revenue_shares jsonb not null default '[]';
create unique index if not exists dataset_family_versions on public.datasets(family_id,version) where family_id is not null;
create table if not exists public.campaigns(id text primary key,title text not null,brief text not null,company text not null,verifiers text[] not null,questions jsonb not null,status text not null default 'open' check(status in ('open','closed')),created_at timestamptz not null default now());
create table if not exists public.contributions(id text primary key,campaign_id text not null references public.campaigns(id),participant text not null,answers jsonb not null,signature text not null,created_at timestamptz not null default now(),unique(campaign_id,participant));
create table if not exists public.question_clusters(id text primary key,campaign_id text not null references public.campaigns(id),question_id text not null,content_hash text not null,title text not null,summary text not null,language text not null,members jsonb not null,provider text not null,model text not null,created_at timestamptz not null default now());
create table if not exists public.expert_reviews(id text primary key,campaign_id text not null references public.campaigns(id),cluster_id text not null unique references public.question_clusters(id),verifier text not null,decision text not null check(decision in ('accepted','rejected')),notes text not null,signature text not null,created_at timestamptz not null default now());
alter table public.campaigns enable row level security;
alter table public.contributions enable row level security;
alter table public.question_clusters enable row level security;
alter table public.expert_reviews enable row level security;
create or replace function public.submit_contribution(p_id text,p_campaign text,p_participant text,p_answers jsonb,p_signature text)
returns void language plpgsql security definer set search_path=public as $$
declare c public.campaigns;
begin
 select * into c from public.campaigns where id=p_campaign for update;
 if not found or c.status<>'open' then raise exception 'Campaign is closed';end if;
 if c.company=p_participant or p_participant=any(c.verifiers) then raise exception 'Company and verifiers cannot contribute';end if;
 if (select count(*) from public.contributions where campaign_id=p_campaign)>=20 then raise exception 'Campaign participant limit reached';end if;
 if jsonb_array_length(p_answers)<>50 then raise exception 'All 50 answers required';end if;
 insert into public.contributions(id,campaign_id,participant,answers,signature) values(p_id,p_campaign,p_participant,p_answers,p_signature);
end;$$;
create or replace function public.close_campaign(p_id text,p_company text)
returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.campaigns where id=p_id and company=p_company for update;
 if not found then raise exception 'Not company owner';end if;
 if not exists(select 1 from public.contributions where campaign_id=p_id) then raise exception 'No contributions yet';end if;
 update public.campaigns set status='closed' where id=p_id;
end;$$;
create or replace function public.save_question_clusters(p_campaign text,p_question text,p_company text,p_clusters jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.campaigns where id=p_campaign and company=p_company and status='closed' for update;
 if not found then raise exception 'Closed company campaign required';end if;
 if exists(select 1 from public.question_clusters where campaign_id=p_campaign and question_id=p_question) then raise exception 'Question already clustered';end if;
 insert into public.question_clusters(id,campaign_id,question_id,content_hash,title,summary,language,members,provider,model)
 select x.id,p_campaign,p_question,x.content_hash,x.title,x.summary,x.language,x.members,x.provider,x.model
 from jsonb_to_recordset(p_clusters) as x(id text,content_hash text,title text,summary text,language text,members jsonb,provider text,model text);
end;$$;
revoke all on function public.submit_contribution(text,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.close_campaign(text,text) from public,anon,authenticated;
revoke all on function public.save_question_clusters(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.submit_contribution(text,text,text,jsonb,text) to service_role;
grant execute on function public.close_campaign(text,text) to service_role;
grant execute on function public.save_question_clusters(text,text,text,jsonb) to service_role;
