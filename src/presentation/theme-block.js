import { THEME_COLUMNS } from "../config.js";
import {
  getInvalidColumnKeys,
  getRowState,
  valuesAreEmpty,
} from "../domain/rows.js";
import { sanitizeText } from "../domain/values.js";
import { generateRowId } from "../infrastructure/id.js";
import {
  createDeleteButton,
  createInput,
  getControlValue,
  getRowControl,
  getRowId,
  setControlValue,
} from "./controls.js";
import { renderSaveStatus } from "./save-status.js";

export function getThemeRowControlMap(row) {
  const controls = {};

  THEME_COLUMNS.forEach((column) => {
    controls[column.key] = getRowControl(row, column.key);
  });

  return controls;
}

export function getThemeRowValues(row) {
  const controls = getThemeRowControlMap(row);
  const values = {};

  THEME_COLUMNS.forEach((column) => {
    values[column.key] = getControlValue(controls[column.key], column.type);
  });

  return values;
}

export function getThemeRowSnapshot(row) {
  return JSON.stringify(getThemeRowValues(row));
}

function themeRowValuesAreEmpty(values) {
  return valuesAreEmpty(THEME_COLUMNS, values);
}

function getThemeRowState(row) {
  return getRowState(THEME_COLUMNS, getThemeRowValues(row));
}

function setThemeRowFlag(row, flagged) {
  const controls = getThemeRowControlMap(row);
  const missingKeys = new Set(
    getInvalidColumnKeys(THEME_COLUMNS, getThemeRowValues(row))
  );

  row.classList.toggle("row-incomplete", flagged);

  THEME_COLUMNS.forEach((column) => {
    const control = controls[column.key];

    if (!control) {
      return;
    }

    if (flagged && missingKeys.has(column.key)) {
      control.setAttribute("aria-invalid", "true");
    } else {
      control.removeAttribute("aria-invalid");
    }
  });
}

function updateThemeRowSaveStatus(row) {
  const status = row.querySelector(".save-status");

  if (!status) {
    return;
  }

  const values = getThemeRowValues(row);

  renderSaveStatus(status, {
    savedAt: row.dataset.savedAt,
    savedSnapshot: row.dataset.savedSnapshot || "",
    currentSnapshot: JSON.stringify(values),
    saveError: row.dataset.saveError === "true",
    empty: themeRowValuesAreEmpty(values),
  });
}

function createThemeRow(theme, values = {}) {
  const row = document.createElement("tr");
  row.dataset.rowType = "theme";
  row.dataset.themeId = theme.id;

  const meta =
    values && typeof values._meta === "object" && values._meta
      ? values._meta
      : {};

  row.dataset.rowId =
    typeof meta.id === "string" && meta.id ? meta.id : generateRowId();

  if (meta.savedAt) {
    row.dataset.savedAt = String(meta.savedAt);
  }

  if (typeof meta.savedSnapshot === "string" && meta.savedSnapshot) {
    row.dataset.savedSnapshot = meta.savedSnapshot;
  }

  if (meta.saveError) {
    row.dataset.saveError = "true";
  }

  THEME_COLUMNS.forEach((column) => {
    const cell = document.createElement("td");
    const control = createInput(column.label, column.type, column);

    control.dataset.columnKey = column.key;
    setControlValue(control, column.type, values[column.key]);
    cell.append(control);
    row.append(cell);
  });

  const actionCell = document.createElement("td");
  actionCell.className = "row-actions";
  actionCell.append(createDeleteButton());
  row.append(actionCell);

  const statusCell = document.createElement("td");
  statusCell.className = "save-status-cell";
  const status = document.createElement("span");
  status.className = "save-status";
  statusCell.append(status);
  row.append(statusCell);

  updateThemeRowSaveStatus(row);

  return row;
}

