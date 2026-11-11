const STORAGE_KEY = "registro-livros:draft";
const DRAFT_VERSION = 2;
const SAVE_LABEL = "Salvar";
const SAVE_IN_PROGRESS_LABEL = "Salvando...";
const OPTIONS_URL = "data/options.json";

const PLACEHOLDER_ISBN_METADATA = {
  titulo: "Título do livro de exemplo",
  autor: "Autor Exemplo",
  editora: "Editora de Exemplo",
};

const FALLBACK_OPTIONS = {
  isbnRequestDelayMs: 2000,
  schools: ["EMEB Exemplo 1", "EMEB Exemplo 2"],
  cdd: [
    { value: "000", label: "000 - Generalidades" },
    { value: "010", label: "010 - Bibliografia" },
  ],
  themes: ["Tema Exemplo 1", "Tema Exemplo 2"],
};

let appOptions = { ...FALLBACK_OPTIONS };

const COLUMNS = [
  {
    key: "titulo",
    label: "Título do Livro",
    type: "text",
    required: true,
    sanitize: true,
  },
  {
    key: "autor",
    label: "Autor",
    type: "text",
    required: true,
    sanitize: true,
  },
  {
    key: "editora",
    label: "Editora",
    type: "text",
    required: true,
    sanitize: true,
  },
  {
    key: "isbn",
    label: "ISBN",
    type: "text",
    required: (values) => !values.semIsbn,
    isbn: true,
  },
  {
    key: "semIsbn",
    label: "Não possui ISBN",
    type: "checkbox",
  },
  {
    key: "corEtiqueta",
    label: "Cor da Etiqueta",
    type: "color",
    required: (values) => !values.naoClassificado,
  },
  {
    key: "cdd",
    label: "CDD",
    type: "select",
    optionsKey: "cdd",
    required: (values) =>
      !values.naoClassificado && values.corEtiqueta === "LARANJA",
  },
  {
    key: "naoClassificado",
    label: "Não classificado",
    type: "checkbox",
  },
  {
    key: "obraReferencia",
    label: "É obra de referência",
    type: "checkbox",
  },
  {
    key: "tema",
    label: "Tema",
    type: "select",
    optionsKey: "themes",
    required: true,
  },
  {
    key: "quantidade",
    label: "Quantidade de Exemplares",
    type: "number",
    required: true,
  },
];

const COLOR_OPTIONS = [
  { value: "BRANCA", hex: "#ffffff", text: "#0f172a" },
  { value: "AMARELA", hex: "#facc15", text: "#422006" },
  { value: "AZUL", hex: "#3b82f6", text: "#ffffff" },
  { value: "LARANJA", hex: "#f97316", text: "#ffffff" },
  { value: "PRETA", hex: "#111827", text: "#ffffff" },
  { value: "VERDE", hex: "#22c55e", text: "#052e16" },
  { value: "VERMELHA", hex: "#ef4444", text: "#ffffff" },
];

const identificationForm = document.getElementById("identification-form");
const nameInput = document.getElementById("responsavel");
const cargoSelect = document.getElementById("cargo");
const matriculaInput = document.getElementById("matricula");
const nameError = document.getElementById("responsavel-error");
const cargoError = document.getElementById("cargo-error");
const matriculaError = document.getElementById("matricula-error");
const schoolHint = document.getElementById("escola-hint");
const schoolSelect = document.getElementById("escola");
const bookSection = document.getElementById("book-section");
const booksBody = document.getElementById("books-body");
const addRowsButton = document.getElementById("add-rows");
const submitSurveyButton = document.getElementById("submit-survey");
const surveyFeedback = document.getElementById("survey-feedback");
const schoolDialog = document.getElementById("school-change-dialog");
const cancelSchoolChangeButton = document.getElementById("cancel-school-change");
const confirmSchoolChangeButton = document.getElementById(
  "confirm-school-change"
);
const cddInfoButton = document.getElementById("cdd-info-button");
const cddTooltip = document.getElementById("cdd-tooltip");
const deleteRowDialog = document.getElementById("delete-row-dialog");
const cancelDeleteRowButton = document.getElementById("cancel-delete-row");
const confirmDeleteRowButton = document.getElementById("confirm-delete-row");

const touchedFields = {
  name: false,
  cargo: false,
  matricula: false,
};

let currentSchool = "";
let pendingSchool = null;
let pendingDeleteRow = null;
let cddTooltipPinned = false;
let cddTooltipHovered = false;

let lastIsbnRequestAt = 0;

let isSaving = false;

function sanitizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigits(value, maxLength) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function normalizeIsbn(value) {
  return String(value ?? "")
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase();
}

function isValidIsbn(isbn) {
  // TODO: validate the ISBN-10/ISBN-13 checksum before sending the lookup request.
  // Stub: accept every ISBN for now.
  void isbn;

  return true;
}

function canSendIsbnRequest() {
  // TODO: return false while appOptions.isbnRequestDelayMs has not elapsed since
  // the last request, and queue the pending lookup instead of dropping it.
  // Stub: always allow requests for now.
  void lastIsbnRequestAt;
  void appOptions.isbnRequestDelayMs;

  return true;
}

