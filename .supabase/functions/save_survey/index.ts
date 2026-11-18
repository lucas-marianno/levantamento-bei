import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";
import {
  ALLOWED_ROLES,
  isMatriculaWhitelisted,
  isWithinCollectionPeriod,
  jsonError,
  normalizeCddItems,
  normalizeThemes,
  parseMatricula,
  readJsonBody,
  sanitizeText,
} from "../_shared/survey.ts";

function nowIso(): string {
  return new Date().toISOString();
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonError("Method not allowed", 405);
    }

    if (!isWithinCollectionPeriod()) {
      return jsonError("Survey collection period is closed", 403);
    }

    const body = await readJsonBody(req);
    if (body instanceof Response) return body;

    const matricula = parseMatricula(body.matricula);
    if (matricula === null) {
      return jsonError("matricula must be a 4 or 5-digit integer", 400);
    }

    const whitelist = await isMatriculaWhitelisted(ctx.supabaseAdmin, matricula);
    if (whitelist.error) {
      return jsonError("Whitelist lookup failed", 500);
    }
    if (!whitelist.ok) {
      return jsonError("Matrícula não autorizada", 403);
    }

    const responsavel = sanitizeText(body.responsavel);
    const cargo = typeof body.cargo === "string" ? body.cargo : "";
    const escola = typeof body.escola === "string" ? body.escola.trim() : "";

    if (!responsavel) {
      return jsonError("responsavel is required", 400);
    }
    if (!ALLOWED_ROLES.includes(cargo as any)) {
      return jsonError("cargo is invalid", 400);
    }
    if (!escola) {
      return jsonError("escola is required", 400);
    }

    const cddNormalized = normalizeCddItems(body.cdd);
    if (cddNormalized.error || !cddNormalized.items) {
      return jsonError(cddNormalized.error ?? "Invalid cdd payload", 400);
    }

    const themesNormalized = normalizeThemes(body.temas);
    if (themesNormalized.error || !themesNormalized.items) {
      return jsonError(themesNormalized.error ?? "Invalid temas payload", 400);
    }

    const cddItems = cddNormalized.items;
    const themeItems = themesNormalized.items;
    const savedAt = nowIso();

    // Upsert respondent by matricula
    const { data: existingRespondent, error: respondentSelectError } = await ctx.supabaseAdmin
      .from("respondents")
      .select("id")
      .eq("matricula", matricula)
      .maybeSingle();

    if (respondentSelectError) {
      console.error("Respondent lookup failed:", respondentSelectError);
      return jsonError("Failed to load respondent", 500);
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
        return jsonError("Failed to update respondent", 500);
      }
    } else {
      const { data: insertedRespondent, error: respondentInsertError } = await ctx.supabaseAdmin
        .from("respondents")
        .insert({ matricula, name: responsavel, role: cargo, emeb: escola })
        .select("id")
        .single();
      if (respondentInsertError || !insertedRespondent?.id) {
        console.error("Respondent insert failed:", respondentInsertError);
        return jsonError("Failed to create respondent", 500);
      }
      respondentId = insertedRespondent.id as string;
    }

    // Load existing records (including soft-deleted) for reconciliation/upsert
    const { data: existingCdd, error: cddLoadError } = await ctx.supabaseAdmin
      .from("exemplar_cdd")
      .select("id,cdd,deleted_at")
      .eq("respondent_id", respondentId);
    if (cddLoadError) {
      console.error("CDD load failed:", cddLoadError);
      return jsonError("Failed to load CDD records", 500);
    }

    const { data: existingTheme, error: themeLoadError } = await ctx.supabaseAdmin
      .from("exemplar_theme")
      .select("id,client_row_id,deleted_at")
      .eq("respondent_id", respondentId);
    if (themeLoadError) {
      console.error("Theme load failed:", themeLoadError);
      return jsonError("Failed to load theme records", 500);
    }

    const payloadCddSet = new Set(cddItems.map((i) => i.cdd));
    const payloadClientRowSet = new Set(themeItems.map((i) => i.client_row_id));

    // 1) Reconcile: soft-delete active records not present in payload
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
        return jsonError("Failed to reconcile CDD records", 500);
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
        return jsonError("Failed to reconcile theme records", 500);
      }
    }

    // 2) Upsert payload records (reactivate/update existing or insert)
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
          return jsonError(`Failed to save CDD record ${item.cdd}`, 500);
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
          return jsonError(`Failed to save CDD record ${item.cdd}`, 500);
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
          return jsonError("Failed to save theme record", 500);
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
          return jsonError("Failed to save theme record", 500);
        }
      }
    }

    return Response.json({ success: true, savedAt });
  }),
};
