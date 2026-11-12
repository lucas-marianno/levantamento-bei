/*
 * Active v3 implementation.
 * CDD quantity form + one book table per theme, generated from options.json.
 */

const V3_STORAGE_KEY = "registro-livros:v3:draft";
const V3_DRAFT_VERSION = 3;
const SAVE_LABEL = "Salvar";
const SAVE_IN_PROGRESS_LABEL = "Salvando...";
const OPTIONS_URL = "data/options.json";

const FALLBACK_OPTIONS = {
  schools: ["EMEB Exemplo 1", "EMEB Exemplo 2"],
  v3: {
    initialThemeRows: 5,
    cddCategories: [
      { range: "000-099", color: "BRANCA", label: "Generalidades" },
      {
        range: "100-199",
        color: "AMARELA",
        label: "Filosofia e Religião",
      },
      { range: "200-299", color: "AZUL", label: "Religião" },
      { range: "300-399", color: "VERDE", label: "Ciências Sociais" },
    ],
    themes: [
      { id: "indigena", label: "Temática Indígena" },
      { id: "africana", label: "Temática Africana" },
    ],
  },
};
let appOptions = { ...FALLBACK_OPTIONS };
const THEME_COLUMNS = [
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
// v3 DOM references.
const cddFormSection = document.getElementById("cdd-form-section");
const cddFormBody = document.getElementById("cdd-form-body");
const cddFormStatus = document.getElementById("cdd-form-status");
const cddFormInfoButton = document.getElementById("cdd-form-info-button");
const themeBlocksContainer = document.getElementById("theme-blocks");
const saveSection = document.getElementById("save-section");
const submitSurveyButtonV3 = document.getElementById("submit-survey-v3");
const surveyFeedbackV3 = document.getElementById("survey-feedback-v3");

const schoolDialog = document.getElementById("school-change-dialog");
const cancelSchoolChangeButton = document.getElementById("cancel-school-change");
const confirmSchoolChangeButton = document.getElementById(
  "confirm-school-change"
);
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
const themeBlocks = new Map();
const cddFormRows = [];
let cddFormMeta = {
  savedAt: null,
  savedSnapshot: null,
  saveError: false,
};

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

function getRowControl(row, key) {
  return row.querySelector(`[data-column-key="${key}"]`);
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

  if (column.key === "quantidade") {
    const quantity = Number(value);
    return Number.isInteger(quantity) && quantity >= 1;
  }

  return true;
}

function cancelDeleteRow() {
  pendingDeleteRow = null;
  deleteRowDialog.close();
}

function cancelSchoolChange() {
  pendingSchool = null;
  schoolDialog.close();
  schoolSelect.value = currentSchool;
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

function normalizeCddCategories(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.range === "string" &&
        item.range.trim() !== "" &&
        typeof item.label === "string" &&
        item.label.trim() !== ""
    )
    .map((item) => ({
      range: item.range.trim(),
      color: typeof item.color === "string" ? item.color.trim() : "",
      label: item.label.trim(),
    }));
}

function normalizeThemes(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  const seen = new Set();

  return list
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.label === "string" &&
        item.label.trim() !== ""
    )
    .map((item, index) => {
      const baseId =
        typeof item.id === "string" && item.id.trim() !== ""
          ? item.id.trim()
          : `tema-${index + 1}`;
      let id = baseId;
      let suffix = 2;

      while (seen.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }

      seen.add(id);

      return { id, label: item.label.trim() };
    });
}

