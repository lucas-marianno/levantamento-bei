import { sanitizeText } from "../domain/values.js";
import { generateRowId } from "../infrastructure/id.js";

export function createInput(label, type, column) {
  const input = document.createElement("input");
  input.type = type;
  input.autocomplete = "off";
  input.setAttribute("aria-label", label);

  if (type === "number") {
    input.min = "1";
    input.step = "1";
    input.inputMode = "numeric";
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

export function createDeleteButton() {
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

export function getRowControl(row, key) {
  return row.querySelector(`[data-column-key="${key}"]`);
}

export function getControlValue(control, type) {
  if (!control) {
    return type === "checkbox" ? false : "";
  }

  return type === "checkbox" ? control.checked : control.value;
}

export function setControlValue(control, type, value) {
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

export function getRowId(row) {
  if (!row.dataset.rowId) {
    row.dataset.rowId = generateRowId();
  }

  return row.dataset.rowId;
}
