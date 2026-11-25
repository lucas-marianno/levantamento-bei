import { submitResponse } from "../application/submit-response.js";
import { SUBMIT_IN_PROGRESS_LABEL, SUBMIT_LABEL } from "../config.js";
import {
  createLastResponse,
  payloadMatchesLastResponse,
} from "../domain/last-response.js";
import { buildSurveyPayloadV3 } from "../domain/survey.js";
import { formatRowNumbers } from "../domain/values.js";
import { getThemesWithoutValidRows } from "../domain/validation.js";

export function createSubmitController({
  identification,
  cddForm,
  themeBlocks,
  feedback,
  submitButton,
  gateway,
  onPersistDraft,
  lastResponseRepository = { load: () => null, save() {} },
  sentResponseDialog = { show() {} },
}) {
  let isSubmitting = false;

  function setSubmitButtonState(inProgress) {
    submitButton.disabled = inProgress;
    submitButton.textContent = inProgress
      ? SUBMIT_IN_PROGRESS_LABEL
      : SUBMIT_LABEL;
  }

  function handleSubmitSuccess(result, payload) {
    const entry = createLastResponse({
      payload,
      submittedAt: result?.submittedAt,
      id: result?.id,
    });

    lastResponseRepository.save(entry);
    feedback.show("Resposta enviada com sucesso.", "success", "submitted");
    onPersistDraft();
    sentResponseDialog.show({
      escola: entry.escola,
      submittedAt: entry.submittedAt,
    });
  }

  function handleUnchangedSubmit(lastResponse) {
    feedback.show(
      "Resposta já enviada. Nenhuma alteração foi feita.",
      "success",
      "submitted"
    );
    onPersistDraft();
    sentResponseDialog.show({
      escola: lastResponse.escola,
      submittedAt: lastResponse.submittedAt,
      unchanged: true,
    });
  }

  function handleSubmitFailure(error) {
    const message =
      error instanceof Error ? error.message : "erro inesperado ao enviar";

    feedback.show(
      `Não foi possível enviar a resposta: ${message}`,
      "error",
      "submit"
    );
    onPersistDraft();
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    isSubmitting = true;
    setSubmitButtonState(true);

    try {
      identification.sanitizeName();
      themeBlocks.sanitizeTextFields();
      themeBlocks.clearFlags();
      cddForm.clearFlags();
      feedback.hide();

      identification.markAllTouched();
      identification.updateState();

      const hasValidFormat =
        typeof identification.isValidFormat === "function"
          ? identification.isValidFormat()
          : identification.isValid();

      if (!hasValidFormat) {
        feedback.show(
          "Preencha corretamente o nome, o cargo e a matrícula (autorizada) antes de enviar.",
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

      const duplicateTitleGroups = themeBlocks.collectDuplicateTitleGroups();

      if (duplicateTitleGroups.length > 0) {
        const detail = duplicateTitleGroups
          .map(
            ({ block, duplicates }) =>
              `${block.theme.label}: ${duplicates
                .map(
                  (duplicate) =>
                    `"${duplicate.title}" (linhas ${formatRowNumbers(duplicate.numbers)})`
                )
                .join(", ")}`
          )
          .join("; ");

        feedback.show(
          `Títulos duplicados no mesmo tema — ${detail}. Cada título deve ser único por tema.`,
          "error",
          "submit"
        );
        duplicateTitleGroups[0].block.tbody
          .querySelector('input[data-column-key="titulo"][aria-invalid="true"]')
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

      const emptyThemeGroups = themeBlocks.collectEmptyGroups();

      if (emptyThemeGroups.length > 0) {
        const emptyThemes = getThemesWithoutValidRows(
          themeBlocks.getThemesForPayload()
        );
        const detail = emptyThemes.map(({ label }) => label).join(", ");

        themeBlocks.markEmptyThemes();
        feedback.show(
          `Preencha pelo menos uma linha válida em: ${detail}. Ou marque "Não possuímos acervo com essa temática".`,
          "error",
          "submit"
        );
        emptyThemeGroups[0].block.section.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }

      if (!identification.getSchool()) {
        feedback.show(
          "Selecione uma EMEB antes de enviar a resposta.",
          "error",
          "submit"
        );
        return;
      }

      const payload = buildSurveyPayloadV3({
        form: identification.getFormValues(),
        school: identification.getSchool(),
        cdd: cddForm.getValues(),
        themes: themeBlocks.getThemesForPayload(),
      });

      const lastResponse = lastResponseRepository.load();

      if (payloadMatchesLastResponse(payload, lastResponse)) {
        handleUnchangedSubmit(lastResponse);
        return;
      }

      if (identification.ensureWhitelistChecked) {
        try {
          await identification.ensureWhitelistChecked();
        } catch {
          // State is updated by identification; validation below will report failure.
        }
        identification.updateState();
      }

      if (!identification.isValid()) {
        feedback.show(
          "Preencha corretamente o nome, o cargo e a matrícula (autorizada) antes de enviar.",
          "error",
          "submit"
        );
        return;
      }

      onPersistDraft();
      const result = await submitResponse({ gateway, payload });
      handleSubmitSuccess(result, payload);
    } catch (error) {
      handleSubmitFailure(error);
    } finally {
      isSubmitting = false;
      setSubmitButtonState(false);
    }
  }

  function wireEvents() {
    submitButton.addEventListener("click", () => {
      void handleSubmit();
    });
  }

  return { handleSubmit, wireEvents };
}
