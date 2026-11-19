export function createEdgeFunctionsClient({ url, publishableKey } = {}) {
  const baseUrl = String(url || "").replace(/\/$/, "");
  const key = String(publishableKey || "");

  return {
    async invoke(functionName, body, { signal } = {}) {
      if (!baseUrl || !key) {
        throw new Error("Configuração do Supabase ausente.");
      }
      if (!functionName) {
        throw new Error("Nome da função ausente.");
      }

      console.debug("[edge-client] invoke", {
        functionName,
        baseUrl,
        hasKey: key.length > 0,
      });

      const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
        signal,
      });

      console.debug("[edge-client] response", {
        functionName,
        status: response.status,
      });

      let data = null;
      const contentType = response.headers.get("content-type") || "";
      try {
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          data = await response.text();
        }
      } catch {
        data = null;
      }

      if (!response.ok) {
        const message =
          (data &&
            typeof data === "object" &&
            (data.error || data.message)) ||
          `Erro HTTP ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    },
  };
}
