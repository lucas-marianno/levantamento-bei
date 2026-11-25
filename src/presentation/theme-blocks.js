import {
  createThemeBlock,
} from "./theme-block.js";
import { getElement } from "./dom.js";

export function createThemeBlocks({
  themes,
  initialRows,
  onDataChange,
  onDeleteRow,
  onNoAcervoChange,
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
        onDataChange,
        onNoAcervoChange,
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
      const entry = themeState[themeId];
      const state =
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? entry
          : { semAcervo: false, rows: Array.isArray(entry) ? entry : [] };

      block.restore(
        Array.isArray(state.rows) ? state.rows : [],
        state.semAcervo
      );
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
      themesState[themeId] = {
        semAcervo: block.hasSemAcervo(),
        rows: block.getRowsForDraft(),
      };
    });

    return themesState;
  }

  function getThemesForPayload() {
    return Array.from(blocks.values()).map((block) => ({
      id: block.theme.id,
      label: block.theme.label,
      semAcervo: block.hasSemAcervo(),
      rows: block.getRowsForPayload(),
    }));
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

  function collectDuplicateTitleGroups() {
    const groups = [];

    blocks.forEach((block) => {
      const duplicates = block.collectDuplicateTitleRows();

      if (duplicates.length > 0) {
        groups.push({ block, duplicates });
      }
    });

    return groups;
  }

  function collectEmptyGroups() {
    const groups = [];

    blocks.forEach((block) => {
      if (!block.hasSemAcervo() && !block.hasCompleteRow()) {
        groups.push({ block });
      }
    });

    return groups;
  }

  function clearFlags() {
    blocks.forEach((block) => {
      block.clearFlags();
    });
  }

  function markEmptyThemes() {
    blocks.forEach((block) => {
      block.markIncomplete();
    });
  }

  function sanitizeTextFields() {
    blocks.forEach((block) => {
      block.sanitizeTextFields();
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

    if (!block) {
      return;
    }

    refreshFlaggedRow(row);

    if (!block.hasSemAcervo() && !block.hasEmptyRow()) {
      appendRows(block.theme.id, 1);
    }

    onDataChange();
  }

  function removeRow(row) {
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

    if (!deleteButton || deleteButton.disabled) {
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
    collectPartialGroups,
    collectDuplicateTitleGroups,
    collectEmptyGroups,
    clearFlags,
    markEmptyThemes,
    sanitizeTextFields,
    removeRow,
    wireEvents,
  };
}
