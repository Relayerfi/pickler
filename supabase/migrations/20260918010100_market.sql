-- market: agent tokens and their trading, projected from chain events. See docs/market/token-launch.md.
-- Pickler never signs here: creators launch and people trade with their own wallets. The launch contracts
-- (pre-graduation curve, graduation migrator, fee splitter) are specified by the infra owner; these tables
-- only assume what any curve-then-pool launch emits. EVM chains only (CAIP-2 `eip155:<id>`).
-- Amounts are base units (numeric(78,0) holds any uint256). Prices are quote per whole token.

create schema market;

create type market.token_status as enum ('reserved', 'launching', 'pre_graduation', 'graduated', 'failed');
create type market.pool_phase as enum ('pre_graduation', 'post_graduation');
create type market.trade_side as enum ('buy', 'sell');
create type market.candle_interval as enum ('5m', '1h', '4h', '1d');
create type market.fee_recipient_role as enum ('creator', 'agent', 'platform');

create table market.tokens (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents.agents (id) on delete restrict,
  -- Reserved when an application is approved, before any contract exists.
  ticker text not null constraint tokens_ticker_format check (ticker ~ '^\$[A-Z][A-Z0-9]{1,5}$'),
  name text not null check (char_length(name) between 1 and 40),
  image_uri text check (image_uri ~ '^(https|ipfs)://'),
  chain text not null check (chain ~ '^eip155:[1-9][0-9]*$'),
  address text check (address ~ '^0x[0-9a-f]{40}$'),
  decimals smallint not null default 18 check (decimals between 0 and 36),
  total_supply numeric(78,0) check (total_supply > 0),
  -- Asset the curve and pool are priced in; a null address is the chain's native asset.
  quote_symbol text check (char_length(quote_symbol) between 1 and 12),
  quote_address text check (quote_address ~ '^0x[0-9a-f]{40}$'),
  quote_decimals smallint check (quote_decimals between 0 and 36),
  -- Quote raised on the curve that triggers graduation, in quote base units.
  graduation_target numeric(78,0) check (graduation_target > 0),
  status market.token_status not null default 'reserved',
  launch_tx_hash text check (launch_tx_hash ~ '^0x[0-9a-f]{64}$'),
  launched_at timestamptz,
  graduated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tokens_launched_consistent check (
    status not in ('pre_graduation', 'graduated')
    or (address is not null and launched_at is not null and total_supply is not null and quote_decimals is not null)
  ),
  constraint tokens_graduated_consistent check ((status = 'graduated') = (graduated_at is not null))
);
-- A failed launch frees the agent and the ticker for another attempt.
create unique index tokens_agent_key on market.tokens (agent_id) where status <> 'failed';
create unique index tokens_ticker_key on market.tokens (ticker) where status <> 'failed';
create unique index tokens_address_key on market.tokens (chain, address) where address is not null;
create index tokens_agent_idx on market.tokens (agent_id);

-- Where a token trades in each phase: our bonding curve before graduation, a pool after it.
create table market.pools (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references market.tokens (id) on delete restrict,
  phase market.pool_phase not null,
  venue text not null check (venue in ('pickler_curve', 'pons', 'uniswap_v4')),
  -- Curve contract, or the pool contract when the venue has one.
  address text check (address ~ '^0x[0-9a-f]{40}$'),
  -- Uniswap V4 PoolId: V4 pools live inside the PoolManager and have no address of their own.
  pool_key text check (pool_key ~ '^0x[0-9a-f]{64}$'),
  opened_tx_hash text not null check (opened_tx_hash ~ '^0x[0-9a-f]{64}$'),
  opened_at timestamptz not null,
  closed_tx_hash text check (closed_tx_hash ~ '^0x[0-9a-f]{64}$'),
  closed_at timestamptz,
  constraint pools_locator check (address is not null or pool_key is not null),
  constraint pools_closed_consistent check ((closed_at is null) = (closed_tx_hash is null)),
  constraint pools_token_phase_key unique (token_id, phase)
);

-- Fee split configured on-chain for each phase, mirrored for display. Shares are basis points.
create table market.fee_splits (
  token_id uuid not null references market.tokens (id) on delete restrict,
  phase market.pool_phase not null,
  role market.fee_recipient_role not null,
  recipient text not null check (recipient ~ '^0x[0-9a-f]{40}$'),
  share_bps integer not null check (share_bps between 0 and 10000),
  primary key (token_id, phase, role)
);

