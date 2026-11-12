import { V3_STORAGE_KEY } from "../config.js";

export function createDraftRepository({ key = V3_STORAGE_KEY } = {}) {
  return {
    load() {
      try {
        const rawState = localStorage.getItem(key);
        return rawState ? JSON.parse(rawState) : null;
      } catch {
        return null;
      }
    },

    save(state) {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // Storage may be unavailable or full.
      }
    },
  };
}
