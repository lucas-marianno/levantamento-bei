import { sanitizeText } from "./values.js";

export function isValidName(value) {
  return sanitizeText(value).length > 0;
}

export function isValidCargo(value) {
  return value !== "";
}

export function isValidMatricula(value) {
  return /^\d{5}$/.test(value);
}
