import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const ALLOWED_ROLES = [
  "Oficial de Escola",
  "Funcionário Readaptado",
  "Diretor",
  "Vice-diretor",
  "Coordenador",
] as const;

const WHITELIST_FUNCTION = "is_user_whitelisted";

type AnyRecord = Record<string, unknown>;

interface NormalizedCddItem {
  range: string;
  color: string;
  label: string;
  quantidade: number;
  semAcervo: boolean;
}

interface NormalizedBook {
  titulo: string;
  autor: string;
  editora: string;
  quantidade: number;
}

interface NormalizedTheme {
  id: string;
  label: string;
  semAcervo: boolean;
  livros: NormalizedBook[];
}

interface NormalizedResponse {
  responsavel: string;
  cargo: string;
  matricula: number;
  escola: string;
  cdd: NormalizedCddItem[];
  temas: NormalizedTheme[];
}

function isPlainObject(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseMatricula(value: unknown): number | null {
  const digits =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value.trim()
        : "";

  if (!/^\d+$/.test(digits)) {
    return null;
  }

  const matricula = Number(digits);
  if (!Number.isInteger(matricula) || matricula < 1000 || matricula > 99999) {
    return null;
  }

  return matricula;
}

function parseCollectionDay(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return value;
}

function checkCollectionPeriod():
  | { ok: true }
  | { ok: false; status: number; error: string } {
  const start = parseCollectionDay(Deno.env.get("COLLECTION_START"));
  const end = parseCollectionDay(Deno.env.get("COLLECTION_END"));

  if (!start || !end) {
    return {
      ok: false,
      status: 500,
      error: "Collection period is not configured",
    };
  }

  if (start > end) {
    return { ok: false, status: 500, error: "Collection period is invalid" };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (today < start || today > end) {
    return { ok: false, status: 403, error: "Survey collection period is closed" };
  }

  return { ok: true };
}

function dbError(label: string, error: unknown): Response {
  console.error(label, error);

  const detail = isPlainObject(error)
    ? {
        code: typeof error.code === "string" ? error.code : undefined,
        message: typeof error.message === "string" ? error.message : undefined,
        hint: typeof error.hint === "string" ? error.hint : undefined,
      }
    : null;

  return Response.json({ error: label, detail }, { status: 500 });
}

async function checkWhitelist(
  matricula: number,
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const key =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("PUBLISHABLE_KEY");

  if (!supabaseUrl || !key) {
    console.error("Whitelist function configuration missing");
    return { ok: false, error: "Whitelist configuration missing", status: 500 };
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/${WHITELIST_FUNCTION}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ matricula }),
      },
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : "Whitelist check failed";
      return { ok: false, error: message, status: response.status };
    }

    return { ok: data === true };
  } catch (error) {
    console.error("Whitelist function call failed:", error);
    return { ok: false, error: "Whitelist check failed", status: 500 };
  }
}

function normalizeCdd(
  raw: unknown,
): { items?: NormalizedCddItem[]; error?: string } {
  if (!Array.isArray(raw)) {
    return { error: "cdd must be an array" };
  }

  if (raw.length === 0) {
    return { error: "cdd must contain at least one item" };
  }

  const seenRanges = new Set<string>();
  const items: NormalizedCddItem[] = [];

  for (const entry of raw) {
    if (!isPlainObject(entry)) {
      return { error: "Each cdd item must be an object" };
    }

    const range = String(entry.range ?? entry.cdd ?? "").trim();
    const color = String(entry.color ?? entry.label_color ?? "").trim();
    const label = String(entry.label ?? "").trim();
    const semAcervo = Boolean(entry.semAcervo ?? entry.is_na);
    const rawQuantity = entry.quantidade ?? entry.quantity ?? 0;
    const quantity =
      typeof rawQuantity === "number" ? rawQuantity : Number(rawQuantity);

    if (!range) {
      return { error: "Each cdd item must have a range" };
    }
    if (seenRanges.has(range)) {
      return { error: `Duplicate cdd range: ${range}` };
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      return { error: `Invalid quantity for cdd ${range}` };
    }
    if (!semAcervo && quantity < 1) {
      return { error: `cdd ${range} requires quantity >= 1 or semAcervo` };
    }

    seenRanges.add(range);
    items.push({
      range,
      color,
      label,
      quantidade: semAcervo ? 0 : quantity,
      semAcervo,
    });
  }

  return { items };
}

