import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const ALLOWED_ROLES = [
  "Oficial de Escola",
  "Funcionário Readaptado",
  "Diretor",
  "Vice-diretor",
  "Coordenador",
] as const;

const COLLECTION_START = "2026-11-30";
const COLLECTION_END = "2027-02-28";

type AnyRecord = Record<string, unknown>;

interface NormalizedCddItem {
  cdd: string;
  label_color: string;
  label: string;
  quantity: number;
  is_na: boolean;
}

interface NormalizedThemeItem {
  client_row_id: string;
  theme_id: string;
  theme_label: string;
  title: string;
  author: string;
  publisher: string;
  quantity: number;
}

function sanitizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isPlainObject(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMatricula(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : NaN;

  if (!Number.isInteger(n) || n < 1000 || n > 99999) {
    return null;
  }
  return n;
}

function isWithinCollectionPeriod(now = new Date()): boolean {
  const day = now.toISOString().slice(0, 10);
  return day >= COLLECTION_START && day <= COLLECTION_END;
}

function normalizeCddItems(
  raw: unknown,
): { items?: NormalizedCddItem[]; error?: string } {
  if (!Array.isArray(raw)) {
    return { error: "cdd must be an array" };
  }

  const seen = new Set<string>();
  const items: NormalizedCddItem[] = [];

  for (const entry of raw) {
    if (!isPlainObject(entry)) {
      return { error: "Each cdd item must be an object" };
    }

    const cdd = String(entry.range ?? entry.cdd ?? "").trim();
    const labelColor = String(entry.color ?? entry.label_color ?? "").trim();
    const label = String(entry.label ?? "").trim();
    const isNa = Boolean(entry.semAcervo ?? entry.is_na);
    const rawQty = entry.quantidade ?? entry.quantity ?? 0;
    const quantity = typeof rawQty === "number" ? rawQty : Number(rawQty);

    if (!cdd) {
      return { error: "Each cdd item must have a range/cdd" };
    }
    if (seen.has(cdd)) {
      return { error: `Duplicate cdd range: ${cdd}` };
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      return { error: `Invalid quantity for cdd ${cdd}` };
    }
    if (!isNa && quantity < 1) {
      return { error: `cdd ${cdd} requires quantity >= 1 or semAcervo` };
    }

    seen.add(cdd);
    items.push({
      cdd,
      label_color: labelColor,
      label,
      quantity: isNa ? 0 : quantity,
      is_na: isNa,
    });
  }

  return { items };
}

function normalizeThemes(
  raw: unknown,
): { items?: NormalizedThemeItem[]; error?: string } {
  if (!Array.isArray(raw)) {
    return { error: "temas must be an array" };
  }

  const items: NormalizedThemeItem[] = [];
  const seenClientIds = new Set<string>();
  const seenTitlePerTheme = new Set<string>();

  for (const themeEntry of raw) {
    if (!isPlainObject(themeEntry)) {
      return { error: "Each theme entry must be an object" };
    }

    const themeId = String(themeEntry.id ?? themeEntry.theme_id ?? "").trim();
    const themeLabel = String(themeEntry.label ?? themeEntry.theme_label ?? "").trim();
    const livros = themeEntry.livros;

    if (!themeId) {
      return { error: "Each theme must have an id" };
    }
    if (!Array.isArray(livros)) {
      return { error: `Theme ${themeId} must have a livros array` };
    }

    for (const book of livros) {
      if (!isPlainObject(book)) {
        return { error: `Each book in theme ${themeId} must be an object` };
      }

      const clientRowId = String(
        book.rowId ?? book.client_row_id ?? book.clientRowId ?? "",
      ).trim();
      const title = sanitizeText(book.titulo ?? book.title);
      const author = sanitizeText(book.autor ?? book.author);
      const publisher = sanitizeText(book.editora ?? book.publisher);
      const rawQty = book.quantidade ?? book.quantity;
      const quantity = typeof rawQty === "number" ? rawQty : Number(rawQty);

      // Skip completely empty rows defensively
      if (!clientRowId && !title && !author && !publisher && (!rawQty || Number(rawQty) === 0)) {
        continue;
      }

      if (!clientRowId) {
        return { error: `Each book in theme ${themeId} must have a rowId` };
      }
      if (seenClientIds.has(clientRowId)) {
        return { error: `Duplicate book rowId: ${clientRowId}` };
      }
      if (!title || !author || !publisher) {
        return { error: `Book rows in theme ${themeId} must have title, author, and publisher` };
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        return { error: `Book "${title}" in theme ${themeId} must have quantity >= 1` };
      }

      const titleKey = `${themeId}::${title}`;
      if (seenTitlePerTheme.has(titleKey)) {
        return { error: `Duplicate active title "${title}" in theme ${themeId}` };
      }

      seenClientIds.add(clientRowId);
      seenTitlePerTheme.add(titleKey);
      items.push({
        client_row_id: clientRowId,
        theme_id: themeId,
        theme_label: themeLabel,
        title,
        author,
        publisher,
        quantity,
      });
    }
  }

  return { items };
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
    const response = await fetch(`${supabaseUrl}/functions/v1/quick-processor`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ matricula }),
    });

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

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    if (!isWithinCollectionPeriod()) {
      return Response.json({ error: "Survey collection period is closed" }, { status: 403 });
    }

    let payload: AnyRecord;
    try {
      const data = await req.json();
      if (!isPlainObject(data)) {
        return Response.json({ error: "Request body must be a JSON object" }, { status: 400 });
      }
      payload = data;
    } catch {
      return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
    }

    const matricula = parseMatricula(payload.matricula);
    if (matricula === null) {
      return Response.json({ error: "matricula must be a 4 or 5-digit integer" }, { status: 400 });
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
          { status: whitelist.status && whitelist.status >= 400 ? whitelist.status : 403 },
        );
      }
      return Response.json(
        { error: "Matrícula não autorizada" },
        { status: 403 },
      );
    }

    const responsavel = sanitizeText(payload.responsavel);
    const cargo = typeof payload.cargo === "string" ? payload.cargo : "";
    const escola = typeof payload.escola === "string" ? payload.escola.trim() : "";

    if (!responsavel) {
      return Response.json({ error: "responsavel is required" }, { status: 400 });
    }
    if (!ALLOWED_ROLES.includes(cargo as any)) {
      return Response.json({ error: "cargo is invalid" }, { status: 400 });
    }
    if (!escola) {
      return Response.json({ error: "escola is required" }, { status: 400 });
    }

    const cddNormalized = normalizeCddItems(payload.cdd);
    if (cddNormalized.error || !cddNormalized.items) {
      return Response.json({ error: cddNormalized.error ?? "Invalid cdd payload" }, { status: 400 });
    }

    const themesNormalized = normalizeThemes(payload.temas);
    if (themesNormalized.error || !themesNormalized.items) {
      return Response.json({ error: themesNormalized.error ?? "Invalid temas payload" }, { status: 400 });
    }

    const cddItems = cddNormalized.items;
    const themeItems = themesNormalized.items;
    const savedAt = new Date().toISOString();

    // Upsert respondent by matricula
    const { data: existingRespondent, error: respondentSelectError } = await ctx.supabaseAdmin
      .from("respondents")
      .select("id")
      .eq("matricula", matricula)
      .maybeSingle();

    if (respondentSelectError) {
      console.error("Respondent lookup failed:", respondentSelectError);
      return Response.json({ error: "Failed to load respondent" }, { status: 500 });
    }

    let respondentId: string;
    if (existingRespondent?.id) {
      respondentId = existingRespondent.id as string;
      const { error: respondentUpdateError } = await ctx.supabaseAdmin
        .from("respondents")
        .update({ name: responsavel, role: cargo, emeb: escola })
        .eq("id", respondentId);
      if (respondentUpdateError) {
        console.error("Respondent update failed:", respondentUpdateError);
        return Response.json({ error: "Failed to update respondent" }, { status: 500 });
      }
    } else {
      const { data: insertedRespondent, error: respondentInsertError } = await ctx.supabaseAdmin
        .from("respondents")
        .insert({ matricula, name: responsavel, role: cargo, emeb: escola })
        .select("id")
        .single();
      if (respondentInsertError || !insertedRespondent?.id) {
        console.error("Respondent insert failed:", respondentInsertError);
        return Response.json({ error: "Failed to create respondent" }, { status: 500 });
      }
      respondentId = insertedRespondent.id as string;
    }

    const { data: existingCdd, error: cddLoadError } = await ctx.supabaseAdmin
      .from("exemplar_cdd")
      .select("id,cdd,deleted_at")
      .eq("respondent_id", respondentId);
    if (cddLoadError) {
      console.error("CDD load failed:", cddLoadError);
      return Response.json({ error: "Failed to load CDD records" }, { status: 500 });
    }

    const { data: existingTheme, error: themeLoadError } = await ctx.supabaseAdmin
      .from("exemplar_theme")
      .select("id,client_row_id,deleted_at")
      .eq("respondent_id", respondentId);
    if (themeLoadError) {
      console.error("Theme load failed:", themeLoadError);
      return Response.json({ error: "Failed to load theme records" }, { status: 500 });
    }

    const payloadCddSet = new Set(cddItems.map((i) => i.cdd));
    const payloadClientRowSet = new Set(themeItems.map((i) => i.client_row_id));

    // Reconcile: soft-delete active records not present in payload
    const cddIdsToDelete = (existingCdd ?? [])
      .filter((row: any) => row.deleted_at === null && !payloadCddSet.has(row.cdd))
      .map((row: any) => row.id);
    if (cddIdsToDelete.length > 0) {
      const { error } = await ctx.supabaseAdmin
        .from("exemplar_cdd")
        .update({ deleted_at: savedAt })
        .in("id", cddIdsToDelete);
      if (error) {
        console.error("CDD reconcile failed:", error);
        return Response.json({ error: "Failed to reconcile CDD records" }, { status: 500 });
      }
    }

    const themeIdsToDelete = (existingTheme ?? [])
      .filter((row: any) => row.deleted_at === null && !payloadClientRowSet.has(row.client_row_id))
      .map((row: any) => row.id);
    if (themeIdsToDelete.length > 0) {
      const { error } = await ctx.supabaseAdmin
        .from("exemplar_theme")
        .update({ deleted_at: savedAt })
        .in("id", themeIdsToDelete);
      if (error) {
        console.error("Theme reconcile failed:", error);
        return Response.json({ error: "Failed to reconcile theme records" }, { status: 500 });
      }
    }

    // Upsert payload records (reactivate/update existing or insert)
    const existingCddByRange = new Map<string, any>();
    for (const row of existingCdd ?? []) {
      if (!existingCddByRange.has(row.cdd)) existingCddByRange.set(row.cdd, row);
    }

    for (const item of cddItems) {
      const existing = existingCddByRange.get(item.cdd);
      if (existing?.id) {
        const { error } = await ctx.supabaseAdmin
          .from("exemplar_cdd")
          .update({
            label_color: item.label_color,
            label: item.label,
            quantity: item.quantity,
            is_na: item.is_na,
            deleted_at: null,
          })
          .eq("id", existing.id);
        if (error) {
          console.error("CDD upsert(update) failed:", error, item.cdd);
          return Response.json({ error: `Failed to save CDD record ${item.cdd}` }, { status: 500 });
        }
      } else {
        const { error } = await ctx.supabaseAdmin.from("exemplar_cdd").insert({
          respondent_id: respondentId,
          cdd: item.cdd,
          label_color: item.label_color,
          label: item.label,
          quantity: item.quantity,
          is_na: item.is_na,
          deleted_at: null,
        });
        if (error) {
          console.error("CDD upsert(insert) failed:", error, item.cdd);
          return Response.json({ error: `Failed to save CDD record ${item.cdd}` }, { status: 500 });
        }
      }
    }

    const existingThemeByClientId = new Map<string, any>();
    for (const row of existingTheme ?? []) {
      if (!existingThemeByClientId.has(row.client_row_id)) {
        existingThemeByClientId.set(row.client_row_id, row);
      }
    }

    for (const item of themeItems) {
      const existing = existingThemeByClientId.get(item.client_row_id);
      if (existing?.id) {
        const { error } = await ctx.supabaseAdmin
          .from("exemplar_theme")
          .update({
            theme_id: item.theme_id,
            theme_label: item.theme_label,
            title: item.title,
            author: item.author,
            publisher: item.publisher,
            quantity: item.quantity,
            deleted_at: null,
          })
          .eq("id", existing.id);
        if (error) {
          console.error("Theme upsert(update) failed:", error, item.client_row_id);
          return Response.json({ error: "Failed to save theme record" }, { status: 500 });
        }
      } else {
        const { error } = await ctx.supabaseAdmin.from("exemplar_theme").insert({
          respondent_id: respondentId,
          client_row_id: item.client_row_id,
          theme_id: item.theme_id,
          theme_label: item.theme_label,
          title: item.title,
          author: item.author,
          publisher: item.publisher,
          quantity: item.quantity,
          deleted_at: null,
        });
        if (error) {
          console.error("Theme upsert(insert) failed:", error, item.client_row_id);
          return Response.json({ error: "Failed to save theme record" }, { status: 500 });
        }
      }
    }

    return Response.json({ success: true, savedAt });
  }),
};
