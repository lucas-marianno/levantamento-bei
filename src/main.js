import { buildDraft } from "./application/draft.js";
import { isLastResponseValid } from "./domain/last-response.js";
import { createDraftRepository } from "./infrastructure/draft-repository.js";
import { createLastResponseRepository } from "./infrastructure/last-response-repository.js";
import { createOptionsRepository } from "./infrastructure/options-repository.js";
import { createSurveyGateway } from "./infrastructure/survey-gateway.js";
import { createCddForm } from "./presentation/cdd-form.js";
import { createCddTooltip } from "./presentation/cdd-tooltip.js";
import { wireDeleteRowDialog } from "./presentation/dialogs/delete-row.js";
import { wireSchoolChangeDialog } from "./presentation/dialogs/school-change.js";
import { getElement } from "./presentation/dom.js";
import { createFeedback } from "./presentation/feedback.js";
import { createIdentification } from "./presentation/identification.js";
import { createSentResponseDialog } from "./presentation/sent-response-dialog.js";
import { createSubmitController } from "./presentation/submit-controller.js";
import { createThemeBlocks } from "./presentation/theme-blocks.js";

function isWithinCollectionPeriod(period, now = new Date()) {
  if (!period || typeof period !== "object") {
    return true;
  }

  const start = typeof period.start === "string" ? period.start : "";
  const end = typeof period.end === "string" ? period.end : "";
  if (!start || !end) {
    return true;
  }

  const day = now.toISOString().slice(0, 10);
  return day >= start && day <= end;
}

