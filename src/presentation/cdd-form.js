import { COLOR_OPTIONS } from "../config.js";
import { getInvalidCddRanges } from "../domain/validation.js";
import { getElement } from "./dom.js";
import { renderSaveStatus } from "./save-status.js";

export function createCddForm({ categories, onDataChange }) {
  const section = getElement("cdd-form-section");
  const body = getElement("cdd-form-body");
  const status = getElement("cdd-form-status");

  const rows = [];
  let meta = {
    savedAt: null,
    savedSnapshot: null,
    saveError: false,
  };

  function createRow(category, index) {
    const row = document.createElement("tr");
    row.dataset.cddIndex = String(index);
    row.dataset.cddRange = category.range;

    const labelCell = document.createElement("td");
    labelCell.className = "cdd-label-cell";

    const color = COLOR_OPTIONS.find(
      (option) => option.value === category.color
    );
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

    rows.push({
      category,
      row,
      checkbox,
      quantityInput,
    });

    return row;
  }

  function getValues() {
    return rows.map(({ category, checkbox, quantityInput }) => ({
      range: category.range,
      color: category.color,
      label: category.label,
      quantidade: checkbox.checked ? 0 : Number(quantityInput.value) || 0,
      semAcervo: checkbox.checked,
    }));
  }

  function getSnapshot() {
    return JSON.stringify(
      rows.map(({ category, checkbox, quantityInput }) => ({
        range: category.range,
        quantidade: checkbox.checked ? 0 : Number(quantityInput.value) || 0,
        semAcervo: checkbox.checked,
      }))
    );
  }

  function updateStatus() {
    renderSaveStatus(status, {
      savedAt: meta.savedAt,
      savedSnapshot: meta.savedSnapshot,
      currentSnapshot: getSnapshot(),
      saveError: meta.saveError,
    });
  }

  function render() {
    rows.length = 0;
    body.replaceChildren();

    const fragment = document.createDocumentFragment();

    categories.forEach((category, index) => {
      fragment.append(createRow(category, index));
    });

    body.append(fragment);
    updateStatus();
  }

  function restore(items, cddMeta) {
    if (Array.isArray(items)) {
      items.forEach((item) => {
        if (!item || typeof item !== "object") {
          return;
        }

        const entry = rows.find(
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

    if (cddMeta && typeof cddMeta === "object") {
      meta = {
        savedAt: cddMeta.savedAt || null,
        savedSnapshot:
          typeof cddMeta.savedSnapshot === "string"
            ? cddMeta.savedSnapshot
            : null,
        saveError: Boolean(cddMeta.saveError),
      };
    }

    updateStatus();
  }

  function clearFlags() {
    rows.forEach(({ quantityInput }) => {
      quantityInput.removeAttribute("aria-invalid");
    });
  }

  function validate() {
    const invalidRanges = getInvalidCddRanges(getValues());

    rows.forEach(({ category, quantityInput }) => {
      if (invalidRanges.includes(category.range)) {
        quantityInput.setAttribute("aria-invalid", "true");
      } else {
        quantityInput.removeAttribute("aria-invalid");
      }
    });

    return invalidRanges;
  }

  function scrollToFirstInvalid() {
    body
      .querySelector('input[aria-invalid="true"]')
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function handleChange(event) {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const row = target.closest("tr");

    if (!row) {
      return;
    }

    const entry = rows.find((candidate) => candidate.row === row);

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

    updateStatus();
    onDataChange();
  }

  function hasData() {
    return getValues().some((item) => item.semAcervo || item.quantidade > 0);
  }

  function reset() {
    rows.forEach(({ checkbox, quantityInput }) => {
      checkbox.checked = false;
      quantityInput.disabled = false;
      quantityInput.value = "0";
      quantityInput.removeAttribute("aria-invalid");
    });

    meta = {
      savedAt: null,
      savedSnapshot: null,
      saveError: false,
    };

    updateStatus();
  }

  function getMeta() {
    return {
      savedAt: meta.savedAt,
      savedSnapshot: meta.savedSnapshot,
      saveError: meta.saveError,
    };
  }

  function applySaveSuccess(savedAt, cddSnapshot) {
    meta = {
      savedAt,
      savedSnapshot: cddSnapshot,
      saveError: false,
    };
    updateStatus();
  }

  function markError() {
    meta.saveError = true;
    updateStatus();
  }

  function show() {
    section.hidden = false;
  }

  function wireEvents() {
    body.addEventListener("input", handleChange);
    body.addEventListener("change", handleChange);
  }

  return {
    render,
    restore,
    updateStatus,
    clearFlags,
    validate,
    scrollToFirstInvalid,
    getValues,
    getSnapshot,
    getMeta,
    hasData,
    reset,
    applySaveSuccess,
    markError,
    show,
    wireEvents,
  };
}
