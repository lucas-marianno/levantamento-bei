import { V3_DRAFT_VERSION } from "../config.js";

export function buildDraft({ form, school, cdd, themes }) {
  return {
    version: V3_DRAFT_VERSION,
    form,
    school,
    cdd,
    themes,
  };
}
