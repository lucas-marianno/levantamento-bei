import { submitSurvey } from "../application/save-survey.js";
import { SAVE_IN_PROGRESS_LABEL, SAVE_LABEL } from "../config.js";
import { buildSurveyPayloadV3 } from "../domain/survey.js";
import { formatRowNumbers } from "../domain/values.js";

function showSaveErrorDialog(errorMessage) {
  // TODO: open #save-error-dialog and display the failure message.
  // TODO: tell the user the current changes are saved in this browser and are not lost.
  // TODO: show the number of retries and a countdown to the next automatic retry.
  // TODO: wire #cancel-save-retry to cancel the pending retry.
  void errorMessage;
}

function scheduleSaveRetry(payload, attempt = 0) {
  // TODO: implement rolling retry with exponential backoff (1, 2, 4, 8, 16, 32, 60s).
  // TODO: add random jitter to each delay to avoid overloading the server.
  // TODO: stop after ~60s and show the final error with a request to try again later.
  // TODO: call sendSurveyToBackend again with the same payload.
  void payload;
  void attempt;
}

export function createSaveController({
  identification,
  cddForm,
  themeBlocks,
  feedback,
  saveButton,
  gateway,
  onSaveDraft,
}) {
  let isSaving = false;

  function setSaveButtonState(inProgress) {
    saveButton.disabled = inProgress;
    saveButton.textContent = inProgress
      ? SAVE_IN_PROGRESS_LABEL
      : SAVE_LABEL;
  }

  function handleSaveSuccess(rowSnapshots, cddSnapshot) {
    const savedAt = Date.now();

    themeBlocks.applySaveSuccess(savedAt, rowSnapshots);
    cddForm.applySaveSuccess(savedAt, cddSnapshot);

    feedback.show("Levantamento salvo com sucesso.", "success", "saved");
    onSaveDraft();
  }

  function handleSaveFailure(error, payload) {
    const message =
      error instanceof Error ? error.message : "erro inesperado ao salvar";

    themeBlocks.markErrors();
    cddForm.markError();

    feedback.show(
      `Não foi possível salvar o levantamento: ${message}`,
      "error",
      "submit"
    );
    showSaveErrorDialog(message);
    scheduleSaveRetry(payload, 1);
    onSaveDraft();
  }

  async function saveCurrentSurvey(payload, rowSnapshots, cddSnapshot) {
    isSaving = true;
    setSaveButtonState(true);

    try {
      await submitSurvey({ gateway, payload });
      handleSaveSuccess(rowSnapshots, cddSnapshot);
    } catch (error) {
      handleSaveFailure(error, payload);
    } finally {
      isSaving = false;
      setSaveButtonState(false);
    }
  }

  function handleSave() {
    if (isSaving) {
      return;
    }

    identification.sanitizeName();
    themeBlocks.sanitizeTextFields();
    themeBlocks.updateAllStatuses();
    themeBlocks.clearFlags();
    cddForm.clearFlags();
    feedback.hide();

    identification.markAllTouched();
    identification.updateState();

    if (!identification.isValid()) {
      feedback.show(
        "Preencha corretamente o nome, o cargo e a matrícula antes de salvar.",
        "error",
        "submit"
      );
      return;
    }

    const partialGroups = themeBlocks.collectPartialGroups();

    if (partialGroups.length > 0) {
      const detail = partialGroups
        .map(
          ({ block, numbers }) =>
            `${block.theme.label}: ${formatRowNumbers(numbers)}`
        )
        .join("; ");

      feedback.show(
        `Linhas parcialmente preenchidas — ${detail}. Preencha todos os campos obrigatórios ou exclua essas linhas.`,
        "error",
        "incomplete"
      );
      partialGroups[0].block.tbody
        .querySelector("tr.row-incomplete")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const invalidCddRanges = cddForm.validate();

    if (invalidCddRanges.length > 0) {
      feedback.show(
        `Informe uma quantidade maior que 0 ou marque "Não possuímos acervo com essa classificação" para: ${invalidCddRanges.join(
          ", "
        )}.`,
        "error",
        "submit"
      );
      cddForm.scrollToFirstInvalid();
      return;
    }

    if (!identification.getSchool()) {
      feedback.show(
        "Selecione uma EMEB antes de salvar o levantamento.",
        "error",
        "submit"
      );
      return;
    }

    const rowSnapshots = themeBlocks.getRowSnapshots();
    const payload = buildSurveyPayloadV3({
      form: identification.getFormValues(),
      school: identification.getSchool(),
      cdd: cddForm.getValues(),
      themes: themeBlocks.getThemesForPayload(),
    });
    const cddSnapshot = cddForm.getSnapshot();

    onSaveDraft();
    void saveCurrentSurvey(payload, rowSnapshots, cddSnapshot);
  }

  function wireEvents() {
    saveButton.addEventListener("click", handleSave);
  }

  return { handleSave, wireEvents };
}
