import {
  createThemeBlock,
  getThemeRowValues,
} from "./theme-block.js";
import { getElement } from "./dom.js";

export function createThemeBlocks({
  themes,
  initialRows,
  onDataChange,
  onDeleteRow,
  onDeleteSavedRow,
  onIncompleteCleared,
}) {
  const container = getElement("theme-blocks");
  const blocks = new Map();

  function appendRows(themeId, count) {
    const block = blocks.get(themeId);

    if (!block) {
      return;
    }

    block.appendRows(count);
  }

  function render() {
    blocks.clear();
    container.replaceChildren();

    const fragment = document.createDocumentFragment();

    themes.forEach((theme, index) => {
      const block = createThemeBlock({
        theme,
        index,
        initialRows,
        onAddRows: () => {
          appendRows(theme.id, 10);
          onDataChange();
        },
      });

      blocks.set(theme.id, block);
      fragment.append(block.section);
    });

    container.append(fragment);
  }

  function getBlockByRow(row) {
    return blocks.get(row.dataset.themeId) || null;
  }

  function restore(themeState) {
    blocks.forEach((block, themeId) => {
      const rows = Array.isArray(themeState[themeId])
        ? themeState[themeId]
        : [];

      block.restore(rows);
    });
  }

  function reset() {
    blocks.forEach((block) => {
      block.reset();
    });
  }

  function show() {
    blocks.forEach((block) => {
      block.show();
    });
  }

  function hasData() {
    return Array.from(blocks.values()).some((block) => block.hasData());
  }

  function getDraftThemes() {
    const themesState = {};

    blocks.forEach((block, themeId) => {
      themesState[themeId] = block.getDraftRows();
    });

    return themesState;
  }

  function getThemesForPayload() {
    return Array.from(blocks.values()).map((block) => ({
      id: block.theme.id,
      label: block.theme.label,
      rows: block.getRowsForPayload(),
    }));
  }

  function getRowSnapshots() {
    const snapshots = new Map();

    blocks.forEach((block) => {
      block.getRowSnapshots(snapshots);
    });

    return snapshots;
  }

  function collectPartialGroups() {
    const groups = [];

    blocks.forEach((block) => {
      const numbers = block.collectPartialRows();

      if (numbers.length > 0) {
        groups.push({ block, numbers });
      }
    });

    return groups;
  }

  function clearFlags() {
    blocks.forEach((block) => {
      block.clearFlags();
    });
  }

  function updateAllStatuses() {
    blocks.forEach((block) => {
      block.updateAllStatuses();
    });
  }

  function sanitizeTextFields() {
    blocks.forEach((block) => {
      block.sanitizeTextFields();
    });
  }

  function markErrors() {
    blocks.forEach((block) => {
      block.markError();
    });
  }

  function applySaveSuccess(savedAt, rowSnapshots) {
    blocks.forEach((block) => {
      block.applySaveSuccess(savedAt, rowSnapshots);
    });
  }

  function refreshFlaggedRow(row) {
    if (!row.classList.contains("row-incomplete")) {
      return;
    }

    const block = getBlockByRow(row);

    if (block) {
      block.refreshRowFlag(row);
    }

    if (!container.querySelector("tr.row-incomplete")) {
      onIncompleteCleared();
    }
  }

  function handleChange(event) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const row = target.closest("tr");

    if (!row || row.dataset.rowType !== "theme") {
      return;
    }

    const block = getBlockByRow(row);

    if (block) {
      block.updateRowStatus(row);
    }

    refreshFlaggedRow(row);

    if (block && !block.hasEmptyRow()) {
      appendRows(block.theme.id, 1);
    }

    onDataChange();
  }

  function notifySavedRowDeletion(row) {
    if (!Number(row.dataset.savedAt)) {
      return;
    }

    const block = getBlockByRow(row);
    const rowPayload = {
      rowId: row.dataset.rowId,
      themeId: row.dataset.themeId,
      themeLabel: block?.theme.label ?? "",
      ...getThemeRowValues(row),
    };

    onDeleteSavedRow(rowPayload);
  }

  function removeRow(row) {
    notifySavedRowDeletion(row);

    const block = getBlockByRow(row);
    row.remove();

    if (block && !block.tbody.querySelector("tr")) {
      appendRows(block.theme.id, 1);
    }

    onDataChange();

    if (!container.querySelector("tr.row-incomplete")) {
      onIncompleteCleared();
    }
  }

  function handleClick(event) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const deleteButton = target.closest(".delete-row-button");

    if (!deleteButton) {
      return;
    }

    const row = deleteButton.closest("tr");

    if (!row || row.dataset.rowType !== "theme") {
      return;
    }

    const block = getBlockByRow(row);

    if (block && block.isRowEmpty(row)) {
      removeRow(row);
      return;
    }

    onDeleteRow(row);
  }

  function wireEvents() {
    container.addEventListener("input", handleChange);
    container.addEventListener("change", handleChange);
    container.addEventListener("click", handleClick);
  }

  return {
    render,
    restore,
    reset,
    show,
    hasData,
    getDraftThemes,
    getThemesForPayload,
    getRowSnapshots,
    collectPartialGroups,
    clearFlags,
    updateAllStatuses,
    sanitizeTextFields,
    markErrors,
    applySaveSuccess,
    removeRow,
    wireEvents,
  };
}
