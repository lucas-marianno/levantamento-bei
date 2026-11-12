import { FALLBACK_OPTIONS, OPTIONS_URL } from "../config.js";
import { normalizeOptions } from "../domain/options.js";

export function createOptionsRepository({
  url = OPTIONS_URL,
  fallbackOptions = FALLBACK_OPTIONS,
} = {}) {
  return {
    async load() {
      try {
        const response = await fetch(url, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        return normalizeOptions(data, fallbackOptions);
      } catch (error) {
        console.warn(
          "Não foi possível carregar data/options.json. Usando dados de exemplo.",
          error
        );
        return { ...fallbackOptions };
      }
    },
  };
}
