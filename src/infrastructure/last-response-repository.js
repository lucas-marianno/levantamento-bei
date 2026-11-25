import { LAST_RESPONSE_STORAGE_KEY } from "../config.js";

export function createLastResponseRepository({
  key = LAST_RESPONSE_STORAGE_KEY,
} = {}) {
  return {
    load() {
      try {
        const rawState = localStorage.getItem(key);
        return rawState ? JSON.parse(rawState) : null;
      } catch {
        return null;
      }
    },

    save(entry) {
      try {
        localStorage.setItem(key, JSON.stringify(entry));
      } catch {
        // Storage may be unavailable or full.
      }
    },

    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        // Storage may be unavailable.
      }
    },
  };
}
