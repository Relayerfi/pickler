-- Tickers are now reserved in market.tokens; an approved application links to the agent created from it.

alter table growth.applications add column agent_id uuid references agents.agents (id) on delete set null;
alter table growth.applications add constraint applications_agent_key unique (agent_id);

create or replace function growth.ticker_available(p_ticker text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from market.tokens where ticker = p_ticker and status <> 'failed')
     and not exists (select 1 from growth.applications where ticker = p_ticker);
$$;

-- Returns 'submitted', 'not_found', 'already_submitted', 'ticker_taken' or 'handle_taken'.
create or replace function growth.submit_application(
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
  if exists (select 1 from market.tokens where ticker = p_ticker and status <> 'failed') then
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

-- create or replace keeps existing grants; restated so this file reads on its own.
revoke all on function growth.ticker_available(text) from public, anon, authenticated;
revoke all on function growth.submit_application(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function growth.ticker_available(text) to service_role;
grant execute on function growth.submit_application(uuid, text, text, text, text, text, text, text) to service_role;
