import test from "node:test";
import assert from "node:assert/strict";

import {
  createLastResponse,
  formatSubmittedAt,
  isLastResponseValid,
  normalizePayloadForComparison,
  payloadMatchesLastResponse,
} from "../../src/domain/last-response.js";

const SUBMITTED_AT = "2026-11-25T12:00:00.000Z";

function makePayload() {
  return {
    responsavel: "MARIA",
    cargo: "Diretor",
    matricula: 12345,
    escola: "EMEB A",
    cdd: [
      {
        range: "100-199",
        color: "AMARELA",
        label: "Filosofia",
        quantidade: 0,
        semAcervo: true,
      },
      {
        range: "000-099",
        color: "BRANCA",
        label: "Generalidades",
        quantidade: 2,
        semAcervo: false,
      },
    ],
    temas: [
      {
        id: "africana",
        label: "Temática Africana",
        semAcervo: false,
        livros: [
          {
            titulo: "Zebra",
            autor: "Autor Z",
            editora: "Editora Z",
            quantidade: 1,
          },
          {
            titulo: "Amigo",
            autor: "Autor A",
            editora: "Editora A",
            quantidade: 3,
          },
        ],
      },
      {
        id: "indigena",
        label: "Temática Indígena",
        semAcervo: true,
        livros: [],
      },
    ],
  };
}

test("createLastResponse stores a normalized payload and valid timestamp", () => {
  const entry = createLastResponse({
    payload: makePayload(),
    submittedAt: SUBMITTED_AT,
    id: "response-id",
  });

  assert.equal(entry.version, 1);
  assert.equal(entry.id, "response-id");
  assert.equal(entry.submittedAt, SUBMITTED_AT);
  assert.equal(entry.escola, "EMEB A");
  assert.equal(entry.payload.cdd[0].range, "000-099");
  assert.equal(entry.payload.temas[0].id, "africana");
  assert.equal(entry.payload.temas[0].livros[0].titulo, "Amigo");
  assert.ok(isLastResponseValid(entry));
});

test("createLastResponse falls back to the current time for invalid timestamps", () => {
  const before = Date.now();
  const entry = createLastResponse({
    payload: makePayload(),
    submittedAt: "not-a-date",
  });
  const after = Date.now();
  const timestamp = new Date(entry.submittedAt).getTime();

  assert.ok(timestamp >= before);
  assert.ok(timestamp <= after);
});

test("isLastResponseValid rejects malformed entries", () => {
  assert.equal(isLastResponseValid(null), false);
  assert.equal(isLastResponseValid({}), false);
  assert.equal(
    isLastResponseValid({
      version: 1,
      submittedAt: SUBMITTED_AT,
      escola: "",
      payload: {},
    }),
    false
  );
  assert.equal(
    isLastResponseValid({
      version: 99,
      submittedAt: SUBMITTED_AT,
      escola: "EMEB A",
      payload: {},
    }),
    false
  );
});

test("payloadMatchesLastResponse ignores row ids and array order", () => {
  const payload = makePayload();
  const entry = createLastResponse({ payload, submittedAt: SUBMITTED_AT });
  const reordered = {
    ...payload,
    cdd: [...payload.cdd].reverse(),
    temas: payload.temas.map((theme) => ({
      ...theme,
      livros: [
        ...theme.livros.map((book) => ({ ...book, rowId: "local-row-id" })),
      ].reverse(),
    })),
  };

  assert.equal(payloadMatchesLastResponse(reordered, entry), true);
});

test("payloadMatchesLastResponse detects changed answers", () => {
  const payload = makePayload();
  const entry = createLastResponse({ payload, submittedAt: SUBMITTED_AT });
  const changed = {
    ...payload,
    temas: payload.temas.map((theme) =>
      theme.id === "indigena" ? { ...theme, semAcervo: false } : theme
    ),
  };

  assert.equal(payloadMatchesLastResponse(changed, entry), false);
  assert.equal(payloadMatchesLastResponse(payload, null), false);
});

test("normalizePayloadForComparison returns null for non-objects", () => {
  assert.equal(normalizePayloadForComparison(null), null);
  assert.equal(normalizePayloadForComparison([]), null);
});

test("formatSubmittedAt uses the pt-BR short date and time", () => {
  assert.match(formatSubmittedAt(SUBMITTED_AT), /\d{2}\/\d{2}\/\d{4}/);
  assert.match(formatSubmittedAt(SUBMITTED_AT), /\d{2}:\d{2}/);
  assert.equal(formatSubmittedAt("invalid"), "");
});
