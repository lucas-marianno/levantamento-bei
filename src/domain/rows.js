export function isColumnRequired(column, values) {
  return typeof column.required === "function"
    ? column.required(values)
    : Boolean(column.required);
}

export function isColumnValueValid(column, values) {
  if (column.type === "checkbox") {
    return true;
  }

  const value = String(values[column.key] ?? "").trim();

  if (value === "") {
    return !isColumnRequired(column, values);
  }

  if (column.key === "quantidade") {
    const quantity = Number(value);
    return Number.isInteger(quantity) && quantity >= 1;
  }

  return true;
}

export function valuesAreEmpty(columns, values) {
  return !columns.some((column) => {
    const value = values[column.key];

    return column.type === "checkbox"
      ? Boolean(value)
      : String(value ?? "").trim() !== "";
  });
}

export function getInvalidColumnKeys(columns, values) {
  return columns
    .filter((column) => !isColumnValueValid(column, values))
    .map((column) => column.key);
}

export function getRowState(columns, values) {
  if (valuesAreEmpty(columns, values)) {
    return "empty";
  }

  return getInvalidColumnKeys(columns, values).length === 0
    ? "complete"
    : "partial";
}
