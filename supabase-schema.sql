create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.marketing_output_overrides (
  id text primary key,
  size text not null default '',
  file_extension text not null default '',
  memo text not null default '',
  work_included text not null default 'O',
  type_fit text not null default 'O',
  updated_at timestamptz not null default now()
);

alter table public.marketing_output_overrides
add column if not exists file_extension text not null default '';

alter table public.marketing_output_overrides replica identity full;
alter table public.marketing_output_overrides enable row level security;

create table if not exists public.marketing_output_settings (
  key text primary key,
  value text not null
);

alter table public.marketing_output_settings enable row level security;

drop policy if exists "Allow public read marketing output overrides" on public.marketing_output_overrides;
drop policy if exists "Allow public insert marketing output overrides" on public.marketing_output_overrides;
drop policy if exists "Allow public update marketing output overrides" on public.marketing_output_overrides;
drop policy if exists "Allow public delete marketing output overrides" on public.marketing_output_overrides;

create policy "Allow public read marketing output overrides"
on public.marketing_output_overrides
for select
to anon, authenticated
using (true);

create or replace function public.set_marketing_output_passcode(p_passcode text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if length(trim(coalesce(p_passcode, ''))) < 4 then
    raise exception 'passcode_must_be_at_least_4_characters';
  end if;

  insert into public.marketing_output_settings (key, value)
  values ('edit_passcode_hash', crypt(p_passcode, gen_salt('bf')))
  on conflict (key)
  do update set value = excluded.value;
end;
$$;

revoke all on function public.set_marketing_output_passcode(text) from public, anon, authenticated;

create or replace function public.verify_marketing_output_passcode(p_passcode text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select value
  into stored_hash
  from public.marketing_output_settings
  where key = 'edit_passcode_hash';

  if stored_hash is null then
    return false;
  end if;

  return crypt(coalesce(p_passcode, ''), stored_hash) = stored_hash;
end;
$$;

grant execute on function public.verify_marketing_output_passcode(text) to anon, authenticated;

create or replace function public.save_marketing_output_overrides(
  p_passcode text,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.verify_marketing_output_passcode(p_passcode) then
    raise exception 'invalid_edit_passcode' using errcode = '28000';
  end if;

  insert into public.marketing_output_overrides (
    id,
    size,
    file_extension,
    memo,
    work_included,
    type_fit,
    updated_at
  )
  select
    incoming.id,
    coalesce(incoming.size, ''),
    coalesce(incoming.file_extension, ''),
    coalesce(incoming.memo, ''),
    case
      when upper(trim(coalesce(incoming.work_included, 'O'))) in ('X', 'N', 'NO', 'FALSE', '0', '불필요', '미노출') then 'X'
      else 'O'
    end,
    case
      when upper(trim(coalesce(incoming.type_fit, 'O'))) in ('X', 'N', 'NO', 'FALSE', '0', '불필요', '미노출') then 'X'
      else 'O'
    end,
    now()
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as incoming(
    id text,
    size text,
    file_extension text,
    memo text,
    work_included text,
    type_fit text
  )
  where incoming.id is not null
    and incoming.id <> ''
  on conflict (id)
  do update set
    size = excluded.size,
    file_extension = excluded.file_extension,
    memo = excluded.memo,
    work_included = excluded.work_included,
    type_fit = excluded.type_fit,
    updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.save_marketing_output_overrides(text, jsonb) to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'marketing_output_overrides'
  ) then
    alter publication supabase_realtime
    add table public.marketing_output_overrides;
  end if;
end $$;
