-- Normalizes `form_responses.payload` into a single flat table for manual export.
--
-- Grain:
--   - one row per response/DDC classification
--   - one row per response/theme, with the book details when present
--     (themes marked "sem acervo" produce one row with NULL book columns)
--
-- Read-only: run it in the Supabase SQL editor and export the result as CSV.

with cdd_rows as (
  select
    fr.id as response_id,
    fr.submitted_at,
    fr.responsavel,
    fr.cargo,
    fr.matricula,
    fr.escola,
    'cdd'::text as registro_tipo,
    c."range" as cdd_range,
    c."color" as cdd_color,
    c."label" as cdd_label,
    c."quantidade" as cdd_quantidade,
    coalesce(c."semAcervo", false) as cdd_sem_acervo,
    null::text as tema_id,
    null::text as tema_label,
    null::boolean as tema_sem_acervo,
    null::text as livro_titulo,
    null::text as livro_autor,
    null::text as livro_editora,
    null::integer as livro_quantidade
  from public.form_responses as fr
  cross join lateral jsonb_to_recordset(
    case
      when jsonb_typeof(fr.payload -> 'cdd') = 'array' then fr.payload -> 'cdd'
      else '[]'::jsonb
    end
  ) as c(
    "range" text,
    "color" text,
    "label" text,
    "quantidade" integer,
    "semAcervo" boolean
  )
),

theme_rows as (
  select
    fr.id as response_id,
    fr.submitted_at,
    fr.responsavel,
    fr.cargo,
    fr.matricula,
    fr.escola,
    'tema'::text as registro_tipo,
    null::text as cdd_range,
    null::text as cdd_color,
    null::text as cdd_label,
    null::integer as cdd_quantidade,
    null::boolean as cdd_sem_acervo,
    t."id" as tema_id,
    t."label" as tema_label,
    coalesce(t."semAcervo", false) as tema_sem_acervo,
    l."titulo" as livro_titulo,
    l."autor" as livro_autor,
    l."editora" as livro_editora,
    l."quantidade" as livro_quantidade
  from public.form_responses as fr
  cross join lateral jsonb_to_recordset(
    case
      when jsonb_typeof(fr.payload -> 'temas') = 'array' then fr.payload -> 'temas'
      else '[]'::jsonb
    end
  ) as t(
    "id" text,
    "label" text,
    "semAcervo" boolean,
    "livros" jsonb
  )
  left join lateral jsonb_to_recordset(
    case
      when jsonb_typeof(t."livros") = 'array' then t."livros"
      else '[]'::jsonb
    end
  ) as l(
    "titulo" text,
    "autor" text,
    "editora" text,
    "quantidade" integer
  ) on true
)

select * from cdd_rows
union all
select * from theme_rows
order by
  submitted_at desc,
  response_id,
  registro_tipo,
  cdd_range,
  tema_id,
  livro_titulo;
