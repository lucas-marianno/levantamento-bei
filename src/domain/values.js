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

export function formatSavedAt(timestamp) {
  const date = new Date(Number(timestamp));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) => String(number).padStart(2, "0");

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
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
