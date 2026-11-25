const LAST_RESPONSE_VERSION = 1;

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidSubmittedAt(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

export function normalizePayloadForComparison(payload) {
  if (!isPlainObject(payload)) {
    return null;
  }

  const cdd = Array.isArray(payload.cdd)
    ? payload.cdd
        .map((item) => ({
          range: String(item?.range ?? ""),
          color: String(item?.color ?? ""),
          label: String(item?.label ?? ""),
          quantidade: Number(item?.quantidade) || 0,
          semAcervo: Boolean(item?.semAcervo),
        }))
        .sort((a, b) => a.range.localeCompare(b.range, "pt-BR"))
    : [];

  const temas = Array.isArray(payload.temas)
    ? payload.temas
        .map((theme) => ({
          id: String(theme?.id ?? ""),
          label: String(theme?.label ?? ""),
          semAcervo: Boolean(theme?.semAcervo),
          livros: Array.isArray(theme?.livros)
            ? theme.livros
                .map((book) => ({
                  titulo: String(book?.titulo ?? ""),
                  autor: String(book?.autor ?? ""),
                  editora: String(book?.editora ?? ""),
                  quantidade: Number(book?.quantidade) || 0,
                }))
                .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"))
            : [],
        }))
        .sort((a, b) => a.id.localeCompare(b.id, "pt-BR"))
    : [];

  return {
    responsavel: String(payload.responsavel ?? ""),
    cargo: String(payload.cargo ?? ""),
    matricula: Number(payload.matricula) || 0,
    escola: String(payload.escola ?? ""),
    cdd,
    temas,
  };
}

function serializePayload(payload) {
  const normalized = normalizePayloadForComparison(payload);
  return normalized ? JSON.stringify(normalized) : null;
}

export function createLastResponse({ payload, submittedAt, id } = {}) {
  const normalizedPayload = normalizePayloadForComparison(payload) || {};

  return {
    version: LAST_RESPONSE_VERSION,
    id: typeof id === "string" && id ? id : null,
    submittedAt: isValidSubmittedAt(submittedAt)
      ? submittedAt
      : new Date().toISOString(),
    escola: String(payload?.escola ?? ""),
    payload: normalizedPayload,
  };
}

export function isLastResponseValid(entry) {
  return (
    isPlainObject(entry) &&
    entry.version === LAST_RESPONSE_VERSION &&
    isValidSubmittedAt(entry.submittedAt) &&
    typeof entry.escola === "string" &&
    entry.escola.trim() !== "" &&
    isPlainObject(entry.payload)
  );
}

export function payloadMatchesLastResponse(payload, lastResponse) {
  if (!isLastResponseValid(lastResponse)) {
    return false;
  }

  const current = serializePayload(payload);
  const saved = serializePayload(lastResponse.payload);

  return current !== null && saved !== null && current === saved;
}

export function formatSubmittedAt(value) {
  if (!isValidSubmittedAt(value)) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