async function loadOptionsV3() {
  try {
    const response = await fetch(OPTIONS_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const cddCategories = normalizeCddCategories(data?.v3?.cddCategories);
    const themes = normalizeThemes(data?.v3?.themes);
    const initialThemeRows =
      Number.isInteger(data?.v3?.initialThemeRows) &&
      data.v3.initialThemeRows > 0
        ? data.v3.initialThemeRows
        : FALLBACK_OPTIONS.v3.initialThemeRows;

    appOptions = {
      ...appOptions,
      schools:
        Array.isArray(data.schools) && data.schools.length > 0
          ? data.schools
          : FALLBACK_OPTIONS.schools,
      v3: {
        initialThemeRows,
        cddCategories:
          cddCategories.length > 0
            ? cddCategories
            : FALLBACK_OPTIONS.v3.cddCategories,
        themes: themes.length > 0 ? themes : FALLBACK_OPTIONS.v3.themes,
      },
    };
  } catch (error) {
    console.warn(
      "Não foi possível carregar data/options.json. Usando dados de exemplo.",
      error
    );
    appOptions = { ...FALLBACK_OPTIONS };
  }
}

function createCddFormRow(category, index) {
  const row = document.createElement("tr");
  row.dataset.cddIndex = String(index);
  row.dataset.cddRange = category.range;

  const labelCell = document.createElement("td");
  labelCell.className = "cdd-label-cell";

  const color = COLOR_OPTIONS.find((option) => option.value === category.color);
  const dot = document.createElement("span");
  dot.className = "cdd-color-dot";
  dot.style.backgroundColor = color?.hex ?? "transparent";
  dot.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.textContent = `(${category.range}) ${category.color} - ${category.label}`;

  labelCell.append(dot, label);

  const quantityCell = document.createElement("td");
  quantityCell.className = "cdd-quantity-cell";

  const quantityInput = document.createElement("input");
  quantityInput.type = "number";
  quantityInput.min = "0";
  quantityInput.step = "1";
  quantityInput.inputMode = "numeric";
  quantityInput.value = "0";
  quantityInput.autocomplete = "off";
  quantityInput.className = "cdd-quantity-input";
  quantityInput.setAttribute(
    "aria-label",
    `Quantidade de exemplares da classificação ${category.range}`
  );
  quantityCell.append(quantityInput);

  const unavailableCell = document.createElement("td");
  unavailableCell.className = "cdd-unavailable-cell";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "row-checkbox cdd-unavailable-checkbox";
  checkbox.autocomplete = "off";
  checkbox.setAttribute(
    "aria-label",
    `Não possuímos acervo com a classificação ${category.range}`
  );
  unavailableCell.append(checkbox);

  row.append(labelCell, quantityCell, unavailableCell);

  cddFormRows.push({
    category,
    row,
    checkbox,
    quantityInput,
  });

  return row;
}

function renderCddForm() {
  cddFormRows.length = 0;
  cddFormBody.replaceChildren();

  const fragment = document.createDocumentFragment();

  appOptions.v3.cddCategories.forEach((category, index) => {
    fragment.append(createCddFormRow(category, index));
  });

  cddFormBody.append(fragment);
  updateCddFormStatus();
}

function getCddFormValues() {
  return cddFormRows.map(({ category, checkbox, quantityInput }) => ({
    range: category.range,
    color: category.color,
    label: category.label,
    quantidade: checkbox.checked ? 0 : Number(quantityInput.value) || 0,
    semAcervo: checkbox.checked,
  }));
}

function getCddFormSnapshot() {
  return JSON.stringify(
    cddFormRows.map(({ category, checkbox, quantityInput }) => ({
      range: category.range,
      quantidade: checkbox.checked ? 0 : Number(quantityInput.value) || 0,
      semAcervo: checkbox.checked,
    }))
  );
}

function restoreCddFormValues(items) {
  if (!Array.isArray(items)) {
    return;
  }

  items.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const entry = cddFormRows.find(
      (candidate) => candidate.category.range === item.range
    );

    if (!entry) {
      return;
    }

    entry.checkbox.checked = Boolean(item.semAcervo);
    entry.quantityInput.disabled = entry.checkbox.checked;

    const quantity = Number(item.quantidade);
    entry.quantityInput.value = String(
      Number.isInteger(quantity) && quantity >= 0 ? quantity : 0
    );
  });
}

