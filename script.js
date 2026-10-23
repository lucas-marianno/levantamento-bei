function schoolSelector() {
  return [
    "EMEB Monteiro Lobato",
    "EMEB Cecília Meireles",
    "EMEB Paulo Freire",
    "EMEB Carlos Drummond de Andrade",
  ];
}

const COLUMNS = [
  { label: "Título do Livro", type: "text" },
  { label: "Autor", type: "text" },
  { label: "ISBN", type: "text" },
  { label: "Cor da Etiqueta", type: "color" },
  { label: "CDD (código decimal de dewey)", type: "text" },
  { label: "Quantidade de Exemplares", type: "number" },
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
const schoolSelect = document.getElementById("escola");
const bookSection = document.getElementById("book-section");
const booksBody = document.getElementById("books-body");
const addRowsButton = document.getElementById("add-rows");
const schoolDialog = document.getElementById("school-change-dialog");
const cancelSchoolChangeButton = document.getElementById("cancel-school-change");
const confirmSchoolChangeButton = document.getElementById("confirm-school-change");

let currentSchool = "";
let pendingSchool = null;

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

function createBookRow() {
  const row = document.createElement("tr");

  COLUMNS.forEach((column) => {
    const cell = document.createElement("td");
    const control =
      column.type === "color"
        ? createColorSelect(column.label)
        : createInput(column.label, column.type);

    cell.append(control);
    row.append(cell);
  });

  return row;
}

function appendRows(count) {
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < count; index += 1) {
    fragment.append(createBookRow());
  }

  booksBody.append(fragment);
}

function renderBookTable() {
  booksBody.replaceChildren();
  appendRows(10);
  bookSection.hidden = false;
}

function rowIsEmpty(row) {
  return Array.from(row.querySelectorAll("input, select")).every(
    (control) => control.value.trim() === ""
  );
}

function hasEmptyRow() {
  return Array.from(booksBody.querySelectorAll("tr")).some(rowIsEmpty);
}

function hasTableData() {
  return Array.from(booksBody.querySelectorAll("tr")).some(
    (row) => !rowIsEmpty(row)
  );
}

function handleTableChange() {
  if (!hasEmptyRow()) {
    appendRows(1);
  }
}

function handleSchoolChange() {
  const nextSchool = schoolSelect.value;

  if (nextSchool === currentSchool) {
    return;
  }

  if (!hasTableData()) {
    currentSchool = nextSchool;
    renderBookTable();
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
}

identificationForm.addEventListener("submit", (event) => {
  event.preventDefault();
});
schoolSelect.addEventListener("change", handleSchoolChange);
booksBody.addEventListener("input", handleTableChange);
booksBody.addEventListener("change", handleTableChange);
addRowsButton.addEventListener("click", () => appendRows(10));
cancelSchoolChangeButton.addEventListener("click", cancelSchoolChange);
confirmSchoolChangeButton.addEventListener("click", confirmSchoolChange);

schoolDialog.addEventListener("close", () => {
  if (pendingSchool !== null) {
    pendingSchool = null;
    schoolSelect.value = currentSchool;
  }
});

populateSchoolOptions();
