export const ALLOWED_ROLES = [
  "Oficial de Escola",
  "Funcionário Readaptado",
  "Diretor",
  "Vice-diretor",
  "Coordenador",
] as const;

export const COLLECTION_START = "2026-11-30";
export const COLLECTION_END = "2027-02-28";

export function sanitizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ success: false, error: message }, { status });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown> | Response> {
  try {
    const data = await req.json();
    if (!isPlainObject(data)) {
      return jsonError("Request body must be a JSON object", 400);
    }
    return data;
  } catch {
    return jsonError("Request body must be valid JSON", 400);
  }
}

export function parseMatricula(value: unknown): number | null {
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

export function isWithinCollectionPeriod(now = new Date()): boolean {
  const day = now.toISOString().slice(0, 10);
  return day >= COLLECTION_START && day <= COLLECTION_END;
}

export async function isMatriculaWhitelisted(
  supabaseAdmin: { from: (table: string) => any },
  matricula: number,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from("user_whitelist")
    .select("MATRICULA")
    .eq("MATRICULA", matricula)
    .maybeSingle();

  if (error) {
    console.error("Whitelist lookup failed:", error);
    return { ok: false, error: "Whitelist lookup failed" };
  }

  return { ok: data !== null };
}

export function normalizeCddItems(raw: unknown): {
  items?: Array<{
    cdd: string;
    label_color: string;
    label: string;
    quantity: number;
    is_na: boolean;
  }>;
  error?: string;
} {
  if (!Array.isArray(raw)) {
    return { error: "cdd must be an array" };
  }

  const seen = new Set<string>();
  const items: Array<{
    cdd: string;
    label_color: string;
    label: string;
    quantity: number;
    is_na: boolean;
  }> = [];

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

export function normalizeThemes(raw: unknown): {
  items?: Array<{
    client_row_id: string;
    theme_id: string;
    theme_label: string;
    title: string;
    author: string;
    publisher: string;
    quantity: number;
  }>;
  error?: string;
} {
  if (!Array.isArray(raw)) {
    return { error: "temas must be an array" };
  }

  const items: Array<{
    client_row_id: string;
    theme_id: string;
    theme_label: string;
    title: string;
    author: string;
    publisher: string;
    quantity: number;
  }> = [];
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

      // Skip completely empty rows defensively (payload should already exclude them)
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
