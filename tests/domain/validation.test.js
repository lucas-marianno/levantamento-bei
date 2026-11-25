import test from "node:test";
import assert from "node:assert/strict";

import {
  getIdentificationValidity,
  getInvalidCddRanges,
  getThemesWithoutValidRows,
  isIdentificationValid,
} from "../../src/domain/validation.js";

test("identification validity checks all required fields", () => {
  assert.deepEqual(
    getIdentificationValidity({
      name: " José ",
      cargo: "Diretor",
      matricula: "12345",
    }),
    { name: true, cargo: true, matricula: true }
  );

  assert.deepEqual(
    getIdentificationValidity({
      name: "",
      cargo: "",
      matricula: "123",
    }),
    { name: false, cargo: false, matricula: false }
  );

  assert.equal(
    isIdentificationValid({ name: true, cargo: true, matricula: false }),
    false
  );
});

test("CDD rows are valid when marked unavailable or with a positive quantity", () => {
  assert.deepEqual(
    getInvalidCddRanges([
      { range: "000-099", quantidade: 0, semAcervo: true },
      { range: "100-199", quantidade: 3, semAcervo: false },
      { range: "200-299", quantidade: 0, semAcervo: false },
      { range: "300-399", quantidade: 1.5, semAcervo: false },
    ]),
    ["200-299", "300-399"]
  );
});

test("themes require a complete row unless they are marked without collection", () => {
  const completeBook = {
    titulo: "Livro",
    autor: "Autor",
    editora: "Editora",
    quantidade: "2",
  };

  assert.deepEqual(
    getThemesWithoutValidRows([
      {
        id: "indigena",
        label: "Temática Indígena",
        semAcervo: false,
        rows: [completeBook],
      },
      {
        id: "africana",
        label: "Temática Africana",
        semAcervo: true,
        rows: [],
      },
    ]),
    []
  );

  assert.deepEqual(
    getThemesWithoutValidRows([
      {
        id: "indigena",
        label: "Temática Indígena",
        semAcervo: false,
        rows: [{ titulo: "", autor: "", editora: "", quantidade: "" }],
      },
      {
        id: "africana",
        label: "Temática Africana",
        semAcervo: false,
        rows: [{ ...completeBook, quantidade: "" }],
      },
    ]),
    [
      { id: "indigena", label: "Temática Indígena" },
      { id: "africana", label: "Temática Africana" },
    ]
  );
});
