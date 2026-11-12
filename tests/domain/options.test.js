import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeCddCategories,
  normalizeOptions,
  normalizeThemes,
} from "../../src/domain/options.js";

const fallback = {
  schools: ["Escola Exemplo"],
  v3: {
    initialThemeRows: 5,
    cddCategories: [{ range: "000-099", color: "", label: "Exemplo" }],
    themes: [{ id: "exemplo", label: "Tema Exemplo" }],
  },
};

test("normalizeCddCategories drops invalid items and trims fields", () => {
  assert.deepEqual(
    normalizeCddCategories([
      { range: " 000-099 ", color: " BRANCA ", label: " Generalidades " },
      { range: "", color: "AZUL", label: "Inválido" },
      null,
      { range: "100-199", label: "" },
    ]),
    [{ range: "000-099", color: "BRANCA", label: "Generalidades" }]
  );
});

test("normalizeThemes creates fallback ids and de-duplicates them", () => {
  assert.deepEqual(
    normalizeThemes([
      { id: "tema", label: "Tema" },
      { id: "tema", label: "Outro tema" },
      { label: "Terceiro tema" },
    ]),
    [
      { id: "tema", label: "Tema" },
      { id: "tema-2", label: "Outro tema" },
      { id: "tema-3", label: "Terceiro tema" },
    ]
  );
});

test("normalizeOptions falls back when optional lists are missing", () => {
  assert.deepEqual(normalizeOptions({}, fallback), fallback);
});

test("normalizeOptions applies valid values from options.json", () => {
  assert.deepEqual(
    normalizeOptions(
      {
        schools: ["Escola A"],
        v3: {
          initialThemeRows: 3,
          cddCategories: [
            { range: "100-199", color: "AMARELA", label: "Filosofia" },
          ],
          themes: [{ id: "indigena", label: "Temática Indígena" }],
        },
      },
      fallback
    ),
    {
      schools: ["Escola A"],
      v3: {
        initialThemeRows: 3,
        cddCategories: [
          { range: "100-199", color: "AMARELA", label: "Filosofia" },
        ],
        themes: [{ id: "indigena", label: "Temática Indígena" }],
      },
    }
  );
});
