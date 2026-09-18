-- Helpers shared by every Pickler schema. `internal` is never exposed through the Data API.

create schema internal;
revoke all on schema internal from public, anon, authenticated;
grant usage on schema internal to service_role;

create function internal.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Attached to append-only tables (events, ledgers): history is never edited or deleted.
create function internal.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%.% is append-only', tg_table_schema, tg_table_name using errcode = '42501';
end;
$$;