-- Rows derived from logs carry block hash and log position: the indexer deletes them on a reorg and
-- re-inserts idempotently.
create table market.trades (
  id bigint generated always as identity primary key,
  pool_id uuid not null references market.pools (id) on delete restrict,
  side market.trade_side not null,
  trader text not null check (trader ~ '^0x[0-9a-f]{40}$'),
  token_amount numeric(78,0) not null check (token_amount > 0),
  quote_amount numeric(78,0) not null check (quote_amount >= 0),
  fee_amount numeric(78,0) not null default 0 check (fee_amount >= 0),
  block_number bigint not null check (block_number >= 0),
  block_hash text not null check (block_hash ~ '^0x[0-9a-f]{64}$'),
  tx_hash text not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index integer not null check (log_index >= 0),
  block_time timestamptz not null,
  constraint trades_log_key unique (pool_id, tx_hash, log_index)
);
create index trades_pool_time_idx on market.trades (pool_id, block_time desc);
create index trades_trader_idx on market.trades (trader, block_time desc);

-- Fees paid out to a recipient (claims or automatic distributions).
create table market.fee_payouts (
  id bigint generated always as identity primary key,
  token_id uuid not null references market.tokens (id) on delete restrict,
  pool_id uuid references market.pools (id) on delete restrict,
  role market.fee_recipient_role not null,
  recipient text not null check (recipient ~ '^0x[0-9a-f]{40}$'),
  -- Null is the chain's native asset.
  asset_address text check (asset_address ~ '^0x[0-9a-f]{40}$'),
  amount numeric(78,0) not null check (amount > 0),
  block_number bigint not null check (block_number >= 0),
  block_hash text not null check (block_hash ~ '^0x[0-9a-f]{64}$'),
  tx_hash text not null check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  log_index integer not null check (log_index >= 0),
  block_time timestamptz not null,
  constraint fee_payouts_log_key unique (token_id, tx_hash, log_index)
);
create index fee_payouts_pool_idx on market.fee_payouts (pool_id);

create table market.holders (
  token_id uuid not null references market.tokens (id) on delete restrict,
  address text not null check (address ~ '^0x[0-9a-f]{40}$'),
  balance numeric(78,0) not null check (balance >= 0),
  updated_block bigint not null check (updated_block >= 0),
  primary key (token_id, address)
);
create index holders_top_idx on market.holders (token_id, balance desc);

create table market.candles (
  token_id uuid not null references market.tokens (id) on delete restrict,
  bucket market.candle_interval not null,
  bucket_start timestamptz not null,
  open numeric not null check (open > 0),
  high numeric not null,
  low numeric not null check (low > 0),
  close numeric not null check (close > 0),
  volume_quote numeric(78,0) not null default 0 check (volume_quote >= 0),
  trade_count integer not null default 0 check (trade_count >= 0),
  primary key (token_id, bucket, bucket_start),
  constraint candles_range check (low <= least(open, close) and high >= greatest(open, close))
);

-- Last block each indexer stream processed, with its hash to detect reorgs on resume.
create table market.indexer_cursors (
  chain text not null check (chain ~ '^eip155:[1-9][0-9]*$'),
  contract text not null check (contract ~ '^0x[0-9a-f]{40}$'),
  stream text not null check (char_length(stream) between 1 and 40),
  last_block bigint not null check (last_block >= 0),
  last_block_hash text not null check (last_block_hash ~ '^0x[0-9a-f]{64}$'),
  updated_at timestamptz not null default now(),
  primary key (chain, contract, stream)
);

create trigger tokens_updated_at before update on market.tokens for each row execute function internal.set_updated_at();
create trigger indexer_cursors_updated_at before update on market.indexer_cursors for each row execute function internal.set_updated_at();

alter table market.tokens enable row level security;
alter table market.pools enable row level security;
alter table market.fee_splits enable row level security;
alter table market.trades enable row level security;
alter table market.fee_payouts enable row level security;
alter table market.holders enable row level security;
alter table market.candles enable row level security;
alter table market.indexer_cursors enable row level security;

revoke all on schema market from public, anon, authenticated;
grant usage on schema market to service_role;
grant select, insert, update on market.tokens, market.pools, market.fee_splits, market.holders, market.candles, market.indexer_cursors to service_role;
grant delete on market.fee_splits, market.holders to service_role;
-- Log-derived rows are never edited, only removed when their block is reorganized away.
grant select, insert, delete on market.trades, market.fee_payouts to service_role;
