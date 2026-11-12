import { formatSavedAt } from "../domain/values.js";

export function renderSaveStatus(
  element,
  { savedAt, savedSnapshot, currentSnapshot, saveError, empty = false }
) {
  if (!element) {
    return;
  }

  if (empty) {
    element.textContent = "";
    element.className = "save-status";
    return;
  }

  const savedAtNumber = Number(savedAt) || 0;
  const savedAtText = savedAtNumber ? formatSavedAt(savedAtNumber) : "";

  if (saveError) {
    element.textContent = savedAtNumber
      ? `Erro ao salvar, último salvamento em ${savedAtText}`
      : "Erro ao salvar";
    element.className = "save-status error";
    return;
  }

  if (!savedAtNumber) {
    element.textContent = "Entrada não salva";
    element.className = "save-status pending";
    return;
  }

  if (currentSnapshot !== savedSnapshot) {
    element.textContent = `Alterações pendentes. Último salvamento em ${savedAtText}`;
    element.className = "save-status pending";
    return;
  }

  element.textContent = `Salvo em ${savedAtText}`;
  element.className = "save-status saved";
}
