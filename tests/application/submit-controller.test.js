import test from "node:test";
import assert from "node:assert/strict";

import { createSubmitController } from "../../src/presentation/submit-controller.js";
import { SUBMIT_IN_PROGRESS_LABEL, SUBMIT_LABEL } from "../../src/config.js";

function createHarness({ ensureWhitelistChecked, isValid = () => true } = {}) {
  const submitButton = {
    disabled: false,
    textContent: SUBMIT_LABEL,
    addEventListener() {},
  };
  const messages = [];
  const feedback = {
    hide() {},
    show(message, type, reason) {
      messages.push({ message, type, reason });
    },
  };
  let submitCalls = 0;
  let draftSaves = 0;

  const identification = {
    sanitizeName() {},
    markAllTouched() {},
    updateState() {},
    isValid,
    getSchool: () => "Escola A",
    getFormValues: () => ({
      responsavel: "MARIA",
      cargo: "Diretor",
      matricula: "12345",
    }),
  };

  if (ensureWhitelistChecked) {
    identification.ensureWhitelistChecked = ensureWhitelistChecked;
  }

  const cddForm = {
    clearFlags() {},
    validate: () => [],
    scrollToFirstInvalid() {},
    getValues: () => [],
  };

  const themeBlocks = {
    sanitizeTextFields() {},
    clearFlags() {},
    collectPartialGroups: () => [],
    collectDuplicateTitleGroups: () => [],
    collectEmptyGroups: () => [],
    getThemesForPayload: () => [],
    markEmptyThemes() {},
  };

  const controller = createSubmitController({
    identification,
    cddForm,
    themeBlocks,
    feedback,
    submitButton,
    gateway: {
      async submitResponse() {
        submitCalls += 1;
        return { success: true };
      },
    },
    onPersistDraft() {
      draftSaves += 1;
    },
  });

  return {
    controller,
    submitButton,
    messages,
    getSubmitCalls: () => submitCalls,
    getDraftSaves: () => draftSaves,
  };
}

test("shows in-progress button state while the first whitelist check is pending", async () => {
  let resolveWhitelist;
  const harness = createHarness({
    ensureWhitelistChecked: () =>
      new Promise((resolve) => {
        resolveWhitelist = resolve;
      }),
  });

  const pending = harness.controller.handleSubmit();

  assert.equal(harness.submitButton.disabled, true);
  assert.equal(harness.submitButton.textContent, SUBMIT_IN_PROGRESS_LABEL);
  assert.equal(harness.getSubmitCalls(), 0);

  resolveWhitelist(true);
  await pending;

  assert.equal(harness.submitButton.disabled, false);
  assert.equal(harness.submitButton.textContent, SUBMIT_LABEL);
  assert.equal(harness.getSubmitCalls(), 1);
  assert.equal(harness.messages.at(-1).message, "Resposta enviada com sucesso.");
});

test("restores the button after a validation failure", async () => {
  const harness = createHarness({ isValid: () => false });

  await harness.controller.handleSubmit();

  assert.equal(harness.submitButton.disabled, false);
  assert.equal(harness.submitButton.textContent, SUBMIT_LABEL);
  assert.equal(harness.getSubmitCalls(), 0);
  assert.match(harness.messages.at(-1).message, /Preencha corretamente/);
});
