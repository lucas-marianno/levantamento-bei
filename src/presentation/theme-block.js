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
  setControlValue,
} from "./controls.js";

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

  return row;
}

export function createThemeBlock({
  theme,
  index,
  initialRows,
  onAddRows,
  onDataChange,
  onNoAcervoChange,
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

  thead.append(headerRow);

  const tbody = document.createElement("tbody");

  table.append(thead, tbody);
  scroll.append(table);

  const actions = document.createElement("div");
  actions.className = "table-actions theme-block-actions";

  const noAcervoLabel = document.createElement("label");
  noAcervoLabel.className = "theme-no-acervo";

  const noAcervoCheckbox = document.createElement("input");
  noAcervoCheckbox.type = "checkbox";
  noAcervoCheckbox.className = "row-checkbox theme-no-acervo-checkbox";
  noAcervoCheckbox.autocomplete = "off";
  noAcervoCheckbox.setAttribute(
    "aria-label",
    `Não possuímos acervo com essa temática: ${theme.label}`
  );

  const noAcervoText = document.createElement("span");
  noAcervoText.textContent = "Não possuímos acervo com essa temática";

  noAcervoLabel.append(noAcervoCheckbox, noAcervoText);

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "btn btn-secondary add-theme-rows";
  addButton.textContent = "Adicionar 10 linhas";
  addButton.addEventListener("click", onAddRows);

  actions.append(noAcervoLabel, addButton);
  section.append(heading, scroll, actions);

  let semAcervo = false;

  function getRows() {
    return Array.from(tbody.querySelectorAll("tr"));
  }

  function appendRows(count) {
    const fragment = document.createDocumentFragment();

    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      fragment.append(createThemeRow(theme));
    }

    tbody.append(fragment);
    applySemAcervoState();
  }

  function applySemAcervoState() {
    noAcervoCheckbox.checked = semAcervo;
    addButton.disabled = semAcervo;

    getRows().forEach((row) => {
      Object.values(getThemeRowControlMap(row)).forEach((control) => {
        if (control) {
          control.disabled = semAcervo;
        }
      });

      const deleteButton = row.querySelector(".delete-row-button");
      if (deleteButton) {
        deleteButton.disabled = semAcervo;
      }
    });
  }

  function setSemAcervo(value) {
    semAcervo = Boolean(value);
    applySemAcervoState();
  }

  function clearRows() {
    tbody.replaceChildren();
    appendRows(1);
  }

  function handleNoAcervoChange() {
    const checked = noAcervoCheckbox.checked;

    if (checked && hasData()) {
      noAcervoCheckbox.checked = false;

      onNoAcervoChange?.({
        themeId: theme.id,
        label: theme.label,
        onConfirm: () => {
          setSemAcervo(true);
          clearRows();
          onDataChange();
        },
      });
      return;
    }

    setSemAcervo(checked);

    if (checked) {
      clearRows();
    }

    onDataChange();
  }

  noAcervoCheckbox.addEventListener("change", handleNoAcervoChange);

  function clearFlags() {
    section.classList.remove("theme-incomplete");
    tbody.querySelectorAll("tr.row-incomplete").forEach((row) => {
      setThemeRowFlag(row, false);
    });
  }

  function hasEmptyRow() {
    return getRows().some((row) => getThemeRowState(row) === "empty");
  }

  function hasData() {
    return (
      semAcervo ||
      getRows().some((row) => getThemeRowState(row) !== "empty")
    );
  }

  function hasCompleteRow() {
    return getRows().some((row) => getThemeRowState(row) === "complete");
  }

  function markIncomplete() {
    section.classList.toggle(
      "theme-incomplete",
      !semAcervo && !hasCompleteRow()
    );
  }

  function getRowsForPayload() {
    return getRows().map((row) => getThemeRowValues(row));
  }

  function getRowsForDraft() {
    return getRows().map((row) => ({
      ...getThemeRowValues(row),
      _meta: { id: row.dataset.rowId },
    }));
  }

  function reset() {
    semAcervo = false;
    tbody.replaceChildren();
    appendRows(initialRows);
    clearFlags();
  }

  function restore(rows, restoredSemAcervo) {
    semAcervo = Boolean(restoredSemAcervo);
    tbody.replaceChildren();

    if (rows.length > 0) {
      rows.forEach((values) => {
        tbody.append(createThemeRow(theme, values));
      });
    } else {
      appendRows(initialRows);
    }

    applySemAcervoState();
    clearFlags();
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

  function sanitizeTextFields() {
    tbody
      .querySelectorAll(
        '[data-column-key="titulo"], [data-column-key="autor"], [data-column-key="editora"]'
      )
      .forEach((input) => {
        input.value = sanitizeText(input.value);
      });
  }

  function collectDuplicateTitleRows() {
    const seen = new Map();

    getRows().forEach((row, rowIndex) => {
      if (getThemeRowState(row) === "empty") {
        return;
      }

      const values = getThemeRowValues(row);
      const title = sanitizeText(values.titulo).trim();
      if (!title) {
        return;
      }

      const entry = seen.get(title) || { title, numbers: [], rows: [] };
      entry.numbers.push(rowIndex + 1);
      entry.rows.push(row);
      seen.set(title, entry);
    });

    const duplicates = [];
    seen.forEach((entry) => {
      if (entry.numbers.length > 1) {
        duplicates.push(entry);
        entry.rows.forEach((row) => {
          row.classList.add("row-incomplete");
          const titleControl = getRowControl(row, "titulo");
          if (titleControl) {
            titleControl.setAttribute("aria-invalid", "true");
          }
        });
      }
    });

    return duplicates.map(({ title, numbers }) => ({ title, numbers }));
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
    clearFlags,
    hasEmptyRow,
    hasData,
    hasCompleteRow,
    hasSemAcervo: () => semAcervo,
    markIncomplete,
    setSemAcervo,
    getRowsForPayload,
    getRowsForDraft,
    reset,
    restore,
    collectPartialRows,
    collectDuplicateTitleRows,
    refreshRowFlag,
    sanitizeTextFields,
    show,
    isRowEmpty: (row) => getThemeRowState(row) === "empty",
  };
}