function registerIsbnRequest() {
  lastIsbnRequestAt = Date.now();
}

function formatSavedAt(timestamp) {
  const date = new Date(Number(timestamp));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) => String(number).padStart(2, "0");

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function generateRowId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getRowId(row) {
  if (!row.dataset.rowId) {
    row.dataset.rowId = generateRowId();
  }

  return row.dataset.rowId;
}

function getRowSnapshot(row) {
  return JSON.stringify(getRowValues(row));
}

async function loadOptions() {
  try {
    const response = await fetch(OPTIONS_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    appOptions = {
      isbnRequestDelayMs:
        Number.isFinite(data.isbnRequestDelayMs) && data.isbnRequestDelayMs >= 0
          ? data.isbnRequestDelayMs
          : FALLBACK_OPTIONS.isbnRequestDelayMs,
      schools:
        Array.isArray(data.schools) && data.schools.length > 0
          ? data.schools
          : FALLBACK_OPTIONS.schools,
      cdd:
        Array.isArray(data.cdd) && data.cdd.length > 0
          ? data.cdd
          : FALLBACK_OPTIONS.cdd,
      themes:
        Array.isArray(data.themes) && data.themes.length > 0
          ? data.themes
          : FALLBACK_OPTIONS.themes,
    };
  } catch (error) {
    console.warn(
      "Não foi possível carregar data/options.json. Usando dados de exemplo.",
      error
    );
    appOptions = { ...FALLBACK_OPTIONS };
  }
}

function populateSchoolOptions() {
  schoolSelect.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione...";
  placeholder.disabled = true;
  placeholder.selected = true;
  schoolSelect.append(placeholder);

  const fragment = document.createDocumentFragment();

  appOptions.schools.forEach((school) => {
    const option = document.createElement("option");
    option.value = school;
    option.textContent = school;
    fragment.append(option);
  });

  schoolSelect.append(fragment);
}

function isValidName() {
  return sanitizeText(nameInput.value).length > 0;
}

function isValidCargo() {
  return cargoSelect.value !== "";
}

function isValidMatricula() {
  return /^\d{5}$/.test(matriculaInput.value);
}

function setFieldError(input, errorElement, isValid, showError) {
  const show = showError && !isValid;

  input.setAttribute("aria-invalid", String(show));
  errorElement.hidden = !show;
}

function updateIdentificationState() {
  const nameValid = isValidName();
  const cargoValid = isValidCargo();
  const matriculaValid = isValidMatricula();

  setFieldError(nameInput, nameError, nameValid, touchedFields.name);
  setFieldError(cargoSelect, cargoError, cargoValid, touchedFields.cargo);
  setFieldError(
    matriculaInput,
    matriculaError,
    matriculaValid,
    touchedFields.matricula
  );

  const formValid = nameValid && cargoValid && matriculaValid;

  schoolSelect.disabled = !formValid;
  schoolHint.hidden = formValid;
}

function showFeedback(message, type, reason) {
  surveyFeedback.textContent = message;
  surveyFeedback.className = `feedback ${type}`;
  surveyFeedback.dataset.reason = reason;
  surveyFeedback.hidden = false;
}

function hideFeedback() {
  surveyFeedback.hidden = true;
  surveyFeedback.textContent = "";
  surveyFeedback.className = "feedback";
  delete surveyFeedback.dataset.reason;
}

function hideFeedbackOnDataChange() {
  if (surveyFeedback.dataset.reason !== "incomplete") {
    hideFeedback();
  }
}

function applyColorStyle(select) {
  const selectedColor = COLOR_OPTIONS.find(
    (color) => color.value === select.value
  );

  if (!selectedColor) {
    select.style.backgroundColor = "";
    select.style.color = "";
    select.style.borderColor = "";
    return;
  }

  select.style.backgroundColor = selectedColor.hex;
  select.style.color = selectedColor.text;
  select.style.borderColor =
    selectedColor.value === "BRANCA" ? "#94a3b8" : selectedColor.hex;
}

function createColorSelect(label) {
  const select = document.createElement("select");
  select.className = "color-select";
  select.setAttribute("aria-label", label);

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.append(placeholder);

  COLOR_OPTIONS.forEach((color) => {
    const option = document.createElement("option");
    option.value = color.value;
    option.textContent = color.value;
    option.style.color = color.text;
    option.style.backgroundColor = color.hex;
    select.append(option);
  });

  select.addEventListener("change", () => applyColorStyle(select));

  return select;
}

function createSelect(label, options) {
  const select = document.createElement("select");
  select.className = "table-select";
  select.setAttribute("aria-label", label);

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.append(placeholder);

  options.forEach((item) => {
    const option = document.createElement("option");
    const value = typeof item === "string" ? item : item.value;
    const text = typeof item === "string" ? item : item.label ?? item.value;
    option.value = value;
    option.textContent = text;
    select.append(option);
  });

  return select;
}

function createCheckbox(label) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "row-checkbox";
  input.autocomplete = "off";
  input.setAttribute("aria-label", label);

  return input;
}

