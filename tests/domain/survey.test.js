import test from "node:test";
import assert from "node:assert/strict";

import { buildSurveyPayloadV3 } from "../../src/domain/survey.js";

test("buildSurveyPayloadV3 sanitizes the name and filters empty book rows", () => {
  const payload = buildSurveyPayloadV3({
    form: {
      responsavel: "  josé  da silva ",
      cargo: "Diretor",
      matricula: "12345",
    },
    school: "Escola A",
    cdd: [{ range: "000-099", quantidade: 1, semAcervo: false }],
    themes: [
      {
        id: "indigena",
        label: "Temática Indígena",
        semAcervo: false,
        rows: [
          {
            titulo: "Livro",
            autor: "Autor",
            editora: "Editora",
            quantidade: "2",
          },
          { titulo: "", autor: "", editora: "", quantidade: "" },
        ],
      },
    ],
  });

  assert.deepEqual(payload, {
    responsavel: "JOSE DA SILVA",
    cargo: "Diretor",
    matricula: 12345,
    escola: "Escola A",
    cdd: [{ range: "000-099", quantidade: 1, semAcervo: false }],
    temas: [
      {
        id: "indigena",
        label: "Temática Indígena",
        semAcervo: false,
        livros: [
          {
            titulo: "Livro",
            autor: "Autor",
            editora: "Editora",
            quantidade: 2,
          },
        ],
      },
    ],
  });
});

test("buildSurveyPayloadV3 keeps themes with no filled rows", () => {
  const payload = buildSurveyPayloadV3({
    form: { responsavel: "Maria", cargo: "Diretor", matricula: "12345" },
    school: "Escola A",
    cdd: [],
    themes: [
      {
        id: "africana",
        label: "Temática Africana",
        semAcervo: false,
        rows: [{ titulo: "", autor: "", editora: "", quantidade: "" }],
      },
    ],
  });

  assert.deepEqual(payload.temas, [
    {
      id: "africana",
      label: "Temática Africana",
      semAcervo: false,
      livros: [],
    },
  ]);
});

test("buildSurveyPayloadV3 omits books when a theme has no collection", () => {
  const payload = buildSurveyPayloadV3({
    form: { responsavel: "Maria", cargo: "Diretor", matricula: "12345" },
    school: "Escola A",
    cdd: [],
    themes: [
      {
        id: "africana",
        label: "Temática Africana",
        semAcervo: true,
        rows: [
          {
            titulo: "Livro",
            autor: "Autor",
            editora: "Editora",
            quantidade: "2",
          },
        ],
      },
    ],
  });

  assert.deepEqual(payload.temas, [
    {
      id: "africana",
      label: "Temática Africana",
      semAcervo: true,
      livros: [],
    },
  ]);
});
