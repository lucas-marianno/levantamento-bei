export function sanitizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function onlyDigits(value, maxLength) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export function formatRowNumbers(rowNumbers) {
  if (rowNumbers.length === 1) {
    return String(rowNumbers[0]);
  }

  if (rowNumbers.length === 2) {
    return `${rowNumbers[0]} e ${rowNumbers[1]}`;
  }

  return `${rowNumbers.slice(0, -1).join(", ")} e ${rowNumbers.at(-1)}`;
}