export function createThemeBlock({
  theme,
  index,
  initialRows,
  onAddRows,
}) {
  const section = document.createElement("section");
  section.className = "card table-card theme-block";
  section.dataset.themeId = theme.id;
  section.hidden = true;

  const heading = document.createElement("h2");
  const headingId = `theme-title-${index}`;
  heading.id = headingId;
  heading.textContent = theme.label;
  section.setAttribute("aria-labelledby", headingId);

  const scroll = document.createElement("div");
  scroll.className = "table-scroll";

  const table = document.createElement("table");
  table.className = "theme-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  THEME_COLUMNS.forEach((column) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = column.label;
    headerRow.append(th);
  });

  const actionsHeader = document.createElement("th");
  actionsHeader.scope = "col";
  actionsHeader.className = "row-actions-header";
  const actionsLabel = document.createElement("span");
  actionsLabel.className = "sr-only";
  actionsLabel.textContent = "Ações";
  actionsHeader.append(actionsLabel);
  headerRow.append(actionsHeader);

  const statusHeader = document.createElement("th");
  statusHeader.scope = "col";
  statusHeader.className = "save-status-header";
  statusHeader.textContent = "Status de salvamento";
  headerRow.append(statusHeader);

  thead.append(headerRow);

  const tbody = document.createElement("tbody");

  table.append(thead, tbody);
  scroll.append(table);

  const actions = document.createElement("div");
  actions.className = "table-actions";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "btn btn-secondary add-theme-rows";
  addButton.textContent = "Adicionar 10 linhas";
  addButton.addEventListener("click", onAddRows);
  actions.append(addButton);

  section.append(heading, scroll, actions);

  function getRows() {
    return Array.from(tbody.querySelectorAll("tr"));
  }

  function appendRows(count) {
    const fragment = document.createDocumentFragment();

    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      fragment.append(createThemeRow(theme));
    }

    tbody.append(fragment);
  }

  function updateAllStatuses() {
    getRows().forEach(updateThemeRowSaveStatus);
  }

  function clearFlags() {
    tbody.querySelectorAll("tr.row-incomplete").forEach((row) => {
      setThemeRowFlag(row, false);
    });
  }

  function hasEmptyRow() {
    return getRows().some((row) => getThemeRowState(row) === "empty");
  }

  function hasData() {
    return getRows().some((row) => getThemeRowState(row) !== "empty");
  }

  function getRowsForPayload() {
    return getRows().map((row) => getThemeRowValues(row));
  }

  function getDraftRows() {
    return getRows().map((row) => ({
      ...getThemeRowValues(row),
      _meta: {
        id: getRowId(row),
        savedAt: row.dataset.savedAt || null,
        savedSnapshot: row.dataset.savedSnapshot || null,
        saveError: row.dataset.saveError === "true",
      },
    }));
  }

  function reset() {
    tbody.replaceChildren();
    appendRows(initialRows);
  }

  function restore(rows) {
    tbody.replaceChildren();

    if (rows.length > 0) {
      rows.forEach((values) => {
        tbody.append(createThemeRow(theme, values));
      });
      return;
    }

    appendRows(initialRows);
  }

  function collectPartialRows() {
    const numbers = [];

    getRows().forEach((row, rowIndex) => {
      if (getThemeRowState(row) === "partial") {
        numbers.push(rowIndex + 1);
        setThemeRowFlag(row, true);
      }
    });

    return numbers;
  }

  function refreshRowFlag(row) {
    if (!row.classList.contains("row-incomplete")) {
      return;
    }

    if (getThemeRowState(row) !== "partial") {
      setThemeRowFlag(row, false);
    }
  }

  function getRowSnapshots(target) {
    getRows().forEach((row) => {
      if (getThemeRowState(row) !== "empty") {
        target.set(getRowId(row), getThemeRowSnapshot(row));
      }
    });
  }

  function markError() {
    getRows().forEach((row) => {
      if (getThemeRowState(row) !== "empty") {
        row.dataset.saveError = "true";
        updateThemeRowSaveStatus(row);
      }
    });
  }

  function applySaveSuccess(savedAt, rowSnapshots) {
    getRows().forEach((row) => {
      delete row.dataset.saveError;

      if (getThemeRowState(row) === "empty") {
        updateThemeRowSaveStatus(row);
        return;
      }

      const sentSnapshot = rowSnapshots.get(getRowId(row));
      const currentSnapshot = getThemeRowSnapshot(row);

      if (sentSnapshot && sentSnapshot === currentSnapshot) {
        row.dataset.savedAt = String(savedAt);
        row.dataset.savedSnapshot = currentSnapshot;
      }

      updateThemeRowSaveStatus(row);
    });
  }

  function sanitizeTextFields() {
    tbody
      .querySelectorAll(
        '[data-column-key="titulo"], [data-column-key="autor"], [data-column-key="editora"]'
      )
      .forEach((input) => {
        input.value = sanitizeText(input.value);
      });
  }

  function show() {
    section.hidden = false;
  }

  return {
    theme,
    section,
    tbody,
    getRows,
    appendRows,
    updateAllStatuses,
    clearFlags,
    hasEmptyRow,
    hasData,
    getRowsForPayload,
    getDraftRows,
    reset,
    restore,
    collectPartialRows,
    refreshRowFlag,
    getRowSnapshots,
    markError,
    applySaveSuccess,
    sanitizeTextFields,
    show,
    isRowEmpty: (row) => getThemeRowState(row) === "empty",
    updateRowStatus: updateThemeRowSaveStatus,
  };
}