function normalizeThemes(
  raw: unknown,
): { items?: NormalizedTheme[]; error?: string } {
  if (!Array.isArray(raw)) {
    return { error: "temas must be an array" };
  }

  if (raw.length === 0) {
    return { error: "temas must contain at least one theme" };
  }

  const seenThemeIds = new Set<string>();
  const items: NormalizedTheme[] = [];

  for (const entry of raw) {
    if (!isPlainObject(entry)) {
      return { error: "Each theme must be an object" };
    }

    const id = String(entry.id ?? entry.theme_id ?? "").trim();
    const label = String(entry.label ?? entry.theme_label ?? "").trim();
    const semAcervo = Boolean(entry.semAcervo ?? entry.sem_acervo ?? false);
    const livrosRaw = entry.livros;

    if (!id) {
      return { error: "Each theme must have an id" };
    }
    if (!label) {
      return { error: `Theme ${id} must have a label` };
    }
    if (seenThemeIds.has(id)) {
      return { error: `Duplicate theme id: ${id}` };
    }
    if (!Array.isArray(livrosRaw)) {
      return { error: `Theme ${id} must have a livros array` };
    }

    const livros: NormalizedBook[] = [];
    const seenTitles = new Set<string>();

    for (const book of livrosRaw) {
      if (!isPlainObject(book)) {
        return { error: `Each book in theme ${id} must be an object` };
      }

      const titulo = sanitizeText(book.titulo ?? book.title);
      const autor = sanitizeText(book.autor ?? book.author);
      const editora = sanitizeText(book.editora ?? book.publisher);
      const rawQuantity = book.quantidade ?? book.quantity;
      const quantity =
        typeof rawQuantity === "number" ? rawQuantity : Number(rawQuantity);

      const isEmpty =
        !titulo && !autor && !editora && !rawQuantity && quantity === 0;
      if (isEmpty) {
        continue;
      }

      if (semAcervo) {
        return {
          error: `Theme ${id} cannot contain books when semAcervo is true`,
        };
      }
      if (!titulo || !autor || !editora) {
        return {
          error: `Book rows in theme ${id} must have titulo, autor and editora`,
        };
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        return {
          error: `Book "${titulo}" in theme ${id} must have quantidade >= 1`,
        };
      }
      if (seenTitles.has(titulo)) {
        return { error: `Duplicate title "${titulo}" in theme ${id}` };
      }

      seenTitles.add(titulo);
      livros.push({ titulo, autor, editora, quantidade: quantity });
    }

    if (!semAcervo && livros.length === 0) {
      return {
        error: `Theme ${id} must have at least one valid book row or semAcervo`,
      };
    }

    seenThemeIds.add(id);
    items.push({ id, label, semAcervo, livros });
  }

  return { items };
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const period = checkCollectionPeriod();
    if (!period.ok) {
      return Response.json(
        { error: period.error },
        { status: period.status },
      );
    }

    let payload: AnyRecord;
    try {
      const data = await req.json();
      if (!isPlainObject(data)) {
        return Response.json(
          { error: "Request body must be a JSON object" },
          { status: 400 },
        );
      }
      payload = data;
    } catch {
      return Response.json(
        { error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const matricula = parseMatricula(payload.matricula);
    if (matricula === null) {
      return Response.json(
        { error: "matricula must be a 4 or 5-digit integer" },
        { status: 400 },
      );
    }

    const whitelist = await checkWhitelist(matricula);
    if (!whitelist.ok) {
      if (whitelist.status && whitelist.status >= 500) {
        return Response.json(
          { error: "Whitelist check failed" },
          { status: 500 },
        );
      }
      if (whitelist.error && whitelist.error !== "Matrícula não autorizada") {
        return Response.json(
          { error: whitelist.error },
          {
            status:
              whitelist.status && whitelist.status >= 400
                ? whitelist.status
                : 403,
          },
        );
      }
      return Response.json(
        { error: "Matrícula não autorizada" },
        { status: 403 },
      );
    }

    const responsavel = sanitizeText(payload.responsavel);
    const cargo = typeof payload.cargo === "string" ? payload.cargo : "";
    const escola =
      typeof payload.escola === "string" ? payload.escola.trim() : "";

    if (!responsavel) {
      return Response.json(
        { error: "responsavel is required" },
        { status: 400 },
      );
    }
    if (!ALLOWED_ROLES.includes(cargo as any)) {
      return Response.json({ error: "cargo is invalid" }, { status: 400 });
    }
    if (!escola) {
      return Response.json({ error: "escola is required" }, { status: 400 });
    }

    const cdd = normalizeCdd(payload.cdd);
    if (cdd.error || !cdd.items) {
      return Response.json(
        { error: cdd.error ?? "Invalid cdd payload" },
        { status: 400 },
      );
    }

    const temas = normalizeThemes(payload.temas);
    if (temas.error || !temas.items) {
      return Response.json(
        { error: temas.error ?? "Invalid temas payload" },
        { status: 400 },
      );
    }

    const responsePayload: NormalizedResponse = {
      responsavel,
      cargo,
      matricula,
      escola,
      cdd: cdd.items,
      temas: temas.items,
    };

    const { data, error } = await ctx.supabaseAdmin
      .from("form_responses")
      .insert({
        responsavel,
        cargo,
        matricula,
        escola,
        payload: responsePayload,
      })
      .select("id, submitted_at")
      .single();

    if (error) {
      return dbError("Failed to append response", error);
    }

    return Response.json({
      success: true,
      id: data.id,
      submittedAt: data.submitted_at,
    });
  }),
};
