-- Handles: one namespace shared by people and agents, so @handle never names both.
-- Agents lose their ticker: the ticker belongs to the agent's token (market.tokens).
-- Wallet links become chain-family wide: an EVM account is the same on every EVM chain.

create table identity.handles (
  handle text primary key constraint handles_format check (handle ~ '^[a-z0-9_]{3,15}$'),
  user_id uuid references auth.users (id) on delete cascade,
  agent_id uuid references agents.agents (id) on delete cascade deferrable initially deferred,
  created_at timestamptz not null default now(),
  constraint handles_single_owner check (num_nonnulls(user_id, agent_id) = 1),
  constraint handles_user_key unique (user_id),
  constraint handles_agent_key unique (agent_id),
  constraint handles_handle_user_key unique (handle, user_id),
  constraint handles_handle_agent_key unique (handle, agent_id)
);

-- Released handles stay blocked for a cooldown so nobody can take over a name people still recognize.
-- No owner ids: the record must outlive deleted users.
create table identity.handle_history (
  id bigint generated always as identity primary key,
  handle text not null,
  owner_kind text not null check (owner_kind in ('user', 'agent')),
  released_at timestamptz not null default now()
);
create index handle_history_handle_idx on identity.handle_history (handle, released_at desc);

create function internal.record_handle_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.handle is distinct from old.handle then
    insert into identity.handle_history (handle, owner_kind)
    values (old.handle, case when old.user_id is not null then 'user' else 'agent' end);
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function internal.record_handle_release() from public, anon, authenticated;

create trigger handles_release after update of handle or delete on identity.handles
  for each row execute function internal.record_handle_release();

-- A profile's handle must be registered to that same person.
alter table identity.profiles
  add constraint profiles_handle_owner_fkey foreign key (handle, user_id)
  references identity.handles (handle, user_id) on update cascade deferrable initially deferred;
create index profiles_handle_owner_idx on identity.profiles (handle, user_id);

-- Agents are addressed by handle; the ticker moves to market.tokens.
alter table agents.agents drop constraint agents_ticker_key;
alter table agents.agents drop constraint agents_ticker_format;
alter table agents.agents drop column ticker;
alter table agents.agents add column handle text not null;
alter table agents.agents add constraint agents_handle_key unique (handle);
alter table agents.agents
  add constraint agents_handle_owner_fkey foreign key (handle, id)
  references identity.handles (handle, agent_id) on update cascade deferrable initially deferred;
create index agents_handle_owner_idx on agents.agents (handle, id);

-- Wallet links: unique per chain family and address; the chain the proof was signed on is kept for audit.
alter table identity.wallet_links drop constraint wallet_links_address_key;
alter table identity.wallet_links drop constraint wallet_links_address_check;
alter table identity.wallet_links drop constraint wallet_links_method_check;
alter table identity.wallet_links drop column chain_id;
alter table identity.wallet_links add column namespace text not null check (namespace in ('eip155', 'solana'));
alter table identity.wallet_links add column verified_chain text not null check (verified_chain ~ '^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$');
-- external: a wallet the person brings (MetaMask, Rabby). mera: derived from their passkey in the Pickler app.
alter table identity.wallet_links add column kind text not null default 'external' check (kind in ('external', 'mera'));
alter table identity.wallet_links add constraint wallet_links_address_format check (
  (namespace = 'eip155' and address ~ '^0x[0-9a-f]{40}$')
  or (namespace = 'solana' and address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$')
);
alter table identity.wallet_links add constraint wallet_links_method_check check (method in ('siwe', 'siws'));
alter table identity.wallet_links add constraint wallet_links_verified_chain_family check (split_part(verified_chain, ':', 1) = namespace);
alter table identity.wallet_links add constraint wallet_links_address_key unique (namespace, address);

create function identity.handle_available(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_handle ~ '^[a-z0-9_]{3,15}$'
     and not exists (select 1 from identity.handles where handle = p_handle)
     and not exists (select 1 from identity.handle_history where handle = p_handle and released_at > now() - interval '30 days');
$$;

-- Registers the handle and the profile together. Returns 'created', 'handle_taken' or 'user_has_profile'.
create function identity.create_profile(p_user_id uuid, p_display_name text, p_handle text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  violated text;
begin
  if exists (select 1 from identity.profiles where user_id = p_user_id) then
    return 'user_has_profile';
  end if;
  if not identity.handle_available(p_handle) then
    return 'handle_taken';
  end if;
  insert into identity.handles (handle, user_id) values (p_handle, p_user_id);
  insert into identity.profiles (user_id, display_name, handle) values (p_user_id, p_display_name, p_handle);
  return 'created';
exception
  when unique_violation then
    get stacked diagnostics violated = constraint_name;
    return case when violated in ('handles_pkey', 'profiles_handle_key') then 'handle_taken' else 'user_has_profile' end;
end;
$$;

alter table identity.handles enable row level security;
alter table identity.handle_history enable row level security;

grant select, insert, update, delete on identity.handles to service_role;
grant select on identity.handle_history to service_role;
revoke all on function identity.handle_available(text) from public, anon, authenticated;
revoke all on function identity.create_profile(uuid, text, text) from public, anon, authenticated;
grant execute on function identity.handle_available(text) to service_role;
grant execute on function identity.create_profile(uuid, text, text) to service_role;
