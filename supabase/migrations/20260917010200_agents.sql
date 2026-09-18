-- agents: a workspace owns many agents. Public profile, versioned configuration, credentials
-- and the activity log are separate tables so each can be granted and audited on its own.
-- Agents are never hard-deleted once they have history: kill them instead.

create schema agents;

create type agents.agent_status as enum ('pending_policies', 'active', 'paused', 'suspended', 'draining', 'killed');
create type agents.accent as enum ('lime', 'cyan', 'amber', 'orange', 'magenta', 'violet', 'blue');

create table agents.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references identity.workspaces (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 40),
  ticker text not null constraint agents_ticker_format check (ticker ~ '^\$[A-Z][A-Z0-9]{1,5}$'),
  status agents.agent_status not null default 'pending_policies',
  chain_id integer check (chain_id > 0),
  active_config_version integer,
  created_by uuid references auth.users (id) on delete set null,
  killed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agents_ticker_key unique (ticker),
  constraint agents_killed_consistent check ((status = 'killed') = (killed_at is not null))
);
create index agents_workspace_idx on agents.agents (workspace_id, created_at desc);
create index agents_created_by_idx on agents.agents (created_by);

create table agents.agent_profiles (
  agent_id uuid primary key references agents.agents (id) on delete cascade,
  blurb text not null default '' check (char_length(blurb) <= 280),
  beat text check (char_length(beat) <= 40),
  accent agents.accent not null default 'lime',
  x_handle text check (x_handle ~ '^@[A-Za-z0-9_]{1,15}$'),
  updated_at timestamptz not null default now()
);
create unique index agent_profiles_x_handle_key on agents.agent_profiles (lower(x_handle)) where x_handle is not null;

-- Every change to what the agent is told or allowed to research is a new version.
create table agents.agent_configs (
  agent_id uuid not null references agents.agents (id) on delete cascade,
  version integer not null check (version > 0),
  personality text,
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  strategy jsonb not null default '{}'::jsonb check (jsonb_typeof(strategy) = 'object'),
  prompt_hash text check (prompt_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (agent_id, version)
);
create index agent_configs_created_by_idx on agents.agent_configs (created_by);

alter table agents.agents
  add constraint agents_active_config_fkey
  foreign key (id, active_config_version) references agents.agent_configs (agent_id, version)
  deferrable initially deferred;
create index agents_active_config_idx on agents.agents (id, active_config_version);

-- Secrets live apart from readable rows. The HMAC secret is AES-256-GCM encrypted by the API.
create table agents.agent_credentials (
  agent_id uuid primary key references agents.agents (id) on delete cascade,
  encrypted_hmac_secret text not null,
  key_version smallint not null default 1 check (key_version > 0),
  rotated_at timestamptz not null default now()
);

create table agents.agent_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents.agents (id) on delete restrict,
  workspace_id uuid not null references identity.workspaces (id) on delete restrict,
  event_type text not null check (char_length(event_type) between 1 and 100),
  payload jsonb,
  created_at timestamptz not null default now()
);
create index agent_events_agent_idx on agents.agent_events (agent_id, created_at desc);
create index agent_events_workspace_idx on agents.agent_events (workspace_id, created_at desc);

create trigger agents_updated_at before update on agents.agents for each row execute function internal.set_updated_at();
create trigger agent_profiles_updated_at before update on agents.agent_profiles for each row execute function internal.set_updated_at();
create trigger agent_configs_append_only before update or delete on agents.agent_configs for each row execute function internal.reject_mutation();
create trigger agent_events_append_only before update or delete on agents.agent_events for each row execute function internal.reject_mutation();

alter table agents.agents enable row level security;
alter table agents.agent_profiles enable row level security;
alter table agents.agent_configs enable row level security;
alter table agents.agent_credentials enable row level security;
alter table agents.agent_events enable row level security;

revoke all on schema agents from public, anon, authenticated;
grant usage on schema agents to service_role;
grant select, insert, update on agents.agents, agents.agent_profiles, agents.agent_credentials to service_role;
grant select, insert on agents.agent_configs, agents.agent_events to service_role;
