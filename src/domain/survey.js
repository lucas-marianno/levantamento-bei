import { THEME_COLUMNS } from "../config.js";
import { valuesAreEmpty } from "./rows.js";
import { sanitizeText } from "./values.js";

export function buildSurveyPayloadV3({ form, school, cdd, themes }) {
  return {
    responsavel: sanitizeText(form.responsavel),
    cargo: form.cargo,
    matricula: form.matricula,
    escola: school,
    cdd,
    temas: themes.map(({ id, label, rows }) => ({
      id,
      label,
      livros: rows
        .filter((values) => !valuesAreEmpty(THEME_COLUMNS, values))
        .map((values) => ({
          titulo: values.titulo,
          autor: values.autor,
          editora: values.editora,
          quantidade: Number(values.quantidade),
        })),
    })),
  };
}
