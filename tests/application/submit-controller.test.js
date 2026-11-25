import test from "node:test";
import assert from "node:assert/strict";

import { createLastResponse } from "../../src/domain/last-response.js";
import { createSubmitController } from "../../src/presentation/submit-controller.js";
import { SUBMIT_IN_PROGRESS_LABEL, SUBMIT_LABEL } from "../../src/config.js";

const SUBMITTED_AT = "2026-11-25T12:00:00.000Z";

function createHarness({
  ensureWhitelistChecked,
  isValid = () => true,
  lastResponse = null,
  submitResult = {
    success: true,
    id: "00000000-0000-0000-0000-000000000001",
    submittedAt: SUBMITTED_AT,
  },
} = {}) {
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
  let whitelistChecks = 0;
  let draftSaves = 0;
  let storedResponse = lastResponse;
  const savedEntries = [];
  const dialogShows = [];

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
    identification.ensureWhitelistChecked = async () => {
      whitelistChecks += 1;
      return ensureWhitelistChecked();
    };
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
        return submitResult;
      },
    },
    onPersistDraft() {
      draftSaves += 1;
    },
    lastResponseRepository: {
      load: () => storedResponse,
      save(entry) {
        storedResponse = entry;
        savedEntries.push(entry);
      },
    },
    sentResponseDialog: {
      show(options) {
        dialogShows.push(options);
      },
    },
  });

  return {
    controller,
    submitButton,
    messages,
    getSubmitCalls: () => submitCalls,
    getWhitelistChecks: () => whitelistChecks,
    getDraftSaves: () => draftSaves,
    getSavedEntries: () => savedEntries,
    getDialogShows: () => dialogShows,
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

test("stores the submitted response and opens the success dialog", async () => {
  const harness = createHarness();

  await harness.controller.handleSubmit();

  const [entry] = harness.getSavedEntries();
  assert.equal(entry.escola, "Escola A");
  assert.equal(entry.submittedAt, SUBMITTED_AT);
  assert.equal(entry.id, "00000000-0000-0000-0000-000000000001");
  assert.deepEqual(entry.payload, {
    responsavel: "MARIA",
    cargo: "Diretor",
    matricula: 12345,
    escola: "Escola A",
    cdd: [],
    temas: [],
  });
  assert.deepEqual(harness.getDialogShows(), [
    { escola: "Escola A", submittedAt: SUBMITTED_AT },
  ]);
});

test("skips all backend calls and shows the unchanged dialog for no-op resubmits", async () => {
  const payload = {
    responsavel: "MARIA",
    cargo: "Diretor",
    matricula: 12345,
    escola: "Escola A",
    cdd: [],
    temas: [],
  };
  const harness = createHarness({
    lastResponse: createLastResponse({ payload, submittedAt: SUBMITTED_AT }),
    ensureWhitelistChecked: () => true,
  });

  await harness.controller.handleSubmit();

  assert.equal(harness.getWhitelistChecks(), 0);
  assert.equal(harness.getSubmitCalls(), 0);
  assert.equal(harness.getSavedEntries().length, 0);
  assert.deepEqual(harness.getDialogShows(), [
    { escola: "Escola A", submittedAt: SUBMITTED_AT, unchanged: true },
  ]);
  assert.match(harness.messages.at(-1).message, /já enviada/);
});

test("checks the whitelist and submits again when the cached response differs", async () => {
  const payload = {
    responsavel: "MARIA",
    cargo: "Diretor",
    matricula: 12345,
    escola: "EMEB B",
    cdd: [],
    temas: [],
  };
  const harness = createHarness({
    lastResponse: createLastResponse({ payload, submittedAt: SUBMITTED_AT }),
    ensureWhitelistChecked: () => true,
  });

  await harness.controller.handleSubmit();

  assert.equal(harness.getWhitelistChecks(), 1);
  assert.equal(harness.getSubmitCalls(), 1);
  assert.equal(harness.getDialogShows()[0].unchanged, undefined);
  assert.equal(harness.getSavedEntries()[0].escola, "Escola A");
});
