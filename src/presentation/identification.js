import {
  isValidCargo,
  isValidName,
} from "../domain/identification.js";
import { onlyDigits, sanitizeText } from "../domain/values.js";
import { getElement } from "./dom.js";

function isValidMatriculaFormat(value) {
  return /^\d{4,5}$/.test(String(value ?? ""));
}

export function createIdentification({
  onDataChange,
  onPersist,
  onSchoolChange,
  checkWhitelist,
}) {
  const form = getElement("identification-form");
  const nameInput = getElement("responsavel");
  const cargoSelect = getElement("cargo");
  const matriculaInput = getElement("matricula");
  const nameError = getElement("responsavel-error");
  const cargoError = getElement("cargo-error");
  const matriculaError = getElement("matricula-error");
  const schoolHint = getElement("escola-hint");
  const schoolSelect = getElement("escola");
  const defaultMatriculaErrorText = matriculaError.textContent;

  const touchedFields = {
    name: false,
    cargo: false,
    matricula: false,
  };

  let currentSchool = "";
  let whitelistState = { value: "", status: "idle" }; // idle|checking|ok|denied|error
  let whitelistRequestId = 0;

  function setFieldError(input, errorElement, isValid, showError, message) {
    const show = showError && !isValid;

    if (typeof message === "string") {
      errorElement.textContent = message;
    }

    input.setAttribute("aria-invalid", String(show));
    errorElement.hidden = !show;
  }

  function getWhitelistMessage() {
    if (whitelistState.status === "checking") {
      return "Verificando matrícula...";
    }
    if (whitelistState.status === "denied") {
      return "Matrícula não autorizada.";
    }
    if (whitelistState.status === "error") {
      return "Não foi possível verificar a matrícula. Tente novamente.";
    }
    return defaultMatriculaErrorText;
  }

  function isMatriculaAuthorized() {
    return isValidMatriculaFormat(matriculaInput.value)
      ? whitelistState.status === "ok" && whitelistState.value === matriculaInput.value
      : false;
  }

  function populateSchools(schools) {
    schoolSelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecione...";
    placeholder.disabled = true;
    placeholder.selected = true;
    schoolSelect.append(placeholder);

    const fragment = document.createDocumentFragment();

    schools.forEach((school) => {
      const option = document.createElement("option");
      option.value = school;
      option.textContent = school;
      fragment.append(option);
    });

    schoolSelect.append(fragment);
  }

  async function ensureWhitelistChecked() {
    const value = matriculaInput.value;

    if (!isValidMatriculaFormat(value)) {
      if (whitelistState.value !== value) {
        whitelistState = { value, status: "idle" };
      }
      return false;
    }

    if (
      whitelistState.value === value &&
      (whitelistState.status === "ok" || whitelistState.status === "denied")
    ) {
      return whitelistState.status === "ok";
    }

    if (typeof checkWhitelist !== "function") {
      // Fallback: if no remote check configured, rely on format validity.
      whitelistState = { value, status: "ok" };
      return true;
    }

    const requestId = ++whitelistRequestId;
    whitelistState = { value, status: "checking" };
    updateState();

    try {
      const ok = await checkWhitelist(Number(value));
      if (requestId !== whitelistRequestId || matriculaInput.value !== value) {
        return whitelistState.value === value && whitelistState.status === "ok";
      }
      whitelistState = { value, status: ok ? "ok" : "denied" };
    } catch {
      if (requestId !== whitelistRequestId || matriculaInput.value !== value) {
        return false;
      }
      whitelistState = { value, status: "error" };
    }

    updateState();
    onPersist?.();
    return whitelistState.status === "ok";
  }

  function updateState() {
    const nameValid = isValidName(nameInput.value);
    const cargoValid = isValidCargo(cargoSelect.value);
    const matriculaFormatValid = isValidMatriculaFormat(matriculaInput.value);
    const matriculaAuthorized = isMatriculaAuthorized();
    const matriculaValid = matriculaFormatValid && matriculaAuthorized;

    setFieldError(nameInput, nameError, nameValid, touchedFields.name);
    setFieldError(cargoSelect, cargoError, cargoValid, touchedFields.cargo);

    const showMatriculaError =
      touchedFields.matricula &&
      (!matriculaFormatValid ||
        whitelistState.status === "denied" ||
        whitelistState.status === "error");
    const matriculaMessage = !matriculaFormatValid
      ? "A matrícula deve conter 4 ou 5 dígitos."
      : getWhitelistMessage();

    if (touchedFields.matricula) {
      matriculaError.textContent = matriculaMessage;
    } else {
      matriculaError.textContent = defaultMatriculaErrorText;
    }
    matriculaInput.setAttribute("aria-invalid", String(showMatriculaError));
    matriculaError.hidden = !showMatriculaError;

    const formValid = nameValid && cargoValid && matriculaValid;

    schoolSelect.disabled = !formValid;
    schoolHint.hidden = formValid;
  }

  function addSchoolOption(school) {
    if (
      Array.from(schoolSelect.options).some(
        (option) => option.value === school
      )
    ) {
      return;
    }

    const option = document.createElement("option");
    option.value = school;
    option.textContent = school;
    schoolSelect.append(option);
  }

  function restore(formState, savedSchool) {
    const formData =
      formState && typeof formState === "object" ? formState : {};

    nameInput.value = sanitizeText(
      typeof formData.responsavel === "string" ? formData.responsavel : ""
    );

    const savedCargo =
      typeof formData.cargo === "string" ? formData.cargo : "";
    const cargoExists = Array.from(cargoSelect.options).some(
      (option) => option.value !== "" && option.value === savedCargo
    );
    cargoSelect.value = cargoExists ? savedCargo : "";

    matriculaInput.value = onlyDigits(String(formData.matricula ?? ""), 5);

    if (typeof savedSchool === "string" && savedSchool !== "") {
      addSchoolOption(savedSchool);
      currentSchool = savedSchool;
      schoolSelect.value = savedSchool;
    }

    // Reset whitelist state; will be revalidated when user interacts/saves.
    whitelistState = { value: "", status: "idle" };

    return typeof savedSchool === "string" ? savedSchool : "";
  }

  function markAllTouched() {
    touchedFields.name = true;
    touchedFields.cargo = true;
    touchedFields.matricula = true;
  }

  function isValidFormat() {
    return (
      isValidName(nameInput.value) &&
      isValidCargo(cargoSelect.value) &&
      isValidMatriculaFormat(matriculaInput.value)
    );
  }

  function isValid() {
    return isValidFormat() && isMatriculaAuthorized();
  }

  function getFormValues() {
    return {
      responsavel: nameInput.value,
      cargo: cargoSelect.value,
      matricula: matriculaInput.value,
    };
  }

  function getSchool() {
    return currentSchool;
  }

  function setCurrentSchool(school) {
    currentSchool = school;
    schoolSelect.value = school;
  }

  function revertSchool() {
    schoolSelect.value = currentSchool;
  }

  function sanitizeName() {
    nameInput.value = sanitizeText(nameInput.value);
  }

  function wireEvents() {
    nameInput.addEventListener("input", () => {
      updateState();
      onDataChange();
    });

    nameInput.addEventListener("blur", () => {
      nameInput.value = sanitizeText(nameInput.value);
      touchedFields.name = true;
      updateState();
      onPersist?.();
    });

    cargoSelect.addEventListener("change", () => {
      touchedFields.cargo = true;
      updateState();
      onDataChange();
    });

    matriculaInput.addEventListener("input", () => {
      matriculaInput.value = onlyDigits(matriculaInput.value, 5);
      whitelistState = { value: "", status: "idle" };
      updateState();
      onDataChange();
    });

    matriculaInput.addEventListener("blur", () => {
      touchedFields.matricula = true;
      updateState();
      void ensureWhitelistChecked();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
    });

    schoolSelect.addEventListener("change", () => {
      onSchoolChange(schoolSelect.value);
    });
  }

  return {
    populateSchools,
    updateState,
    restore,
    markAllTouched,
    isValidFormat,
    isValid,
    ensureWhitelistChecked,
    getFormValues,
    getSchool,
    setCurrentSchool,
    revertSchool,
    sanitizeName,
    wireEvents,
  };
}
