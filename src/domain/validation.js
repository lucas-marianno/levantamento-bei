import {
  isValidCargo,
  isValidMatricula,
  isValidName,
} from "./identification.js";

export function getIdentificationValidity({ name, cargo, matricula }) {
  return {
    name: isValidName(name),
    cargo: isValidCargo(cargo),
    matricula: isValidMatricula(matricula),
  };
}

export function isIdentificationValid(validity) {
  return validity.name && validity.cargo && validity.matricula;
}

export function getInvalidCddRanges(items) {
  return items
    .filter(
      (item) =>
        !(item.semAcervo || (Number.isInteger(item.quantidade) && item.quantidade > 0))
    )
    .map((item) => item.range);
}
