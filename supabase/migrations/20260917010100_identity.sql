-- identity: people, their public profile, verified wallets, workspaces, members and API keys.
-- A person is a Supabase Auth user (auth.users). A workspace is the creator's space; it can have
-- a team and owns agents (see agents schema).

create schema identity;

create table identity.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  handle text not null constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,15}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_key unique (handle)
);

-- Wallets a person proved control of (Sign-In with Ethereum). One address belongs to one person.
create table identity.wallet_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chain_id integer not null check (chain_id > 0),
  address text not null check (address ~ '^0x[0-9a-f]{40}$'),
  method text not null check (method in ('siwe')),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint wallet_links_address_key unique (chain_id, address)
);
create index wallet_links_user_idx on identity.wallet_links (user_id);

create table identity.workspaces (
  id uuid primary key default gen_random_uuid(),
  -- A person owns at most one workspace; they can be a member of others.
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  is_active boolean not null default true,
  active_modules text[] not null default array['agent']::text[]
    check (active_modules <@ array['signing', 'payout', 'action', 'agent']::text[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_owner_key unique (owner_user_id)
);

create type identity.member_role as enum ('admin', 'manager', 'developer', 'auditor', 'viewer');

create table identity.workspace_members (
  workspace_id uuid not null references identity.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role identity.member_role not null default 'viewer',
  invited_by uuid references auth.users (id) on delete set null,
  -- Optimistic concurrency for role changes.
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on identity.workspace_members (user_id, created_at);
create index workspace_members_invited_by_idx on identity.workspace_members (invited_by);

-- Replaces Relayer's api_keys + integrator_keys (a one-to-one join). Only the SHA-256 hash is stored.
create table identity.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references identity.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  display_prefix text check (char_length(display_prefix) <= 16),
  scopes text[] not null default array[]::text[],
  allowed_cidrs cidr[],
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint api_keys_hash_key unique (hash)
);
create index api_keys_workspace_idx on identity.api_keys (workspace_id);
create index api_keys_created_by_idx on identity.api_keys (created_by);

create trigger profiles_updated_at before update on identity.profiles for each row execute function internal.set_updated_at();
create trigger workspaces_updated_at before update on identity.workspaces for each row execute function internal.set_updated_at();
create trigger workspace_members_updated_at before update on identity.workspace_members for each row execute function internal.set_updated_at();

alter table identity.profiles enable row level security;
alter table identity.wallet_links enable row level security;
alter table identity.workspaces enable row level security;
alter table identity.workspace_members enable row level security;
alter table identity.api_keys enable row level security;

revoke all on schema identity from public, anon, authenticated;
grant usage on schema identity to service_role;
grant select, insert, update on all tables in schema identity to service_role;
grant delete on identity.workspace_members, identity.wallet_links to service_role;