function createInput(label, type, column) {
  const input = document.createElement("input");
  input.type = type;
  input.autocomplete = "off";
  input.setAttribute("aria-label", label);

  if (type === "number") {
    input.min = "1";
    input.step = "1";
    input.inputMode = "numeric";
  }

  if (column?.isbn) {
    input.maxLength = 20;
  }

  if (column?.sanitize) {
    input.addEventListener("blur", () => {
      const sanitized = sanitizeText(input.value);

      if (sanitized !== input.value) {
        input.value = sanitized;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }

  return input;
}

function createDeleteButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "delete-row-button";
  button.setAttribute("aria-label", "Excluir linha");
  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M10 11v5M14 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  `;
  return button;
}

function getOptionsForColumn(column) {
  if (!column.optionsKey) {
    return [];
  }

  return Array.isArray(appOptions[column.optionsKey])
    ? appOptions[column.optionsKey]
    : [];
}

function getRowControl(row, key) {
  return row.querySelector(`[data-column-key="${key}"]`);
}

function getRowControlMap(row) {
  const controls = {};

  COLUMNS.forEach((column) => {
    controls[column.key] = getRowControl(row, column.key);
  });

  return controls;
}

function getIsbnErrorElement(row) {
  return row.querySelector(".isbn-error");
}

function setIsbnError(row, message) {
  const isbnInput = getRowControl(row, "isbn");
  const errorElement = getIsbnErrorElement(row);

  if (!isbnInput || !errorElement) {
    return;
  }

  if (message) {
    errorElement.textContent = message;
    errorElement.hidden = false;
    isbnInput.setAttribute("aria-invalid", "true");
    return;
  }

  errorElement.textContent = "";
  errorElement.hidden = true;
  isbnInput.removeAttribute("aria-invalid");
}

function getControlValue(control, type) {
  if (!control) {
    return type === "checkbox" ? false : "";
  }

  return type === "checkbox" ? control.checked : control.value;
}

function setControlValue(control, type, value) {
  if (!control) {
    return;
  }

  if (type === "checkbox") {
    control.checked = Boolean(value);
    return;
  }

  const stringValue = value === undefined || value === null ? "" : String(value);

  if (
    control.tagName === "SELECT" &&
    stringValue !== "" &&
    !Array.from(control.options).some((option) => option.value === stringValue)
  ) {
    const option = document.createElement("option");
    option.value = stringValue;
    option.textContent = stringValue;
    control.append(option);
  }

  control.value = stringValue;
}

function getRowValues(row) {
  const controls = getRowControlMap(row);
  const values = {};

  COLUMNS.forEach((column) => {
    values[column.key] = getControlValue(controls[column.key], column.type);
  });

  return values;
}

function rowValuesAreEmpty(values) {
  return !COLUMNS.some((column) => {
    const value = values[column.key];

    return column.type === "checkbox"
      ? Boolean(value)
      : String(value ?? "").trim() !== "";
  });
}

function isColumnRequired(column, values) {
  return typeof column.required === "function"
    ? column.required(values)
    : Boolean(column.required);
}

function isColumnValueValid(column, values) {
  if (column.type === "checkbox") {
    return true;
  }

  const value = String(values[column.key] ?? "").trim();

  if (value === "") {
    return !isColumnRequired(column, values);
  }

  if (column.isbn) {
    return /^(\d{9}[\dX]|\d{13})$/.test(normalizeIsbn(value));
  }

  if (column.key === "quantidade") {
    const quantity = Number(value);
    return Number.isInteger(quantity) && quantity >= 1;
  }

  return true;
}

function getInvalidColumnKeys(values) {
  return COLUMNS.filter((column) => !isColumnValueValid(column, values)).map(
    (column) => column.key
  );
}

function getRowState(row) {
  const values = getRowValues(row);

  if (rowValuesAreEmpty(values)) {
    return "empty";
  }

  return getInvalidColumnKeys(values).length === 0 ? "complete" : "partial";
}

function setRowFlag(row, flagged) {
  const missingKeys = new Set(getInvalidColumnKeys(getRowValues(row)));

  row.classList.toggle("row-incomplete", flagged);

  COLUMNS.forEach((column) => {
    const control = getRowControl(row, column.key);

    if (!control) {
      return;
    }

    if (column.isbn) {
      if (flagged && missingKeys.has(column.key)) {
        const isbn = normalizeIsbn(getControlValue(control, "text"));

        setIsbnError(
          row,
          isbn
            ? "ISBN inválido. Verifique o número informado."
            : 'Informe o ISBN ou marque "Não possui ISBN".'
        );
      } else {
        setIsbnError(row, "");
      }

      return;
    }

    if (flagged && missingKeys.has(column.key)) {
      control.setAttribute("aria-invalid", "true");
    } else {
      control.removeAttribute("aria-invalid");
    }
  });
}

function clearAllRowFlags() {
  booksBody.querySelectorAll("tr.row-incomplete").forEach((row) => {
    setRowFlag(row, false);
  });
}

function refreshFlaggedRow(row) {
  if (!row.classList.contains("row-incomplete")) {
    return;
  }

  if (getRowState(row) !== "partial") {
    setRowFlag(row, false);
  }

  if (
    !booksBody.querySelector("tr.row-incomplete") &&
    surveyFeedback.dataset.reason === "incomplete"
  ) {
    hideFeedback();
  }
}

function rowIsEmpty(row) {
  return getRowState(row) === "empty";
}

function hasEmptyRow() {
  return Array.from(booksBody.querySelectorAll("tr")).some(rowIsEmpty);
}

function hasTableData() {
  return Array.from(booksBody.querySelectorAll("tr")).some(
    (row) => !rowIsEmpty(row)
  );
}

function updateRowSaveStatus(row) {
  const status = row.querySelector(".save-status");

  if (!status) {
    return;
  }

  const values = getRowValues(row);

  if (rowValuesAreEmpty(values)) {
    status.textContent = "";
    status.className = "save-status";
    return;
  }

  const savedAt = Number(row.dataset.savedAt) || 0;
  const savedSnapshot = row.dataset.savedSnapshot || "";
  const currentSnapshot = JSON.stringify(values);
  const hasError = row.dataset.saveError === "true";
  const savedAtText = savedAt ? formatSavedAt(savedAt) : "";

  if (hasError) {
    status.textContent = savedAt
      ? `Erro ao salvar, último salvamento em ${savedAtText}`
      : "Erro ao salvar";
    status.className = "save-status error";
    return;
  }

  if (!savedAt) {
    status.textContent = "Entrada não salva";
    status.className = "save-status pending";
    return;
  }

  if (currentSnapshot !== savedSnapshot) {
    status.textContent = `Alterações pendentes. Último salvamento em ${savedAtText}`;
    status.className = "save-status pending";
    return;
  }

  status.textContent = `Salvo em ${savedAtText}`;
  status.className = "save-status saved";
}

function updateAllRowSaveStatuses() {
  booksBody.querySelectorAll("tr").forEach(updateRowSaveStatus);
}

function applyRowConditionalState(row) {
  const values = getRowValues(row);
  const controls = getRowControlMap(row);
  const metadataEditable =
    Boolean(values.semIsbn) || row.dataset.isbnLookupState === "failed";

  ["titulo", "autor", "editora"].forEach((key) => {
    if (controls[key]) {
      controls[key].disabled = !metadataEditable;
    }
  });

  if (controls.isbn) {
    controls.isbn.disabled = Boolean(values.semIsbn);
  }

  if (controls.corEtiqueta) {
    controls.corEtiqueta.disabled = Boolean(values.naoClassificado);
  }

  if (controls.cdd) {
    controls.cdd.disabled = Boolean(values.naoClassificado);
  }

  COLUMNS.forEach((column) => {
    const control = controls[column.key];

    if (!control) {
      return;
    }

    if (isColumnRequired(column, values)) {
      control.setAttribute("aria-required", "true");
    } else {
      control.removeAttribute("aria-required");
    }
  });
}

function createBookRow(values = {}) {
  const row = document.createElement("tr");
  const meta =
    values && typeof values._meta === "object" && values._meta
      ? values._meta
      : {};

  row.dataset.rowId =
    typeof meta.id === "string" && meta.id ? meta.id : generateRowId();
  row.dataset.isbnLookupState = meta.isbnLookupState || "idle";

  if (meta.savedAt) {
    row.dataset.savedAt = String(meta.savedAt);
  }

  if (typeof meta.savedSnapshot === "string" && meta.savedSnapshot) {
    row.dataset.savedSnapshot = meta.savedSnapshot;
  }

  if (meta.saveError) {
    row.dataset.saveError = "true";
  }

  COLUMNS.forEach((column) => {
    const cell = document.createElement("td");
    let control;

    if (column.type === "color") {
      control = createColorSelect(column.label);
    } else if (column.type === "checkbox") {
      control = createCheckbox(column.label);
      cell.classList.add("checkbox-cell");
    } else if (column.type === "select") {
      control = createSelect(column.label, getOptionsForColumn(column));
    } else {
      control = createInput(column.label, column.type, column);
    }

    control.dataset.columnKey = column.key;
    setControlValue(control, column.type, values[column.key]);

    if (column.type === "color") {
      applyColorStyle(control);
    }

    cell.append(control);

    if (column.isbn) {
      const errorElement = document.createElement("span");
      errorElement.className = "field-error isbn-error";
      errorElement.id = `isbn-error-${row.dataset.rowId}`;
      errorElement.hidden = true;
      control.setAttribute("aria-describedby", errorElement.id);
      cell.append(errorElement);
    }

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

  const controls = getRowControlMap(row);

  if (values.semIsbn) {
    setControlValue(controls.isbn, "text", "");
  }

  if (values.naoClassificado) {
    setControlValue(controls.corEtiqueta, "color", "");
    applyColorStyle(controls.corEtiqueta);
    setControlValue(controls.cdd, "select", "");
  }

  row.dataset.lastIsbn = normalizeIsbn(controls.isbn?.value ?? "");
  applyRowConditionalState(row);
  updateRowSaveStatus(row);

  return row;
}

function appendRows(count) {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < count; index += 1) {
    fragment.append(createBookRow());
  }

  booksBody.append(fragment);
}

function renderBookTable(rows) {
  booksBody.replaceChildren();

  if (Array.isArray(rows) && rows.length > 0) {
    rows.forEach((values) => booksBody.append(createBookRow(values)));
  } else {
    appendRows(10);
  }

  bookSection.hidden = false;
}

function saveState() {
  const state = {
    version: DRAFT_VERSION,
    form: {
      responsavel: nameInput.value,
      cargo: cargoSelect.value,
      matricula: matriculaInput.value,
    },
    school: currentSchool,
    rows: Array.from(booksBody.querySelectorAll("tr")).map((row) => ({
      ...getRowValues(row),
      _meta: {
        id: getRowId(row),
        savedAt: row.dataset.savedAt || null,
        savedSnapshot: row.dataset.savedSnapshot || null,
        saveError: row.dataset.saveError === "true",
        isbnLookupState: row.dataset.isbnLookupState || "idle",
      },
    })),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable or full.
  }
}

function loadState() {
  try {
    const rawState = localStorage.getItem(STORAGE_KEY);
    return rawState ? JSON.parse(rawState) : null;
  } catch {
    return null;
  }
}

function restoreState() {
  const state = loadState();

  if (!state || typeof state !== "object") {
    return;
  }

  const form = state.form && typeof state.form === "object" ? state.form : {};
  nameInput.value = sanitizeText(
    typeof form.responsavel === "string" ? form.responsavel : ""
  );

  const savedCargo = typeof form.cargo === "string" ? form.cargo : "";
  const cargoExists = Array.from(cargoSelect.options).some(
    (option) => option.value !== "" && option.value === savedCargo
  );
  cargoSelect.value = cargoExists ? savedCargo : "";

  matriculaInput.value = onlyDigits(String(form.matricula ?? ""), 5);

  const savedSchool = typeof state.school === "string" ? state.school : "";

  if (savedSchool) {
    if (
      !Array.from(schoolSelect.options).some(
        (option) => option.value === savedSchool
      )
    ) {
      const option = document.createElement("option");
      option.value = savedSchool;
      option.textContent = savedSchool;
      schoolSelect.append(option);
    }

    currentSchool = savedSchool;
    schoolSelect.value = savedSchool;
  }

  const rows = Array.isArray(state.rows) ? state.rows : [];

  if (savedSchool || rows.length > 0) {
    renderBookTable(rows);
  }
}

function handleNameInput() {
  updateIdentificationState();
  hideFeedbackOnDataChange();
  saveState();
}

function handleCargoChange() {
  touchedFields.cargo = true;
  updateIdentificationState();
  hideFeedbackOnDataChange();
  saveState();
}

function handleMatriculaInput() {
  matriculaInput.value = onlyDigits(matriculaInput.value, 5);
  updateIdentificationState();
  hideFeedbackOnDataChange();
  saveState();
}

function handleIsbnChange(row) {
  const values = getRowValues(row);
  const isbnInput = getRowControl(row, "isbn");
  const isbn = normalizeIsbn(isbnInput?.value ?? "");

  if (values.semIsbn || isbn === "") {
    setIsbnError(row, "");
    row.dataset.isbnLookupState = values.semIsbn ? "manual" : "idle";
    applyRowConditionalState(row);
    return;
  }

  if (
    row.dataset.lastIsbn === isbn &&
    row.dataset.isbnLookupState === "success"
  ) {
    setIsbnError(row, "");
    return;
  }

  const isbnFormatIsValid = /^(\d{9}[\dX]|\d{13})$/.test(isbn);

  if (!isbnFormatIsValid || !isValidIsbn(isbn)) {
    // TODO: use a more specific message once the real ISBN validation exists.
    setIsbnError(row, "ISBN inválido");
    row.dataset.isbnLookupState = "idle";
    applyRowConditionalState(row);
    return;
  }

  setIsbnError(row, "");

  if (!canSendIsbnRequest()) {
    // TODO: queue this lookup and run it after appOptions.isbnRequestDelayMs.
    return;
  }

  row.dataset.lastIsbn = isbn;
  row.dataset.isbnLookupState = "loading";
  isbnInput.setAttribute("aria-busy", "true");
  applyRowConditionalState(row);
  void lookupIsbn(row, isbn);
}

async function lookupIsbn(row, isbn) {
  // TODO: replace this placeholder with the real ISBN API request.
  // TODO: handle network/API errors and allow manual metadata entry on failure.
  if (!row.isConnected || getRowValues(row).semIsbn) {
    return;
  }

  if (normalizeIsbn(getRowControl(row, "isbn")?.value ?? "") !== isbn) {
    return;
  }

  registerIsbnRequest();

  const metadata = { ...PLACEHOLDER_ISBN_METADATA };
  const controls = getRowControlMap(row);

  setControlValue(controls.titulo, "text", metadata.titulo);
  setControlValue(controls.autor, "text", metadata.autor);
  setControlValue(controls.editora, "text", metadata.editora);

  row.dataset.isbnLookupState = "success";
  applyRowConditionalState(row);
  updateRowSaveStatus(row);
  refreshFlaggedRow(row);
  saveState();

  if (row.isConnected) {
    getRowControl(row, "isbn")?.removeAttribute("aria-busy");
  }
}

function handleSemIsbnChange(row) {
  const values = getRowValues(row);
  const controls = getRowControlMap(row);

  setIsbnError(row, "");

  if (values.semIsbn) {
    setControlValue(controls.isbn, "text", "");
    delete row.dataset.lastIsbn;
    row.dataset.isbnLookupState = "manual";
  } else {
    row.dataset.isbnLookupState = "idle";
  }

  applyRowConditionalState(row);
}

function handleUnclassifiedChange(row) {
  const values = getRowValues(row);
  const controls = getRowControlMap(row);

  if (values.naoClassificado) {
    setControlValue(controls.corEtiqueta, "color", "");
    applyColorStyle(controls.corEtiqueta);
    setControlValue(controls.cdd, "select", "");
  }

  applyRowConditionalState(row);
}

function handleTableChange(event) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const row = target.closest("tr");

  if (!row) {
    return;
  }

  const columnKey = target.dataset.columnKey;

  if (columnKey === "semIsbn") {
    handleSemIsbnChange(row);
  }

  if (columnKey === "naoClassificado") {
    handleUnclassifiedChange(row);
  }

  if (columnKey === "corEtiqueta") {
    applyColorStyle(target);
  }

  if (columnKey === "isbn") {
    setIsbnError(row, "");
  }

  applyRowConditionalState(row);
  updateRowSaveStatus(row);

  if (!hasEmptyRow()) {
    appendRows(1);
  }

  refreshFlaggedRow(row);
  hideFeedbackOnDataChange();
  saveState();
}

function notifySavedRowDeletion(row) {
  if (!Number(row.dataset.savedAt)) {
    return;
  }

  const rowPayload = {
    rowId: getRowId(row),
    ...getRowValues(row),
  };

  void deleteBookRow(rowPayload).catch((error) => {
    console.error("Falha ao notificar a exclusão da linha.", error);
  });
}

function removeRow(row) {
  notifySavedRowDeletion(row);
  row.remove();

  if (!booksBody.querySelector("tr")) {
    appendRows(1);
  }

  hideFeedbackOnDataChange();

  if (
    !booksBody.querySelector("tr.row-incomplete") &&
    surveyFeedback.dataset.reason === "incomplete"
  ) {
    hideFeedback();
  }

  saveState();
}

function handleTableClick(event) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const deleteButton = target.closest(".delete-row-button");

  if (!deleteButton) {
    return;
  }

  const row = deleteButton.closest("tr");

  if (!row) {
    return;
  }

  if (rowIsEmpty(row)) {
    removeRow(row);
    return;
  }

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

  if (!row || !row.isConnected) {
    return;
  }

  removeRow(row);
}

function handleAddRows() {
  appendRows(10);
  hideFeedbackOnDataChange();
  saveState();
}

function handleSchoolChange() {
  const nextSchool = schoolSelect.value;

  if (!nextSchool || nextSchool === currentSchool) {
    return;
  }

  hideFeedbackOnDataChange();

  if (!hasTableData()) {
    currentSchool = nextSchool;
    renderBookTable();
    saveState();
    return;
  }

  pendingSchool = nextSchool;
  schoolDialog.showModal();
}

function cancelSchoolChange() {
  pendingSchool = null;
  schoolDialog.close();
  schoolSelect.value = currentSchool;
}

function confirmSchoolChange() {
  if (pendingSchool === null) {
    schoolDialog.close();
    return;
  }

  currentSchool = pendingSchool;
  pendingSchool = null;
  schoolDialog.close();
  renderBookTable();
  saveState();
}

function formatRowNumbers(rowNumbers) {
  if (rowNumbers.length === 1) {
    return String(rowNumbers[0]);
  }

  if (rowNumbers.length === 2) {
    return `${rowNumbers[0]} e ${rowNumbers[1]}`;
  }

  return `${rowNumbers.slice(0, -1).join(", ")} e ${rowNumbers.at(-1)}`;
}

function sanitizeAllTextFields() {
  nameInput.value = sanitizeText(nameInput.value);

  booksBody
    .querySelectorAll(
      '[data-column-key="titulo"], [data-column-key="autor"], [data-column-key="editora"]'
    )
    .forEach((input) => {
      input.value = sanitizeText(input.value);
    });
}

function buildSurveyPayload(rows) {
  return {
    responsavel: sanitizeText(nameInput.value),
    cargo: cargoSelect.value,
    matricula: matriculaInput.value,
    escola: currentSchool,
    livros: rows.map((row) => {
      const values = getRowValues(row);

      return {
        titulo: values.titulo,
        autor: values.autor,
        editora: values.editora,
        isbn: normalizeIsbn(values.isbn),
        semIsbn: values.semIsbn,
        corEtiqueta: values.corEtiqueta,
        cdd: values.cdd,
        naoClassificado: values.naoClassificado,
        obraReferencia: values.obraReferencia,
        tema: values.tema,
        quantidade: Number(values.quantidade),
      };
    }),
  };
}

function setSaveButtonState(inProgress) {
  submitSurveyButton.disabled = inProgress;
  submitSurveyButton.textContent = inProgress
    ? SAVE_IN_PROGRESS_LABEL
    : SAVE_LABEL;
}

function markRowsWithSaveError() {
  booksBody.querySelectorAll("tr").forEach((row) => {
    if (!rowIsEmpty(row)) {
      row.dataset.saveError = "true";
      updateRowSaveStatus(row);
    }
  });
}

function handleSaveSuccess(rowSnapshots) {
  const savedAt = Date.now();

  booksBody.querySelectorAll("tr").forEach((row) => {
    delete row.dataset.saveError;

    if (rowIsEmpty(row)) {
      updateRowSaveStatus(row);
      return;
    }

    const sentSnapshot = rowSnapshots.get(getRowId(row));
    const currentSnapshot = getRowSnapshot(row);

    if (sentSnapshot && sentSnapshot === currentSnapshot) {
      row.dataset.savedAt = String(savedAt);
      row.dataset.savedSnapshot = currentSnapshot;
    }

    updateRowSaveStatus(row);
  });

  showFeedback("Levantamento salvo com sucesso.", "success", "saved");
  saveState();
}

function handleSaveFailure(error, payload) {
  const message =
    error instanceof Error ? error.message : "erro inesperado ao salvar";

  markRowsWithSaveError();
  showFeedback(
    `Não foi possível salvar o levantamento: ${message}`,
    "error",
    "submit"
  );
  showSaveErrorDialog(message);
  scheduleSaveRetry(payload, 1);
  saveState();
}

async function saveSurvey(payload, rowSnapshots) {
  isSaving = true;
  setSaveButtonState(true);

  try {
    const result = await sendSurveyToBackend(payload);

    if (result?.success === false) {
      throw new Error(
        result.message || "Não foi possível salvar o levantamento."
      );
    }

    handleSaveSuccess(rowSnapshots);
  } catch (error) {
    handleSaveFailure(error, payload);
  } finally {
    isSaving = false;
    setSaveButtonState(false);
  }
}

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

function cancelSaveRetry() {
  // TODO: clear the pending retry timer and close #save-error-dialog.
}

function handleSave() {
  if (isSaving) {
    return;
  }

  sanitizeAllTextFields();
  updateAllRowSaveStatuses();
  clearAllRowFlags();
  hideFeedback();

  touchedFields.name = true;
  touchedFields.cargo = true;
  touchedFields.matricula = true;
  updateIdentificationState();

  const rowElements = Array.from(booksBody.querySelectorAll("tr"));
  const partialRowNumbers = [];
  const completeRows = [];

  rowElements.forEach((row, index) => {
    const state = getRowState(row);

    if (state === "partial") {
      partialRowNumbers.push(index + 1);
      setRowFlag(row, true);
    } else if (state === "complete") {
      completeRows.push(row);
    }
  });

  if (!isValidName() || !isValidCargo() || !isValidMatricula()) {
    showFeedback(
      "Preencha corretamente o nome, o cargo e a matrícula antes de salvar.",
      "error",
      "submit"
    );
    return;
  }

  if (partialRowNumbers.length > 0) {
    showFeedback(
      `Linhas parcialmente preenchidas: ${formatRowNumbers(
        partialRowNumbers
      )}. Preencha todos os campos obrigatórios ou exclua essas linhas.`,
      "error",
      "incomplete"
    );
    booksBody
      .querySelector("tr.row-incomplete")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (!currentSchool) {
    showFeedback(
      "Selecione uma EMEB antes de salvar o levantamento.",
      "error",
      "submit"
    );
    return;
  }

  if (completeRows.length === 0) {
    showFeedback(
      "Preencha ao menos uma linha de livro antes de salvar.",
      "error",
      "submit"
    );
    return;
  }

  const payload = buildSurveyPayload(completeRows);
  const rowSnapshots = new Map(
    completeRows.map((row) => [getRowId(row), getRowSnapshot(row)])
  );

  saveState();
  saveSurvey(payload, rowSnapshots);
}

async function sendSurveyToBackend(payload, options = {}) {
  // TODO: replace this stub with the real backend call.
  // TODO: send `payload` as JSON to the Apps Script/Google Sites endpoint.
  // TODO: use options.signal to cancel in-flight requests.
  // TODO: map HTTP/network failures to thrown errors or { success: false, message }.
  void payload;
  void options;

  return { success: true };
}

async function deleteBookRow(book) {
  // TODO: notify the backend that a saved row was deleted.
  // TODO: define whether deletion is permanent or a stale/deleted marker.
  // TODO: include the backend row id once rows are persisted server-side.
  void book;

  return { success: true };
}

function positionCddTooltip() {
  const buttonRect = cddInfoButton.getBoundingClientRect();
  const tooltipRect = cddTooltip.getBoundingClientRect();
  const margin = 8;
  const gap = 8;
  let left = buttonRect.left + buttonRect.width / 2 - tooltipRect.width / 2;
  let top = buttonRect.bottom + gap;

  left = Math.min(
    Math.max(left, margin),
    window.innerWidth - tooltipRect.width - margin
  );

  if (top + tooltipRect.height > window.innerHeight - margin) {
    top = buttonRect.top - tooltipRect.height - gap;
  }

  cddTooltip.style.left = `${left}px`;
  cddTooltip.style.top = `${Math.max(margin, top)}px`;
}

function showCddTooltip() {
  cddTooltip.hidden = false;
  cddInfoButton.setAttribute("aria-expanded", "true");
  positionCddTooltip();
}

function hideCddTooltip(force = false) {
  if (!force && (cddTooltipPinned || cddTooltipHovered)) {
    return;
  }

  cddTooltip.hidden = true;
  cddInfoButton.setAttribute("aria-expanded", "false");
}

nameInput.addEventListener("input", handleNameInput);
nameInput.addEventListener("blur", () => {
  nameInput.value = sanitizeText(nameInput.value);
  touchedFields.name = true;
  updateIdentificationState();
  saveState();
});

cargoSelect.addEventListener("change", handleCargoChange);

matriculaInput.addEventListener("input", handleMatriculaInput);
matriculaInput.addEventListener("blur", () => {
  touchedFields.matricula = true;
  updateIdentificationState();
});

identificationForm.addEventListener("submit", (event) => {
  event.preventDefault();
});
schoolSelect.addEventListener("change", handleSchoolChange);
booksBody.addEventListener("input", handleTableChange);
booksBody.addEventListener("change", handleTableChange);
booksBody.addEventListener("focusout", (event) => {
  const target = event.target;

  if (!(target instanceof Element) || target.dataset.columnKey !== "isbn") {
    return;
  }

  const row = target.closest("tr");

  if (row) {
    handleIsbnChange(row);
  }
});
booksBody.addEventListener("click", handleTableClick);
addRowsButton.addEventListener("click", handleAddRows);
submitSurveyButton.addEventListener("click", handleSave);
cancelSchoolChangeButton.addEventListener("click", cancelSchoolChange);
confirmSchoolChangeButton.addEventListener("click", confirmSchoolChange);
cancelDeleteRowButton.addEventListener("click", cancelDeleteRow);
confirmDeleteRowButton.addEventListener("click", confirmDeleteRow);

schoolDialog.addEventListener("close", () => {
  if (pendingSchool !== null) {
    pendingSchool = null;
    schoolSelect.value = currentSchool;
  }
});

deleteRowDialog.addEventListener("close", () => {
  pendingDeleteRow = null;
});

cddInfoButton.addEventListener("pointerenter", (event) => {
  if (event.pointerType === "touch") {
    return;
  }

  cddTooltipHovered = true;
  showCddTooltip();
});
cddInfoButton.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "touch") {
    return;
  }

  cddTooltipHovered = false;

  if (
    event.relatedTarget instanceof Node &&
    cddTooltip.contains(event.relatedTarget)
  ) {
    return;
  }

  hideCddTooltip();
});
cddInfoButton.addEventListener("click", () => {
  cddTooltipPinned = !cddTooltipPinned;

  if (cddTooltipPinned) {
    showCddTooltip();
  } else {
    hideCddTooltip();
  }
});
cddInfoButton.addEventListener("blur", (event) => {
  if (
    event.relatedTarget instanceof Node &&
    cddTooltip.contains(event.relatedTarget)
  ) {
    return;
  }

  cddTooltipPinned = false;
  hideCddTooltip();
});

cddTooltip.addEventListener("pointerenter", () => {
  cddTooltipHovered = true;
});
cddTooltip.addEventListener("pointerleave", () => {
  cddTooltipHovered = false;
  hideCddTooltip();
});

document.addEventListener("click", (event) => {
  if (
    cddTooltip.hidden ||
    cddInfoButton.contains(event.target) ||
    cddTooltip.contains(event.target)
  ) {
    return;
  }

  cddTooltipPinned = false;
  cddTooltipHovered = false;
  hideCddTooltip(true);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || cddTooltip.hidden) {
    return;
  }

  cddTooltipPinned = false;
  cddTooltipHovered = false;
  hideCddTooltip(true);
});

window.addEventListener("resize", () => {
  if (!cddTooltip.hidden) {
    positionCddTooltip();
  }
});
document.addEventListener(
  "scroll",
  () => {
    if (!cddTooltip.hidden) {
      positionCddTooltip();
    }
  },
  true
);

async function init() {
  await loadOptions();
  populateSchoolOptions();
  restoreState();
  updateIdentificationState();
}

init();
