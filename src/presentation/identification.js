import {
  isValidCargo,
  isValidMatricula,
  isValidName,
} from "../domain/identification.js";
import { onlyDigits, sanitizeText } from "../domain/values.js";
import { getElement } from "./dom.js";

export function createIdentification({ onDataChange, onPersist, onSchoolChange }) {
  const form = getElement("identification-form");
  const nameInput = getElement("responsavel");
  const cargoSelect = getElement("cargo");
  const matriculaInput = getElement("matricula");
  const nameError = getElement("responsavel-error");
  const cargoError = getElement("cargo-error");
  const matriculaError = getElement("matricula-error");
  const schoolHint = getElement("escola-hint");
  const schoolSelect = getElement("escola");

  const touchedFields = {
    name: false,
    cargo: false,
    matricula: false,
  };

  let currentSchool = "";

  function setFieldError(input, errorElement, isValid, showError) {
    const show = showError && !isValid;

    input.setAttribute("aria-invalid", String(show));
    errorElement.hidden = !show;
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

  function updateState() {
    const nameValid = isValidName(nameInput.value);
    const cargoValid = isValidCargo(cargoSelect.value);
    const matriculaValid = isValidMatricula(matriculaInput.value);

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

    return typeof savedSchool === "string" ? savedSchool : "";
  }

  function markAllTouched() {
    touchedFields.name = true;
    touchedFields.cargo = true;
    touchedFields.matricula = true;
  }

  function isValid() {
    return (
      isValidName(nameInput.value) &&
      isValidCargo(cargoSelect.value) &&
      isValidMatricula(matriculaInput.value)
    );
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
      onPersist();
    });

    cargoSelect.addEventListener("change", () => {
      touchedFields.cargo = true;
      updateState();
      onDataChange();
    });

    matriculaInput.addEventListener("input", () => {
      matriculaInput.value = onlyDigits(matriculaInput.value, 5);
      updateState();
      onDataChange();
    });

    matriculaInput.addEventListener("blur", () => {
      touchedFields.matricula = true;
      updateState();
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
    isValid,
    getFormValues,
    getSchool,
    setCurrentSchool,
    revertSchool,
    sanitizeName,
    wireEvents,
  };
}
