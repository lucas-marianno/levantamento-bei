import { createEdgeFunctionsClient } from "./edge-functions-client.js";

export function createSurveyGateway({ supabase, functionNames } = {}) {
  const client = createEdgeFunctionsClient(supabase);
  const functions = {
    whitelist: "is_user_whitelisted",
    saveSurvey: "save_survey",
    deleteThemeRow: "delete_theme_row",
    ...(functionNames || {}),
  };

  async function sendSurveyToBackend(payload, options = {}) {
    return client.invoke(functions.saveSurvey, payload, options);
  }

  async function deleteBookRow(payload) {
    const matricula =
      typeof payload?.matricula === "number"
        ? payload.matricula
        : Number(String(payload?.matricula ?? "").trim());
    const clientRowId =
      payload?.clientRowId ?? payload?.rowId ?? payload?.client_row_id;

    if (!Number.isInteger(matricula) || !clientRowId) {
      return { success: false, message: "Dados insuficientes para exclusão." };
    }

    return client.invoke(functions.deleteThemeRow, {
      matricula,
      clientRowId,
    });
  }

  async function isUserWhitelisted(matricula) {
    const value =
      typeof matricula === "number"
        ? matricula
        : Number(String(matricula ?? "").trim());

    if (!Number.isInteger(value) || value < 1000 || value > 99999) {
      return false;
    }

    const data = await client.invoke(functions.whitelist, { matricula: value });
    return data === true;
  }

  return {
    sendSurveyToBackend,
    deleteBookRow,
    isUserWhitelisted,
  };
}
