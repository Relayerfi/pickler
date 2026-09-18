-- budget: per-agent spend limits. The AgentLedger Durable Object is the authority for live spend;
-- these tables are its durable projection and history. Amounts are micro-USD (1 USD = 1_000_000).

create schema budget;

create type budget.category as enum ('infra', 'tokens', 'payments');
create type budget.ledger_action as enum ('reserve', 'commit', 'release', 'record', 'configure', 'reset');

create table budget.budgets (
  agent_id uuid not null references agents.agents (id) on delete cascade,
  category budget.category not null,
  limit_micro_usd bigint not null check (limit_micro_usd >= 0),
  -- May exceed the limit after post-hoc telemetry records; enforcement happens on reserve.
  spent_micro_usd bigint not null default 0 check (spent_micro_usd >= 0),
  reserved_micro_usd bigint not null default 0 check (reserved_micro_usd >= 0),
  period_key text not null check (period_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  updated_at timestamptz not null default now(),
  primary key (agent_id, category)
);

create table budget.ledger_entries (
  id bigint generated always as identity primary key,
  agent_id uuid not null references agents.agents (id) on delete restrict,
  category budget.category not null,
  action budget.ledger_action not null,
  amount_micro_usd bigint not null check (amount_micro_usd >= 0),
  reservation_id text,
  event_id text,
  created_at timestamptz not null default now()
);
create index ledger_entries_agent_idx on budget.ledger_entries (agent_id, created_at desc);
create unique index ledger_entries_reservation_action_key on budget.ledger_entries (reservation_id, action) where reservation_id is not null;

create trigger budgets_updated_at before update on budget.budgets for each row execute function internal.set_updated_at();
create trigger ledger_entries_append_only before update or delete on budget.ledger_entries for each row execute function internal.reject_mutation();

alter table budget.budgets enable row level security;
alter table budget.ledger_entries enable row level security;

revoke all on schema budget from public, anon, authenticated;
grant usage on schema budget to service_role;
grant select, insert, update on budget.budgets to service_role;
grant select, insert on budget.ledger_entries to service_role;
