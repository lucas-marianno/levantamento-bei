import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";
import {
  isMatriculaWhitelisted,
  jsonError,
  parseMatricula,
  readJsonBody,
} from "../_shared/survey.ts";

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonError("Method not allowed", 405);
    }

    const body = await readJsonBody(req);
    if (body instanceof Response) return body;

    const matricula = parseMatricula(body.matricula);
    if (matricula === null) {
      return jsonError("matricula must be a 4 or 5-digit integer", 400);
    }

    const clientRowId = String(
      body.clientRowId ?? body.client_row_id ?? body.rowId ?? "",
    ).trim();
    if (!clientRowId) {
      return jsonError("clientRowId/rowId is required", 400);
    }

    const whitelist = await isMatriculaWhitelisted(ctx.supabaseAdmin, matricula);
    if (whitelist.error) {
      return jsonError("Whitelist lookup failed", 500);
    }
    if (!whitelist.ok) {
      return jsonError("Matrícula não autorizada", 403);
    }

    const { data: respondent, error: respondentError } = await ctx.supabaseAdmin
      .from("respondents")
      .select("id")
      .eq("matricula", matricula)
      .maybeSingle();

    if (respondentError) {
      console.error("Respondent lookup failed:", respondentError);
      return jsonError("Failed to load respondent", 500);
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
      return jsonError("Failed to delete theme record", 500);
    }

    return Response.json({ success: true, deleted: Array.isArray(data) && data.length > 0 });
  }),
};
