import { THEME_COLUMNS } from "../config.js";
import {
  isValidCargo,
  isValidMatricula,
  isValidName,
} from "./identification.js";
import { getRowState } from "./rows.js";

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

export function getThemesWithoutValidRows(themes) {
  return themes
    .filter((theme) => {
      if (theme.semAcervo) {
        return false;
      }

      return !theme.rows.some(
        (row) => getRowState(THEME_COLUMNS, row) === "complete"
      );
    })
    .map(({ id, label }) => ({ id, label }));
}
