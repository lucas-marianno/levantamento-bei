import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type AnyRecord = Record<string, unknown>;

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

    const clientRowId = String(
      payload.clientRowId ?? payload.client_row_id ?? payload.rowId ?? "",
    ).trim();
    if (!clientRowId) {
      return Response.json({ error: "clientRowId/rowId is required" }, { status: 400 });
    }

    const whitelist = await checkWhitelist(matricula);
    if (!whitelist.ok) {
      if (whitelist.status && whitelist.status >= 500) {
        return Response.json({ error: "Whitelist check failed" }, { status: 500 });
      }
      if (whitelist.error && whitelist.error !== "Matrícula não autorizada") {
        return Response.json(
          { error: whitelist.error },
          { status: whitelist.status && whitelist.status >= 400 ? whitelist.status : 403 },
        );
      }
      return Response.json({ error: "Matrícula não autorizada" }, { status: 403 });
    }

    const { data: respondent, error: respondentError } = await ctx.supabaseAdmin
      .from("respondents")
      .select("id")
      .eq("matricula", matricula)
      .maybeSingle();

    if (respondentError) {
      console.error("Respondent lookup failed:", respondentError);
      return Response.json({ error: "Failed to load respondent" }, { status: 500 });
    }

    // Nothing to delete for an unknown respondent; treat as idempotent success.
    if (!respondent?.id) {
      return Response.json({ success: true, deleted: false });
    }

    const deletedAt = new Date().toISOString();
    const { data, error } = await ctx.supabaseAdmin
      .from("exemplar_theme")
      .update({ deleted_at: deletedAt })
      .eq("respondent_id", respondent.id)
      .eq("client_row_id", clientRowId)
      .is("deleted_at", null)
      .select("id");

    if (error) {
      console.error("Theme delete failed:", error);
      return Response.json({ error: "Failed to delete theme record" }, { status: 500 });
    }

    return Response.json({
      success: true,
      deleted: Array.isArray(data) && data.length > 0,
    });
  }),
};
