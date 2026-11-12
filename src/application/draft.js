import { V3_DRAFT_VERSION } from "../config.js";

export function buildDraft({ form, school, cdd, cddMeta, themes }) {
  return {
    version: V3_DRAFT_VERSION,
    form,
    school,
    cdd,
    cddMeta,
    themes,
  };
}
