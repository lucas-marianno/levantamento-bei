import { THEME_COLUMNS } from "../config.js";
import { valuesAreEmpty } from "./rows.js";
import { sanitizeText } from "./values.js";

export function buildSurveyPayloadV3({ form, school, cdd, themes }) {
  const matriculaDigits = String(form.matricula ?? "").trim();
  const matricula = /^\d+$/.test(matriculaDigits)
    ? Number(matriculaDigits)
    : form.matricula;

  return {
    responsavel: sanitizeText(form.responsavel),
    cargo: form.cargo,
    matricula,
    escola: school,
    cdd,
    temas: themes.map(({ id, label, semAcervo, rows }) => ({
      id,
      label,
      semAcervo: Boolean(semAcervo),
      livros: semAcervo
        ? []
        : rows
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
