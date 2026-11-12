import test from "node:test";
import assert from "node:assert/strict";

import { THEME_COLUMNS } from "../../src/config.js";
import {
  getInvalidColumnKeys,
  getRowState,
  isColumnValueValid,
  valuesAreEmpty,
} from "../../src/domain/rows.js";

test("valuesAreEmpty ignores whitespace-only values", () => {
  assert.equal(
    valuesAreEmpty(THEME_COLUMNS, {
      titulo: "",
      autor: "   ",
      editora: null,
      quantidade: "",
    }),
    true
  );

  assert.equal(
    valuesAreEmpty(THEME_COLUMNS, {
      titulo: "Livro",
      autor: "",
      editora: "",
      quantidade: "",
    }),
    false
  );
});

test("getInvalidColumnKeys lists required columns that are still empty", () => {
  assert.deepEqual(
    getInvalidColumnKeys(THEME_COLUMNS, {
      titulo: "Livro",
      autor: "",
      editora: "",
      quantidade: "",
    }),
    ["autor", "editora", "quantidade"]
  );
});

test("getRowState distinguishes empty, partial and complete rows", () => {
  assert.equal(
    getRowState(THEME_COLUMNS, {
      titulo: "",
      autor: "",
      editora: "",
      quantidade: "",
    }),
    "empty"
  );

  assert.equal(
    getRowState(THEME_COLUMNS, {
      titulo: "Livro",
      autor: "",
      editora: "",
      quantidade: "",
    }),
    "partial"
  );

  assert.equal(
    getRowState(THEME_COLUMNS, {
      titulo: "Livro",
      autor: "Autor",
      editora: "Editora",
      quantidade: "2",
    }),
    "complete"
  );
});

test("quantity must be a positive integer", () => {
  const quantityColumn = { key: "quantidade", type: "number", required: true };

  assert.equal(isColumnValueValid(quantityColumn, { quantidade: "0" }), false);
  assert.equal(isColumnValueValid(quantityColumn, { quantidade: "1" }), true);
  assert.equal(isColumnValueValid(quantityColumn, { quantidade: "1.5" }), false);
  assert.equal(isColumnValueValid(quantityColumn, { quantidade: "" }), false);
});