function updateCddFormStatus() {
  if (!cddFormStatus) {
    return;
  }

  const snapshot = getCddFormSnapshot();
  const savedAt = Number(cddFormMeta.savedAt) || 0;
  const savedAtText = savedAt ? formatSavedAt(savedAt) : "";

  if (cddFormMeta.saveError) {
    cddFormStatus.textContent = savedAt
      ? `Erro ao salvar, último salvamento em ${savedAtText}`
      : "Erro ao salvar";
    cddFormStatus.className = "save-status error";
    return;
  }

  if (!savedAt) {
    cddFormStatus.textContent = "Entrada não salva";
    cddFormStatus.className = "save-status pending";
    return;
  }

  if (snapshot !== cddFormMeta.savedSnapshot) {
    cddFormStatus.textContent = `Alterações pendentes. Último salvamento em ${savedAtText}`;
    cddFormStatus.className = "save-status pending";
    return;
  }

  cddFormStatus.textContent = `Salvo em ${savedAtText}`;
  cddFormStatus.className = "save-status saved";
}

function clearCddFormFlags() {
  cddFormRows.forEach(({ quantityInput }) => {
    quantityInput.removeAttribute("aria-invalid");
  });
}

function validateCddForm() {
  const invalidRanges = [];

  cddFormRows.forEach(({ category, checkbox, quantityInput }) => {
    const quantity = Number(quantityInput.value);
    const valid =
      checkbox.checked || (Number.isInteger(quantity) && quantity > 0);

    if (valid) {
      quantityInput.removeAttribute("aria-invalid");
    } else {
      quantityInput.setAttribute("aria-invalid", "true");
      invalidRanges.push(category.range);
    }
  });

  return invalidRanges;
}

function handleCddFormChange(event) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const row = target.closest("tr");

  if (!row) {
    return;
  }

  const entry = cddFormRows.find((candidate) => candidate.row === row);

  if (!entry) {
    return;
  }

  if (target === entry.checkbox) {
    entry.quantityInput.disabled = entry.checkbox.checked;

    if (entry.checkbox.checked) {
      entry.quantityInput.value = "0";
      entry.quantityInput.removeAttribute("aria-invalid");
    }
  }

  if (target === entry.quantityInput) {
    target.removeAttribute("aria-invalid");

    if (event.type === "change") {
      const quantity = Number(target.value);
      target.value = String(
        Number.isInteger(quantity) && quantity >= 0 ? quantity : 0
      );
    }
  }

  updateCddFormStatus();
  hideFeedbackOnDataChangeV3();
  saveStateV3();
}

function getThemeRowControlMap(row) {
  const controls = {};

  THEME_COLUMNS.forEach((column) => {
    controls[column.key] = getRowControl(row, column.key);
  });

  return controls;
}

function getThemeRowValues(row) {
  const controls = getThemeRowControlMap(row);
  const values = {};

  THEME_COLUMNS.forEach((column) => {
    values[column.key] = getControlValue(controls[column.key], column.type);
  });

  return values;
}

function getThemeRowSnapshot(row) {
  return JSON.stringify(getThemeRowValues(row));
}

function themeRowValuesAreEmpty(values) {
  return !THEME_COLUMNS.some((column) => {
    const value = values[column.key];

    return column.type === "checkbox"
      ? Boolean(value)
      : String(value ?? "").trim() !== "";
  });
}

function getThemeInvalidColumnKeys(values) {
  return THEME_COLUMNS.filter(
    (column) => !isColumnValueValid(column, values)
  ).map((column) => column.key);
}

function getThemeRowState(row) {
  const values = getThemeRowValues(row);

  if (themeRowValuesAreEmpty(values)) {
    return "empty";
  }

  return getThemeInvalidColumnKeys(values).length === 0 ? "complete" : "partial";
}

