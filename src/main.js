import { notifySavedRowDeletion } from "./application/delete-row.js";
import { buildDraft } from "./application/draft.js";
import { createDraftRepository } from "./infrastructure/draft-repository.js";
import { createOptionsRepository } from "./infrastructure/options-repository.js";
import { createSurveyGateway } from "./infrastructure/survey-gateway.js";
import { createCddForm } from "./presentation/cdd-form.js";
import { createCddTooltip } from "./presentation/cdd-tooltip.js";
import { wireDeleteRowDialog } from "./presentation/dialogs/delete-row.js";
import { wireSchoolChangeDialog } from "./presentation/dialogs/school-change.js";
import { getElement } from "./presentation/dom.js";
import { createFeedback } from "./presentation/feedback.js";
import { createIdentification } from "./presentation/identification.js";
import { createSaveController } from "./presentation/save-controller.js";
import { createThemeBlocks } from "./presentation/theme-blocks.js";

async function init() {
  const optionsRepository = createOptionsRepository();
  const draftRepository = createDraftRepository();
  const gateway = createSurveyGateway();
  const options = await optionsRepository.load();

  const feedback = createFeedback(getElement("survey-feedback-v3"));
  const saveSection = getElement("save-section");
  const schoolDialog = getElement("school-change-dialog");
  const deleteRowDialog = getElement("delete-row-dialog");
  const cddTooltip = createCddTooltip({
    button: getElement("cdd-form-info-button"),
    tooltip: getElement("cdd-tooltip"),
  });

  let identification;
  let cddForm;
  let themeBlocks;
  let pendingSchool = null;
  let pendingDeleteRow = null;

  function saveDraft() {
    draftRepository.save(
      buildDraft({
        form: identification.getFormValues(),
        school: identification.getSchool(),
        cdd: cddForm.getValues(),
        cddMeta: cddForm.getMeta(),
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
    saveSection.hidden = false;
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

  function handleDeleteSavedRow(payload) {
    notifySavedRowDeletion({ gateway, payload });
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
    onDeleteSavedRow: handleDeleteSavedRow,
    onIncompleteCleared: handleIncompleteCleared,
  });
  themeBlocks.render();

  const saveController = createSaveController({
    identification,
    cddForm,
    themeBlocks,
    feedback,
    saveButton: getElement("submit-survey-v3"),
    gateway,
    onSaveDraft: saveDraft,
  });

  const state = draftRepository.load();
  const form =
    state && typeof state.form === "object" && state.form ? state.form : {};
  const savedSchool = identification.restore(
    form,
    state && typeof state.school === "string" ? state.school : ""
  );

  cddForm.restore(
    state && Array.isArray(state.cdd) ? state.cdd : null,
    state && state.cddMeta && typeof state.cddMeta === "object"
      ? state.cddMeta
      : null
  );

  themeBlocks.restore(
    state && state.themes && typeof state.themes === "object"
      ? state.themes
      : {}
  );

  if (savedSchool || hasSurveyData()) {
    showSurveySections();
  }

  identification.updateState();

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

  cddForm.wireEvents();
  themeBlocks.wireEvents();
  saveController.wireEvents();
  cddTooltip.wireEvents();
}

init();
