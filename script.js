function schoolSelector() {
  return [
    "EMEB Monteiro Lobato",
    "EMEB Cecília Meireles",
    "EMEB Paulo Freire",
    "EMEB Carlos Drummond de Andrade",
  ];
}

async function submitSurvey(payload) {
  return { success: true };
}

const STORAGE_KEY = "registro-livros:draft";
const SUBMIT_LABEL = "Enviar Levantamento de Livros";

const COLUMNS = [
  { key: "titulo", label: "Título do Livro", type: "text" },
  { key: "autor", label: "Autor", type: "text" },
  { key: "isbn", label: "ISBN", type: "text" },
  { key: "corEtiqueta", label: "Cor da Etiqueta", type: "color" },
  { key: "cdd", label: "CDD", type: "text" },
  { key: "quantidade", label: "Quantidade de Exemplares", type: "number" },
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
const cpfInput = document.getElementById("cpf");
const matriculaInput = document.getElementById("matricula");
const nameError = document.getElementById("responsavel-error");
const cpfError = document.getElementById("cpf-error");
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
const confirmSchoolChangeButton = document.getElementById("confirm-school-change");
const cddInfoButton = document.getElementById("cdd-info-button");
const cddTooltip = document.getElementById("cdd-tooltip");

const touchedFields = {
  name: false,
  cpf: false,
  matricula: false,
};

let currentSchool = "";
let pendingSchool = null;
let cddTooltipPinned = false;
let cddTooltipHovered = false;
let isSubmitting = false;

function populateSchoolOptions() {
  const fragment = document.createDocumentFragment();

  schoolSelector().forEach((school) => {
    const option = document.createElement("option");
    option.value = school;
    option.textContent = school;
    fragment.append(option);
  });

  schoolSelect.append(fragment);
}

function onlyDigits(value, maxLength) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function isValidName() {
  return nameInput.value.trim().length > 0;
}

function isValidCpf() {
  return /^\d{11}$/.test(cpfInput.value);
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
  const cpfValid = isValidCpf();
  const matriculaValid = isValidMatricula();

  setFieldError(nameInput, nameError, nameValid, touchedFields.name);
  setFieldError(cpfInput, cpfError, cpfValid, touchedFields.cpf);
  setFieldError(
    matriculaInput,
    matriculaError,
    matriculaValid,
    touchedFields.matricula
  );

  const formValid = nameValid && cpfValid && matriculaValid;

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

function createInput(label, type) {
  const input = document.createElement("input");
  input.type = type;
  input.autocomplete = "off";
  input.setAttribute("aria-label", label);

  if (type === "number") {
    input.min = "1";
    input.step = "1";
    input.inputMode = "numeric";
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

function createBookRow(values = {}) {
  const row = document.createElement("tr");

  COLUMNS.forEach((column) => {
    const cell = document.createElement("td");
    const control =
      column.type === "color"
        ? createColorSelect(column.label)
        : createInput(column.label, column.type);

    if (values[column.key] !== undefined && values[column.key] !== null) {
      control.value = String(values[column.key]);
    }

    if (column.type === "color") {
      applyColorStyle(control);
    }

    cell.append(control);
    row.append(cell);
  });

  const actionCell = document.createElement("td");
  actionCell.className = "row-actions";
  actionCell.append(createDeleteButton());
  row.append(actionCell);

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

function getRowControls(row) {
  return Array.from(row.querySelectorAll("input, select"));
}

function getRowValues(row) {
  const controls = getRowControls(row);
  const values = {};

  COLUMNS.forEach((column, index) => {
    values[column.key] = controls[index]?.value ?? "";
  });

  return values;
}

function getRowState(row) {
  const values = getRowControls(row).map((control) => control.value.trim());

  if (values.every((value) => value === "")) {
    return "empty";
  }

  if (values.every((value) => value !== "")) {
    return "complete";
  }

  return "partial";
}

function setRowFlag(row, flagged) {
  row.classList.toggle("row-incomplete", flagged);

  getRowControls(row).forEach((control) => {
    if (flagged) {
      control.setAttribute(
        "aria-invalid",
        String(control.value.trim() === "")
      );
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

function saveState() {
  const state = {
    version: 1,
    form: {
      responsavel: nameInput.value,
      cpf: cpfInput.value,
      matricula: matriculaInput.value,
    },
    school: currentSchool,
    rows: Array.from(booksBody.querySelectorAll("tr")).map(getRowValues),
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
  nameInput.value =
    typeof form.responsavel === "string" ? form.responsavel : "";
  cpfInput.value = onlyDigits(String(form.cpf ?? ""), 11);
  matriculaInput.value = onlyDigits(String(form.matricula ?? ""), 5);

  const savedSchool = typeof state.school === "string" ? state.school : "";
  const schoolExists = Array.from(schoolSelect.options).some(
    (option) => option.value !== "" && option.value === savedSchool
  );

  if (schoolExists) {
    currentSchool = savedSchool;
    schoolSelect.value = savedSchool;
  }

  const rows = Array.isArray(state.rows) ? state.rows : [];

  if (schoolExists || rows.length > 0) {
    renderBookTable(rows);
  }
}

function handleNameInput() {
  updateIdentificationState();
  hideFeedbackOnDataChange();
  saveState();
}

function handleCpfInput() {
  cpfInput.value = onlyDigits(cpfInput.value, 11);
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

function handleTableChange(event) {
  if (!hasEmptyRow()) {
    appendRows(1);
  }

  const row = event.target.closest("tr");

  if (row) {
    refreshFlaggedRow(row);
  }

  hideFeedbackOnDataChange();
  saveState();
}

function handleTableClick(event) {
  const deleteButton = event.target.closest(".delete-row-button");

  if (!deleteButton) {
    return;
  }

  const row = deleteButton.closest("tr");

  if (!row) {
    return;
  }

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

function buildSurveyPayload(rows) {
  return {
    responsavel: nameInput.value.trim(),
    cpf: cpfInput.value,
    matricula: matriculaInput.value,
    escola: currentSchool,
    livros: rows.map((row) => {
      const values = getRowValues(row);

      return {
        titulo: values.titulo.trim(),
        autor: values.autor.trim(),
        isbn: values.isbn.trim(),
        corEtiqueta: values.corEtiqueta,
        cdd: values.cdd.trim(),
        quantidade: Number(values.quantidade),
      };
    }),
  };
}

async function handleSubmitSurvey() {
  if (isSubmitting) {
    return;
  }

  clearAllRowFlags();
  hideFeedback();

  touchedFields.name = true;
  touchedFields.cpf = true;
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

  if (!isValidName() || !isValidCpf() || !isValidMatricula()) {
    showFeedback(
      "Preencha corretamente o nome, o CPF e a matrícula antes de enviar.",
      "error",
      "submit"
    );
    return;
  }

  if (partialRowNumbers.length > 0) {
    showFeedback(
      `Linhas parcialmente preenchidas: ${formatRowNumbers(
        partialRowNumbers
      )}. Preencha todos os campos ou exclua essas linhas.`,
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
      "Selecione uma EMEB antes de enviar o levantamento.",
      "error",
      "submit"
    );
    return;
  }

  if (completeRows.length === 0) {
    showFeedback(
      "Preencha ao menos uma linha de livro antes de enviar.",
      "error",
      "submit"
    );
    return;
  }

  const payload = buildSurveyPayload(completeRows);

  isSubmitting = true;
  submitSurveyButton.disabled = true;
  submitSurveyButton.textContent = "Enviando...";

  try {
    const result = await submitSurvey(payload);

    if (result?.success === false) {
      throw new Error(
        result.message || "Não foi possível enviar o levantamento."
      );
    }

    showFeedback(
      "Levantamento de livros enviado com sucesso.",
      "success",
      "sent"
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado no envio.";

    showFeedback(
      `Não foi possível enviar o levantamento: ${message}`,
      "error",
      "submit"
    );
  } finally {
    isSubmitting = false;
    submitSurveyButton.disabled = false;
    submitSurveyButton.textContent = SUBMIT_LABEL;
  }
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
  touchedFields.name = true;
  updateIdentificationState();
});

cpfInput.addEventListener("input", handleCpfInput);
cpfInput.addEventListener("blur", () => {
  touchedFields.cpf = true;
  updateIdentificationState();
});

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
booksBody.addEventListener("click", handleTableClick);
addRowsButton.addEventListener("click", handleAddRows);
submitSurveyButton.addEventListener("click", handleSubmitSurvey);
cancelSchoolChangeButton.addEventListener("click", cancelSchoolChange);
confirmSchoolChangeButton.addEventListener("click", confirmSchoolChange);

schoolDialog.addEventListener("close", () => {
  if (pendingSchool !== null) {
    pendingSchool = null;
    schoolSelect.value = currentSchool;
  }
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
cddInfoButton.addEventListener("blur", () => {
  cddTooltipPinned = false;
  hideCddTooltip();
});

document.addEventListener("click", (event) => {
  if (cddTooltip.hidden || cddInfoButton.contains(event.target)) {
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

populateSchoolOptions();
restoreState();
updateIdentificationState();