function setThemeRowFlag(row, flagged) {
  const controls = getThemeRowControlMap(row);
  const missingKeys = new Set(
    getThemeInvalidColumnKeys(getThemeRowValues(row))
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

  if (themeRowValuesAreEmpty(values)) {
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

function updateAllThemeRowSaveStatuses() {
  themeBlocks.forEach((block) => {
    block.tbody.querySelectorAll("tr").forEach(updateThemeRowSaveStatus);
  });
}

function clearAllThemeRowFlags() {
  themeBlocks.forEach((block) => {
    block.tbody.querySelectorAll("tr.row-incomplete").forEach((row) => {
      setThemeRowFlag(row, false);
    });
  });
}

function refreshThemeFlaggedRow(row) {
  if (!row.classList.contains("row-incomplete")) {
    return;
  }

  if (getThemeRowState(row) !== "partial") {
    setThemeRowFlag(row, false);
  }

  const stillFlagged = themeBlocksContainer.querySelector("tr.row-incomplete");

  if (!stillFlagged && surveyFeedbackV3.dataset.reason === "incomplete") {
    hideFeedbackV3();
  }
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

function createThemeBlock(theme, index) {
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
  addButton.addEventListener("click", () => {
    appendThemeRows(theme.id, 10);
    hideFeedbackOnDataChangeV3();
    saveStateV3();
  });
  actions.append(addButton);

  section.append(heading, scroll, actions);

  const block = { theme, section, tbody };
  themeBlocks.set(theme.id, block);

  return section;
}

function renderThemeBlocks() {
  themeBlocks.clear();
  themeBlocksContainer.replaceChildren();

  const fragment = document.createDocumentFragment();

  appOptions.v3.themes.forEach((theme, index) => {
    fragment.append(createThemeBlock(theme, index));
  });

  themeBlocksContainer.append(fragment);
}

function appendThemeRows(themeId, count) {
  const block = themeBlocks.get(themeId);

  if (!block) {
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < count; index += 1) {
    fragment.append(createThemeRow(block.theme));
  }

  block.tbody.append(fragment);
}

function getThemeBlockByRow(row) {
  return themeBlocks.get(row.dataset.themeId) || null;
}

function themeRowIsEmpty(row) {
  return getThemeRowState(row) === "empty";
}

function themeBlockHasEmptyRow(block) {
  return Array.from(block.tbody.querySelectorAll("tr")).some(themeRowIsEmpty);
}

function handleThemeTableChange(event) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const row = target.closest("tr");

  if (!row || row.dataset.rowType !== "theme") {
    return;
  }

  updateThemeRowSaveStatus(row);
  refreshThemeFlaggedRow(row);

  const block = getThemeBlockByRow(row);

  if (block && !themeBlockHasEmptyRow(block)) {
    appendThemeRows(block.theme.id, 1);
  }

  hideFeedbackOnDataChangeV3();
  saveStateV3();
}

function notifySavedThemeRowDeletion(row) {
  if (!Number(row.dataset.savedAt)) {
    return;
  }

  const block = getThemeBlockByRow(row);
  const rowPayload = {
    rowId: getRowId(row),
    themeId: row.dataset.themeId,
    themeLabel: block?.theme.label ?? "",
    ...getThemeRowValues(row),
  };

  void deleteBookRow(rowPayload).catch((error) => {
    console.error("Falha ao notificar a exclusão da linha.", error);
  });
}

function removeThemeRow(row) {
  notifySavedThemeRowDeletion(row);

  const block = getThemeBlockByRow(row);
  row.remove();

  if (block && !block.tbody.querySelector("tr")) {
    appendThemeRows(block.theme.id, 1);
  }

  hideFeedbackOnDataChangeV3();

  if (
    !themeBlocksContainer.querySelector("tr.row-incomplete") &&
    surveyFeedbackV3.dataset.reason === "incomplete"
  ) {
    hideFeedbackV3();
  }

  saveStateV3();
}

function handleThemeTableClick(event) {
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

  if (themeRowIsEmpty(row)) {
    removeThemeRow(row);
    return;
  }

  pendingDeleteRow = row;

  if (!deleteRowDialog.open) {
    deleteRowDialog.showModal();
  }
}

function confirmDeleteRowV3() {
  const row = pendingDeleteRow;
  pendingDeleteRow = null;
  deleteRowDialog.close();

  if (!row || !row.isConnected || row.dataset.rowType !== "theme") {
    return;
  }

  removeThemeRow(row);
}

function hasSurveyDataV3() {
  const cddHasData = getCddFormValues().some(
    (item) => item.semAcervo || item.quantidade > 0
  );

  if (cddHasData) {
    return true;
  }

  return Array.from(themeBlocks.values()).some((block) =>
    Array.from(block.tbody.querySelectorAll("tr")).some(
      (row) => !themeRowIsEmpty(row)
    )
  );
}

function resetSurveyDataV3() {
  cddFormRows.forEach(({ checkbox, quantityInput }) => {
    checkbox.checked = false;
    quantityInput.disabled = false;
    quantityInput.value = "0";
    quantityInput.removeAttribute("aria-invalid");
  });

  cddFormMeta = {
    savedAt: null,
    savedSnapshot: null,
    saveError: false,
  };

  themeBlocks.forEach((block) => {
    block.tbody.replaceChildren();
    appendThemeRows(block.theme.id, appOptions.v3.initialThemeRows);
  });

  updateCddFormStatus();
}

function showSurveySectionsV3() {
  cddFormSection.hidden = false;
  themeBlocks.forEach((block) => {
    block.section.hidden = false;
  });
  saveSection.hidden = false;
}

function handleSchoolChangeV3() {
  const nextSchool = schoolSelect.value;

  if (!nextSchool || nextSchool === currentSchool) {
    return;
  }

  hideFeedbackOnDataChangeV3();

  if (!hasSurveyDataV3()) {
    currentSchool = nextSchool;
    showSurveySectionsV3();
    saveStateV3();
    return;
  }

  pendingSchool = nextSchool;
  schoolDialog.showModal();
}

function confirmSchoolChangeV3() {
  if (pendingSchool === null) {
    schoolDialog.close();
    return;
  }

  currentSchool = pendingSchool;
  pendingSchool = null;
  schoolDialog.close();
  resetSurveyDataV3();
  showSurveySectionsV3();
  saveStateV3();
}

function showFeedbackV3(message, type, reason) {
  surveyFeedbackV3.textContent = message;
  surveyFeedbackV3.className = `feedback ${type}`;
  surveyFeedbackV3.dataset.reason = reason;
  surveyFeedbackV3.hidden = false;
}

function hideFeedbackV3() {
  surveyFeedbackV3.hidden = true;
  surveyFeedbackV3.textContent = "";
  surveyFeedbackV3.className = "feedback";
  delete surveyFeedbackV3.dataset.reason;
}

function hideFeedbackOnDataChangeV3() {
  if (surveyFeedbackV3.dataset.reason !== "incomplete") {
    hideFeedbackV3();
  }
}

function handleNameInputV3() {
  updateIdentificationState();
  hideFeedbackOnDataChangeV3();
  saveStateV3();
}

function handleCargoChangeV3() {
  touchedFields.cargo = true;
  updateIdentificationState();
  hideFeedbackOnDataChangeV3();
  saveStateV3();
}

function handleMatriculaInputV3() {
  matriculaInput.value = onlyDigits(matriculaInput.value, 5);
  updateIdentificationState();
  hideFeedbackOnDataChangeV3();
  saveStateV3();
}

function saveStateV3() {
  const state = {
    version: V3_DRAFT_VERSION,
    form: {
      responsavel: nameInput.value,
      cargo: cargoSelect.value,
      matricula: matriculaInput.value,
    },
    school: currentSchool,
    cdd: getCddFormValues(),
    cddMeta: {
      savedAt: cddFormMeta.savedAt,
      savedSnapshot: cddFormMeta.savedSnapshot,
      saveError: cddFormMeta.saveError,
    },
    themes: {},
  };

  themeBlocks.forEach((block, themeId) => {
    state.themes[themeId] = Array.from(
      block.tbody.querySelectorAll("tr")
    ).map((row) => ({
      ...getThemeRowValues(row),
      _meta: {
        id: getRowId(row),
        savedAt: row.dataset.savedAt || null,
        savedSnapshot: row.dataset.savedSnapshot || null,
        saveError: row.dataset.saveError === "true",
      },
    }));
  });

  try {
    localStorage.setItem(V3_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable or full.
  }
}

function loadStateV3() {
  try {
    const rawState = localStorage.getItem(V3_STORAGE_KEY);
    return rawState ? JSON.parse(rawState) : null;
  } catch {
    return null;
  }
}

function restoreStateV3() {
  const state = loadStateV3();
  const form =
    state && typeof state.form === "object" && state.form ? state.form : {};

  nameInput.value = sanitizeText(
    typeof form.responsavel === "string" ? form.responsavel : ""
  );

  const savedCargo = typeof form.cargo === "string" ? form.cargo : "";
  const cargoExists = Array.from(cargoSelect.options).some(
    (option) => option.value !== "" && option.value === savedCargo
  );
  cargoSelect.value = cargoExists ? savedCargo : "";

  matriculaInput.value = onlyDigits(String(form.matricula ?? ""), 5);

  const savedSchool =
    state && typeof state.school === "string" ? state.school : "";

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

  if (state && Array.isArray(state.cdd)) {
    restoreCddFormValues(state.cdd);
  }

  if (state && state.cddMeta && typeof state.cddMeta === "object") {
    cddFormMeta = {
      savedAt: state.cddMeta.savedAt || null,
      savedSnapshot:
        typeof state.cddMeta.savedSnapshot === "string"
          ? state.cddMeta.savedSnapshot
          : null,
      saveError: Boolean(state.cddMeta.saveError),
    };
  }

  const themeState =
    state && state.themes && typeof state.themes === "object"
      ? state.themes
      : {};

  themeBlocks.forEach((block, themeId) => {
    const rows = Array.isArray(themeState[themeId])
      ? themeState[themeId]
      : [];

    block.tbody.replaceChildren();

    if (rows.length > 0) {
      rows.forEach((values) => {
        block.tbody.append(createThemeRow(block.theme, values));
      });
    } else {
      appendThemeRows(block.theme.id, appOptions.v3.initialThemeRows);
    }
  });

  updateCddFormStatus();

  if (savedSchool || hasSurveyDataV3()) {
    showSurveySectionsV3();
  }
}

function sanitizeAllTextFieldsV3() {
  nameInput.value = sanitizeText(nameInput.value);

  themeBlocksContainer
    .querySelectorAll(
      '[data-column-key="titulo"], [data-column-key="autor"], [data-column-key="editora"]'
    )
    .forEach((input) => {
      input.value = sanitizeText(input.value);
    });
}

function collectPartialThemeRows() {
  const groups = [];

  themeBlocks.forEach((block) => {
    const numbers = [];

    Array.from(block.tbody.querySelectorAll("tr")).forEach((row, index) => {
      if (getThemeRowState(row) === "partial") {
        numbers.push(index + 1);
        setThemeRowFlag(row, true);
      }
    });

    if (numbers.length > 0) {
      groups.push({ block, numbers });
    }
  });

  return groups;
}

function buildSurveyPayloadV3() {
  return {
    responsavel: sanitizeText(nameInput.value),
    cargo: cargoSelect.value,
    matricula: matriculaInput.value,
    escola: currentSchool,
    cdd: getCddFormValues(),
    temas: Array.from(themeBlocks.values()).map((block) => ({
      id: block.theme.id,
      label: block.theme.label,
      livros: Array.from(block.tbody.querySelectorAll("tr"))
        .map((row) => getThemeRowValues(row))
        .filter((values) => !themeRowValuesAreEmpty(values))
        .map((values) => ({
          titulo: values.titulo,
          autor: values.autor,
          editora: values.editora,
          quantidade: Number(values.quantidade),
        })),
    })),
  };
}

function setSaveButtonStateV3(inProgress) {
  submitSurveyButtonV3.disabled = inProgress;
  submitSurveyButtonV3.textContent = inProgress
    ? SAVE_IN_PROGRESS_LABEL
    : SAVE_LABEL;
}

function markThemeRowsWithSaveError() {
  themeBlocks.forEach((block) => {
    block.tbody.querySelectorAll("tr").forEach((row) => {
      if (!themeRowIsEmpty(row)) {
        row.dataset.saveError = "true";
        updateThemeRowSaveStatus(row);
      }
    });
  });
}

function handleSaveSuccessV3(rowSnapshots, cddSnapshot) {
  const savedAt = Date.now();

  themeBlocks.forEach((block) => {
    block.tbody.querySelectorAll("tr").forEach((row) => {
      delete row.dataset.saveError;

      if (themeRowIsEmpty(row)) {
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
  });

  cddFormMeta = {
    savedAt,
    savedSnapshot: cddSnapshot,
    saveError: false,
  };
  updateCddFormStatus();

  showFeedbackV3("Levantamento salvo com sucesso.", "success", "saved");
  saveStateV3();
}

function handleSaveFailureV3(error, payload) {
  const message =
    error instanceof Error ? error.message : "erro inesperado ao salvar";

  markThemeRowsWithSaveError();

  cddFormMeta.saveError = true;
  updateCddFormStatus();

  showFeedbackV3(
    `Não foi possível salvar o levantamento: ${message}`,
    "error",
    "submit"
  );
  showSaveErrorDialog(message);
  scheduleSaveRetry(payload, 1);
  saveStateV3();
}

async function saveSurveyV3(payload, rowSnapshots, cddSnapshot) {
  isSaving = true;
  setSaveButtonStateV3(true);

  try {
    const result = await sendSurveyToBackend(payload);

    if (result?.success === false) {
      throw new Error(
        result.message || "Não foi possível salvar o levantamento."
      );
    }

    handleSaveSuccessV3(rowSnapshots, cddSnapshot);
  } catch (error) {
    handleSaveFailureV3(error, payload);
  } finally {
    isSaving = false;
    setSaveButtonStateV3(false);
  }
}

function handleSaveV3() {
  if (isSaving) {
    return;
  }

  sanitizeAllTextFieldsV3();
  updateAllThemeRowSaveStatuses();
  clearAllThemeRowFlags();
  clearCddFormFlags();
  hideFeedbackV3();

  touchedFields.name = true;
  touchedFields.cargo = true;
  touchedFields.matricula = true;
  updateIdentificationState();

  if (!isValidName() || !isValidCargo() || !isValidMatricula()) {
    showFeedbackV3(
      "Preencha corretamente o nome, o cargo e a matrícula antes de salvar.",
      "error",
      "submit"
    );
    return;
  }

  const partialGroups = collectPartialThemeRows();

  if (partialGroups.length > 0) {
    const detail = partialGroups
      .map(
        ({ block, numbers }) =>
          `${block.theme.label}: ${formatRowNumbers(numbers)}`
      )
      .join("; ");

    showFeedbackV3(
      `Linhas parcialmente preenchidas — ${detail}. Preencha todos os campos obrigatórios ou exclua essas linhas.`,
      "error",
      "incomplete"
    );
    partialGroups[0].block.tbody
      .querySelector("tr.row-incomplete")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const invalidCddRanges = validateCddForm();

  if (invalidCddRanges.length > 0) {
    showFeedbackV3(
      `Informe uma quantidade maior que 0 ou marque "Não possuímos acervo com essa classificação" para: ${invalidCddRanges.join(
        ", "
      )}.`,
      "error",
      "submit"
    );
    cddFormBody
      .querySelector('input[aria-invalid="true"]')
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (!currentSchool) {
    showFeedbackV3(
      "Selecione uma EMEB antes de salvar o levantamento.",
      "error",
      "submit"
    );
    return;
  }

  const rowSnapshots = new Map();

  themeBlocks.forEach((block) => {
    block.tbody.querySelectorAll("tr").forEach((row) => {
      if (!themeRowIsEmpty(row)) {
        rowSnapshots.set(getRowId(row), getThemeRowSnapshot(row));
      }
    });
  });

  const payload = buildSurveyPayloadV3();
  const cddSnapshot = getCddFormSnapshot();

  saveStateV3();
  saveSurveyV3(payload, rowSnapshots, cddSnapshot);
}

function positionCddFormTooltip() {
  const buttonRect = cddFormInfoButton.getBoundingClientRect();
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

function showCddFormTooltip() {
  cddTooltip.hidden = false;
  cddFormInfoButton.setAttribute("aria-expanded", "true");
  positionCddFormTooltip();
}

function hideCddFormTooltip(force = false) {
  if (!force && (cddTooltipPinned || cddTooltipHovered)) {
    return;
  }

  cddTooltip.hidden = true;
  cddFormInfoButton.setAttribute("aria-expanded", "false");
}

function wireV3CddTooltip() {
  cddFormInfoButton.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") {
      return;
    }

    cddTooltipHovered = true;
    showCddFormTooltip();
  });

  cddFormInfoButton.addEventListener("pointerleave", (event) => {
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

    hideCddFormTooltip();
  });

  cddFormInfoButton.addEventListener("click", () => {
    cddTooltipPinned = !cddTooltipPinned;

    if (cddTooltipPinned) {
      showCddFormTooltip();
    } else {
      hideCddFormTooltip();
    }
  });

  cddFormInfoButton.addEventListener("blur", (event) => {
    if (
      event.relatedTarget instanceof Node &&
      cddTooltip.contains(event.relatedTarget)
    ) {
      return;
    }

    cddTooltipPinned = false;
    hideCddFormTooltip();
  });

  cddTooltip.addEventListener("pointerenter", () => {
    cddTooltipHovered = true;
  });

  cddTooltip.addEventListener("pointerleave", () => {
    cddTooltipHovered = false;
    hideCddFormTooltip();
  });

  document.addEventListener("click", (event) => {
    if (
      cddTooltip.hidden ||
      cddFormInfoButton.contains(event.target) ||
      cddTooltip.contains(event.target)
    ) {
      return;
    }

    cddTooltipPinned = false;
    cddTooltipHovered = false;
    hideCddFormTooltip(true);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || cddTooltip.hidden) {
      return;
    }

    cddTooltipPinned = false;
    cddTooltipHovered = false;
    hideCddFormTooltip(true);
  });

  window.addEventListener("resize", () => {
    if (!cddTooltip.hidden) {
      positionCddFormTooltip();
    }
  });

  document.addEventListener(
    "scroll",
    () => {
      if (!cddTooltip.hidden) {
        positionCddFormTooltip();
      }
    },
    true
  );
}

function wireV3Events() {
  nameInput.addEventListener("input", handleNameInputV3);
  nameInput.addEventListener("blur", () => {
    nameInput.value = sanitizeText(nameInput.value);
    touchedFields.name = true;
    updateIdentificationState();
    saveStateV3();
  });

  cargoSelect.addEventListener("change", handleCargoChangeV3);

  matriculaInput.addEventListener("input", handleMatriculaInputV3);
  matriculaInput.addEventListener("blur", () => {
    touchedFields.matricula = true;
    updateIdentificationState();
  });

  identificationForm.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  schoolSelect.addEventListener("change", handleSchoolChangeV3);
  cancelSchoolChangeButton.addEventListener("click", cancelSchoolChange);
  confirmSchoolChangeButton.addEventListener("click", confirmSchoolChangeV3);

  cancelDeleteRowButton.addEventListener("click", cancelDeleteRow);
  confirmDeleteRowButton.addEventListener("click", confirmDeleteRowV3);

  schoolDialog.addEventListener("close", () => {
    if (pendingSchool !== null) {
      pendingSchool = null;
      schoolSelect.value = currentSchool;
    }
  });

  deleteRowDialog.addEventListener("close", () => {
    pendingDeleteRow = null;
  });

  cddFormBody.addEventListener("input", handleCddFormChange);
  cddFormBody.addEventListener("change", handleCddFormChange);

  themeBlocksContainer.addEventListener("input", handleThemeTableChange);
  themeBlocksContainer.addEventListener("change", handleThemeTableChange);
  themeBlocksContainer.addEventListener("click", handleThemeTableClick);

  submitSurveyButtonV3.addEventListener("click", handleSaveV3);

  wireV3CddTooltip();
}

async function initV3() {
  await loadOptionsV3();
  populateSchoolOptions();
  renderCddForm();
  renderThemeBlocks();
  restoreStateV3();
  updateIdentificationState();
  wireV3Events();
}

initV3();
