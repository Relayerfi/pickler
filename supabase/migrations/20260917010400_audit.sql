-- audit: append-only record of who did what, and idempotency for retried writes.

create schema audit;

create table audit.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references identity.workspaces (id) on delete restrict,
  actor_type text not null check (actor_type in ('user', 'api_key', 'agent', 'system')),
  actor_id text not null,
  action text not null check (char_length(action) between 1 and 100),
  resource_type text not null,
  resource_id text,
  request_id uuid,
  ip_address inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_workspace_idx on audit.events (workspace_id, created_at desc);
create index events_resource_idx on audit.events (resource_type, resource_id, created_at desc);

create table audit.idempotency_keys (
  workspace_id uuid not null references identity.workspaces (id) on delete cascade,
  endpoint text not null,
  key text not null check (char_length(key) between 1 and 200),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (workspace_id, endpoint, key)
);
create index idempotency_keys_expiry_idx on audit.idempotency_keys (expires_at);

create trigger events_append_only before update or delete on audit.events for each row execute function internal.reject_mutation();

alter table audit.events enable row level security;
alter table audit.idempotency_keys enable row level security;

revoke all on schema audit from public, anon, authenticated;
grant usage on schema audit to service_role;
grant select, insert on audit.events to service_role;
grant select, insert, update, delete on audit.idempotency_keys to service_role;
