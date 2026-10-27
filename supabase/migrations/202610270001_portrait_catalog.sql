-- Blurrle catalog: names/metadata in Postgres, image files in private Storage.
-- Run once in the Supabase SQL Editor as postgres. Safe to re-run.
begin;

create table if not exists public.people (
  id text primary key check (id ~ '^[a-f0-9]{12}$'),
  name text not null check (length(trim(name)) > 0),
  wikidata_id text unique,
  accepted_answers text[] not null default '{}',
  hint text,
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.categories (
  slug text primary key,
  label text not null
);
insert into public.categories (slug,label) values
  ('actors','Actors'), ('world-leaders','World leaders'),
  ('politicians','Politicians'), ('ceos-founders','CEOs / founders')
on conflict (slug) do nothing;

create table if not exists public.person_categories (
  person_id text not null references public.people(id),
  category_slug text not null references public.categories(slug),
  primary key (person_id,category_slug)
);
create table if not exists public.portraits (
  id text primary key check (id ~ '^[a-f0-9]{24}$'),
  person_id text not null references public.people(id),
  storage_bucket text not null,
  storage_path text not null,
  source_dataset text not null,
  source_dataset_url text not null,
  source_file text not null,
  source_label text not null,
  dataset_license_name text not null,
  dataset_license_url text not null,
  image_source_url text,
  image_license_name text,
  image_license_url text,
  attribution text,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  source_metadata jsonb not null default '{}',
  imported_at timestamptz not null default now(),
  unique (source_dataset,source_file),
  unique (id,person_id)
);
create index if not exists portraits_person_idx on public.portraits(person_id);
create index if not exists portraits_review_idx on public.portraits(review_status);
create index if not exists portraits_checksum_idx on public.portraits(sha256);
create table if not exists public.daily_images (
  day date not null,
  category_slug text not null references public.categories(slug),
  position integer not null check (position between 0 and 4),
  person_id text not null references public.people(id),
  portrait_id text not null,
  primary key (day,category_slug,position),
  unique (day,category_slug,person_id),
  foreign key (portrait_id,person_id) references public.portraits(id,person_id)
);

-- No browser role can read/write pending catalog entries.
alter table public.people enable row level security;
alter table public.categories enable row level security;
alter table public.person_categories enable row level security;
alter table public.portraits enable row level security;
alter table public.daily_images enable row level security;
revoke all on public.people, public.categories, public.person_categories, public.portraits, public.daily_images from anon, authenticated;
grant select, insert, update on public.people, public.categories, public.person_categories, public.portraits, public.daily_images to service_role;

-- Save each portrait and its person/category metadata together. Re-imports do not
-- overwrite manual corrections, approvals, hints, or existing daily selections.
create or replace function public.import_blurrle_portrait(person jsonb, portrait jsonb, memberships text[])
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  existing public.portraits;
  category text;
begin
  select * into existing from public.portraits
    where source_dataset = portrait->>'source_dataset' and source_file = portrait->>'source_file'
    for update;
  if found then
    if existing.sha256 <> portrait->>'sha256' then
      raise exception 'Source image changed; manual review required';
    end if;
    return existing.id;
  end if;
  insert into public.people(id,name,accepted_answers,hint)
    values(person->>'id', person->>'name',
      array(select jsonb_array_elements_text(person->'accepted_answers')), person->>'hint')
    on conflict (id) do nothing;
  foreach category in array memberships loop
    insert into public.person_categories(person_id,category_slug)
      values(person->>'id',category) on conflict do nothing;
  end loop;
  insert into public.portraits(
    id,person_id,storage_bucket,storage_path,source_dataset,source_dataset_url,source_file,source_label,
    dataset_license_name,dataset_license_url,sha256,width,height,source_metadata
  ) values (
    portrait->>'id',person->>'id',portrait->>'storage_bucket',portrait->>'storage_path',
    portrait->>'source_dataset',portrait->>'source_dataset_url',portrait->>'source_file',portrait->>'source_label',
    portrait->>'dataset_license_name',portrait->>'dataset_license_url',portrait->>'sha256',
    (portrait->>'width')::integer,(portrait->>'height')::integer,portrait->'source_metadata'
  ) on conflict (source_dataset,source_file) do nothing;
  return portrait->>'id';
end;
$$;
revoke all on function public.import_blurrle_portrait(jsonb,jsonb,text[]) from public, anon, authenticated;
grant execute on function public.import_blurrle_portrait(jsonb,jsonb,text[]) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('portrait-imports','portrait-imports',false,5242880,array['image/webp'])
  on conflict (id) do nothing;
commit;
