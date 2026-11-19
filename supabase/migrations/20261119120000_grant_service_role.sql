-- The survey tables are intentionally not exposed through the Data API.
-- Only Edge Functions (service_role via ctx.supabaseAdmin) may access them.
-- Projects with hardened default privileges do not automatically grant the
-- service_role access to newly created tables, so grant it explicitly.

begin;

grant usage on schema public to service_role;

grant select, insert, update, delete on public.respondents to service_role;
grant select, insert, update, delete on public.exemplar_cdd to service_role;
grant select, insert, update, delete on public.exemplar_theme to service_role;

grant execute on function public.set_current_timestamp_updated_at() to service_role;

commit;
