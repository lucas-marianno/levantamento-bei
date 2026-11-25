-- Append-only survey responses backend.
-- The old mutable survey tables are removed. `user_whitelist` is intentionally
-- not referenced or modified here.

begin;

drop table if exists public.exemplar_theme;
drop table if exists public.exemplar_cdd;
drop table if exists public.respondents;

create table public.form_responses (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  responsavel text not null,
  cargo text not null,
  matricula integer not null,
  escola text not null,
  payload jsonb not null,
  constraint form_responses_responsavel_not_blank_check
    check (btrim(responsavel) <> ''),
  constraint form_responses_matricula_check
    check (matricula between 1000 and 99999),
  constraint form_responses_cargo_check
    check (
      cargo in (
        'Oficial de Escola',
        'Funcionário Readaptado',
        'Diretor',
        'Vice-diretor',
        'Coordenador'
      )
    ),
  constraint form_responses_escola_not_blank_check
    check (btrim(escola) <> ''),
  constraint form_responses_payload_object_check
    check (jsonb_typeof(payload) = 'object')
);

create index form_responses_submitted_at_idx
  on public.form_responses (submitted_at desc);

create index form_responses_matricula_idx
  on public.form_responses (matricula);

-- The Data API must not expose responses. Access is exclusively through
-- Edge Functions using ctx.supabaseAdmin.
alter table public.form_responses enable row level security;

revoke all on public.form_responses from public, anon, authenticated;
revoke update, delete on public.form_responses from service_role;

grant usage on schema public to service_role;
grant select, insert on public.form_responses to service_role;

commit;
