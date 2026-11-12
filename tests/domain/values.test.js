import test from "node:test";
import assert from "node:assert/strict";

import {
  formatRowNumbers,
  formatSavedAt,
  onlyDigits,
  sanitizeText,
} from "../../src/domain/values.js";

test("sanitizeText uppercases, removes accents and collapses whitespace", () => {
  assert.equal(sanitizeText("  José   da Silva "), "JOSE DA SILVA");
  assert.equal(sanitizeText("Língua  e Linguagem"), "LINGUA E LINGUAGEM");
  assert.equal(sanitizeText(null), "");
});

test("onlyDigits keeps at most the requested number of digits", () => {
  assert.equal(onlyDigits("12a3456", 5), "12345");
  assert.equal(onlyDigits("abc", 5), "");
  assert.equal(onlyDigits("123", 5), "123");
});

test("formatRowNumbers formats one, two or many row numbers", () => {
  assert.equal(formatRowNumbers([3]), "3");
  assert.equal(formatRowNumbers([1, 2]), "1 e 2");
  assert.equal(formatRowNumbers([1, 2, 3]), "1, 2 e 3");
});

test("formatSavedAt rejects invalid timestamps", () => {
  assert.equal(formatSavedAt("not-a-date"), "");
});
