import { createEdgeFunctionsClient } from "./edge-functions-client.js";

export function createSurveyGateway({ supabase, functionNames } = {}) {
  const client = createEdgeFunctionsClient(supabase);
  const functions = {
    whitelist: "is_user_whitelisted",
    submitResponse: "submit_response",
    ...(functionNames || {}),
  };

  async function submitResponse(payload, options = {}) {
    return client.invoke(functions.submitResponse, payload, options);
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
    submitResponse,
    isUserWhitelisted,
  };
}