async function init() {
  const optionsRepository = createOptionsRepository();
  const draftRepository = createDraftRepository();
  const options = await optionsRepository.load();
  const gateway = createSurveyGateway({
    supabase: options.supabase,
    functionNames: options.supabase?.functions,
  });

  const feedback = createFeedback(getElement("survey-feedback-v3"));
  const submitSection = getElement("save-section");
  const schoolDialog = getElement("school-change-dialog");
  const deleteRowDialog = getElement("delete-row-dialog");
  const noAcervoDialog = getElement("theme-no-acervo-dialog");
  const noAcervoDescription = getElement("theme-no-acervo-description");
  const cddTooltip = createCddTooltip({
    button: getElement("cdd-form-info-button"),
    tooltip: getElement("cdd-tooltip"),
  });
  const submitButton = getElement("submit-survey-v3");
  const lastResponseRepository = createLastResponseRepository();
  const sentResponseDialog = createSentResponseDialog({
    dialog: getElement("sent-response-dialog"),
    description: getElement("sent-response-description"),
    note: getElement("sent-response-note"),
    editButton: getElement("edit-last-response"),
  });

  sentResponseDialog.wireEvents();

  let identification;
  let cddForm;
  let themeBlocks;
  let pendingSchool = null;
  let pendingDeleteRow = null;
  let pendingNoAcervo = null;
  const collectionOpen = isWithinCollectionPeriod(options.collectionPeriod);

  function saveDraft() {
    draftRepository.save(
      buildDraft({
        form: identification.getFormValues(),
        school: identification.getSchool(),
        cdd: cddForm.getValues(),
        themes: themeBlocks.getDraftThemes(),
      })
    );
  }

  function hasSurveyData() {
    return cddForm.hasData() || themeBlocks.hasData();
  }

  function showSurveySections() {
    cddForm.show();
    themeBlocks.show();
    submitSection.hidden = false;
  }

  function resetSurveyData() {
    cddForm.reset();
    themeBlocks.reset();
  }

  function handleSchoolChange(nextSchool) {
    if (!nextSchool || nextSchool === identification.getSchool()) {
      return;
    }

    feedback.hideOnDataChange();

    if (!hasSurveyData()) {
      identification.setCurrentSchool(nextSchool);
      showSurveySections();
      saveDraft();
      return;
    }

    pendingSchool = nextSchool;
    schoolDialog.showModal();
  }

  function cancelSchoolChange() {
    pendingSchool = null;
    schoolDialog.close();
    identification.revertSchool();
  }

  function confirmSchoolChange() {
    if (pendingSchool === null) {
      schoolDialog.close();
      return;
    }

    identification.setCurrentSchool(pendingSchool);
    pendingSchool = null;
    schoolDialog.close();
    resetSurveyData();
    showSurveySections();
    saveDraft();
  }

  function handleDeleteRowRequest(row) {
    pendingDeleteRow = row;

    if (!deleteRowDialog.open) {
      deleteRowDialog.showModal();
    }
  }

  function cancelDeleteRow() {
    pendingDeleteRow = null;
    deleteRowDialog.close();
  }

  function confirmDeleteRow() {
    const row = pendingDeleteRow;
    pendingDeleteRow = null;
    deleteRowDialog.close();

    if (!row || !row.isConnected || row.dataset.rowType !== "theme") {
      return;
    }

    themeBlocks.removeRow(row);
  }

  function handleNoAcervoRequest(request) {
    pendingNoAcervo = request;
    noAcervoDescription.textContent = `Os dados preenchidos em "${request.label}" serão descartados.`;
    noAcervoDialog.showModal();
  }

  function cancelNoAcervo() {
    pendingNoAcervo = null;
    noAcervoDialog.close();
  }

  function confirmNoAcervo() {
    const request = pendingNoAcervo;
    pendingNoAcervo = null;
    noAcervoDialog.close();
    request?.onConfirm();
  }

  function handleIncompleteCleared() {
    feedback.hideIfIncomplete();
  }

  identification = createIdentification({
    onDataChange: () => {
      feedback.hideOnDataChange();
      saveDraft();
    },
    onPersist: saveDraft,
    onSchoolChange: handleSchoolChange,
    checkWhitelist: async (matricula) => gateway.isUserWhitelisted(matricula),
  });
  identification.populateSchools(options.schools);

  cddForm = createCddForm({
    categories: options.v3.cddCategories,
    onDataChange: () => {
      feedback.hideOnDataChange();
      saveDraft();
    },
  });
  cddForm.render();

  themeBlocks = createThemeBlocks({
    themes: options.v3.themes,
    initialRows: options.v3.initialThemeRows,
    onDataChange: () => {
      feedback.hideOnDataChange();
      saveDraft();
    },
    onDeleteRow: handleDeleteRowRequest,
    onNoAcervoChange: handleNoAcervoRequest,
    onIncompleteCleared: handleIncompleteCleared,
  });
  themeBlocks.render();

  const submitController = createSubmitController({
    identification,
    cddForm,
    themeBlocks,
    feedback,
    submitButton,
    gateway,
    onPersistDraft: saveDraft,
    lastResponseRepository,
    sentResponseDialog,
  });

  const state = draftRepository.load();
  const form =
    state && typeof state.form === "object" && state.form ? state.form : {};
  const savedSchool = identification.restore(
    form,
    state && typeof state.school === "string" ? state.school : ""
  );

  cddForm.restore(state && Array.isArray(state.cdd) ? state.cdd : null);

  themeBlocks.restore(
    state && state.themes && typeof state.themes === "object"
      ? state.themes
      : {}
  );

  if (savedSchool || hasSurveyData()) {
    showSurveySections();
  }

  identification.updateState();

  const lastResponse = lastResponseRepository.load();

  if (isLastResponseValid(lastResponse)) {
    sentResponseDialog.show({
      escola: lastResponse.escola,
      submittedAt: lastResponse.submittedAt,
    });
  }

  if (!collectionOpen) {
    submitButton.disabled = true;
    submitButton.title = "Período de coleta encerrado.";
    feedback.show(
      "O período de coleta de respostas não está aberto no momento.",
      "error",
      "collection-period"
    );
  }

  identification.wireEvents();

  wireSchoolChangeDialog({
    dialog: schoolDialog,
    cancelButton: getElement("cancel-school-change"),
    confirmButton: getElement("confirm-school-change"),
    onCancel: cancelSchoolChange,
    onConfirm: confirmSchoolChange,
    onClose: () => {
      if (pendingSchool !== null) {
        pendingSchool = null;
        identification.revertSchool();
      }
    },
  });

  wireDeleteRowDialog({
    dialog: deleteRowDialog,
    cancelButton: getElement("cancel-delete-row"),
    confirmButton: getElement("confirm-delete-row"),
    onCancel: cancelDeleteRow,
    onConfirm: confirmDeleteRow,
    onClose: () => {
      pendingDeleteRow = null;
    },
  });

  getElement("cancel-theme-no-acervo").addEventListener("click", cancelNoAcervo);
  getElement("confirm-theme-no-acervo").addEventListener(
    "click",
    confirmNoAcervo
  );
  noAcervoDialog.addEventListener("close", () => {
    pendingNoAcervo = null;
  });

  cddForm.wireEvents();
  themeBlocks.wireEvents();
  submitController.wireEvents();
  cddTooltip.wireEvents();
}

init();
