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
