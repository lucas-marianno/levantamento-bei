-- Initial backend schema for levantamento-bei survey
-- Tables are accessed exclusively through Edge Functions (no Data API exposure).
-- RLS is enabled on all tables; no anon/authenticated policies are created.

begin;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.respondents (
  id uuid primary key default gen_random_uuid(),
  matricula integer not null,
  name text not null,
  role text not null,
  emeb text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint respondents_matricula_check check (matricula between 1000 and 99999),
  constraint respondents_matricula_key unique (matricula),
  constraint respondents_role_check check (
    role in (
      'Oficial de Escola',
      'Funcionário Readaptado',
      'Diretor',
      'Vice-diretor',
      'Coordenador'
    )
  )
);

create table if not exists public.exemplar_cdd (
  id uuid primary key default gen_random_uuid(),
  respondent_id uuid not null references public.respondents(id) on delete cascade,
  cdd text not null,
  label_color text not null default '',
  label text not null default '',
  quantity integer not null default 0,
  is_na boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exemplar_cdd_quantity_check check (quantity >= 0),
  constraint exemplar_cdd_na_quantity_check check (not is_na or quantity = 0)
);

create table if not exists public.exemplar_theme (
  id uuid primary key default gen_random_uuid(),
  respondent_id uuid not null references public.respondents(id) on delete cascade,
  theme_id text not null,
  theme_label text not null default '',
  title text not null,
  author text not null,
  publisher text not null,
  quantity integer not null,
  client_row_id text not null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exemplar_theme_quantity_check check (quantity >= 1)
);

-- Active (non-deleted) uniqueness / upsert identities
create unique index if not exists exemplar_cdd_active_respondent_cdd_idx
  on public.exemplar_cdd (respondent_id, cdd)
  where deleted_at is null;

create unique index if not exists exemplar_theme_active_client_row_idx
  on public.exemplar_theme (respondent_id, client_row_id)
  where deleted_at is null;

create unique index if not exists exemplar_theme_active_title_per_theme_idx
  on public.exemplar_theme (respondent_id, theme_id, title)
  where deleted_at is null;

create index if not exists exemplar_cdd_respondent_idx
  on public.exemplar_cdd (respondent_id);

create index if not exists exemplar_theme_respondent_idx
  on public.exemplar_theme (respondent_id);

create index if not exists exemplar_theme_respondent_theme_idx
  on public.exemplar_theme (respondent_id, theme_id);

-- updated_at maintenance
drop trigger if exists set_respondents_updated_at on public.respondents;
create trigger set_respondents_updated_at
before update on public.respondents
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_exemplar_cdd_updated_at on public.exemplar_cdd;
create trigger set_exemplar_cdd_updated_at
before update on public.exemplar_cdd
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_exemplar_theme_updated_at on public.exemplar_theme;
create trigger set_exemplar_theme_updated_at
before update on public.exemplar_theme
for each row execute function public.set_current_timestamp_updated_at();

-- Row Level Security enabled (no policies: access only via privileged Edge Functions)
alter table public.respondents enable row level security;
alter table public.exemplar_cdd enable row level security;
alter table public.exemplar_theme enable row level security;

commit;
