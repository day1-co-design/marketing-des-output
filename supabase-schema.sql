create table if not exists public.marketing_output_overrides (
  id text primary key,
  size text not null default '',
  memo text not null default '',
  work_included text not null default 'O',
  type_fit text not null default 'O',
  updated_at timestamptz not null default now()
);

alter table public.marketing_output_overrides replica identity full;
alter table public.marketing_output_overrides enable row level security;

drop policy if exists "Allow public read marketing output overrides" on public.marketing_output_overrides;
drop policy if exists "Allow public insert marketing output overrides" on public.marketing_output_overrides;
drop policy if exists "Allow public update marketing output overrides" on public.marketing_output_overrides;
drop policy if exists "Allow public delete marketing output overrides" on public.marketing_output_overrides;

create policy "Allow public read marketing output overrides"
on public.marketing_output_overrides
for select
using (true);

create policy "Allow public insert marketing output overrides"
on public.marketing_output_overrides
for insert
with check (true);

create policy "Allow public update marketing output overrides"
on public.marketing_output_overrides
for update
using (true)
with check (true);

create policy "Allow public delete marketing output overrides"
on public.marketing_output_overrides
for delete
using (true);

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
