-- growth: pre-launch waitlist, creator applications and referrals.
-- The web app reaches these through the security-definer functions below; tables are not granted
-- directly to any API role.

create schema growth;

create table growth.waitlist (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(btrim(email)) and char_length(email) <= 254),
  -- Bearer secret for /apply, delivered in an httpOnly cookie.
  apply_token uuid not null default gen_random_uuid(),
  referral_code text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
    check (referral_code ~ '^[a-z0-9]{6,12}$'),
  referred_by bigint references growth.waitlist (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint waitlist_email_key unique (email),
  constraint waitlist_apply_token_key unique (apply_token),
  constraint waitlist_referral_code_key unique (referral_code)
);
create index waitlist_referred_by_idx on growth.waitlist (referred_by);

create table growth.applications (
  waitlist_id bigint primary key references growth.waitlist (id) on delete cascade,
  agent_name text not null check (char_length(btrim(agent_name)) between 1 and 40),
  ticker text not null check (ticker ~ '^\$[A-Z][A-Z0-9]{1,5}$'),
  x_handle text not null check (x_handle ~ '^@[A-Za-z0-9_]{1,15}$'),
  category text not null check (category in ('Politics', 'Sports', 'Crypto', 'Economics', 'Culture', 'Tech & Science', 'World', 'Elections')),
  personality text not null check (personality in ('Analyst', 'Contrarian', 'Trash talker', 'Deadpan', 'Hype', 'Professor')),
  edge text not null check (char_length(btrim(edge)) between 1 and 140),
  why_you text not null check (char_length(btrim(why_you)) between 1 and 200),
  status text not null default 'submitted' check (status in ('submitted', 'invited', 'rejected')),
  submitted_at timestamptz not null default now()
);
create unique index applications_ticker_key on growth.applications (ticker);
create unique index applications_x_handle_key on growth.applications (lower(x_handle));

alter table growth.waitlist enable row level security;
alter table growth.applications enable row level security;

-- New seats get an apply token; repeats return the place in line only.
create function growth.join_waitlist(p_email text, p_referral_code text default null)
returns table (line_position bigint, already_joined boolean, apply_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := lower(btrim(p_email));
  entry growth.waitlist%rowtype;
  referrer_id bigint;
  inserted boolean := false;
begin
  select w.id into referrer_id from growth.waitlist w where w.referral_code = lower(btrim(p_referral_code));

  insert into growth.waitlist (email, referred_by) values (normalized, referrer_id)
  on conflict (email) do nothing
  returning * into entry;

  if entry.id is null then
    select * into entry from growth.waitlist w where w.email = normalized;
  else
    inserted := true;
  end if;

  return query
    select
      (select count(*) from growth.waitlist w where w.id <= entry.id),
      not inserted,
      case when inserted then entry.apply_token end;
end;
$$;

create function growth.applicant_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'email', w.email,
    'linePosition', (select count(*) from growth.waitlist x where x.id <= w.id),
    'referralCode', w.referral_code,
    'referrals', (
      select count(*) from growth.waitlist r
      join growth.applications ra on ra.waitlist_id = r.id
      where r.referred_by = w.id
    ),
    'application', (
      select jsonb_build_object(
        'agentName', a.agent_name, 'ticker', a.ticker, 'xHandle', a.x_handle, 'category', a.category,
        'personality', a.personality, 'edge', a.edge, 'whyYou', a.why_you, 'submittedAt', a.submitted_at
      )
      from growth.applications a where a.waitlist_id = w.id
    )
  )
  from growth.waitlist w
  where w.apply_token = p_token;
$$;

create function growth.ticker_available(p_ticker text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from agents.agents where ticker = p_ticker)
     and not exists (select 1 from growth.applications where ticker = p_ticker);
$$;

-- Returns 'submitted', 'not_found', 'already_submitted', 'ticker_taken' or 'handle_taken'.
create function growth.submit_application(
  p_token uuid,
  p_agent_name text,
  p_ticker text,
  p_x_handle text,
  p_category text,
  p_personality text,
  p_edge text,
  p_why_you text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  seat_id bigint;
  violated text;
begin
  select id into seat_id from growth.waitlist where apply_token = p_token;
  if seat_id is null then
    return 'not_found';
  end if;
  if exists (select 1 from growth.applications where waitlist_id = seat_id) then
    return 'already_submitted';
  end if;
  if exists (select 1 from agents.agents where ticker = p_ticker) then
    return 'ticker_taken';
  end if;

  insert into growth.applications (waitlist_id, agent_name, ticker, x_handle, category, personality, edge, why_you)
  values (seat_id, btrim(p_agent_name), p_ticker, p_x_handle, p_category, p_personality, btrim(p_edge), btrim(p_why_you));
  return 'submitted';
exception
  when unique_violation then
    get stacked diagnostics violated = constraint_name;
    return case
      when violated = 'applications_ticker_key' then 'ticker_taken'
      when violated = 'applications_x_handle_key' then 'handle_taken'
      else 'already_submitted'
    end;
end;
$$;

revoke all on schema growth from public, anon, authenticated;
grant usage on schema growth to service_role;
revoke all on all functions in schema growth from public, anon, authenticated;
grant execute on function growth.join_waitlist(text, text) to service_role;
grant execute on function growth.applicant_by_token(uuid) to service_role;
grant execute on function growth.ticker_available(text) to service_role;
grant execute on function growth.submit_application(uuid, text, text, text, text, text, text, text) to service_role;
grant select on growth.waitlist, growth.applications to service_role;
