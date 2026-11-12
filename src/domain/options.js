export function normalizeCddCategories(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.range === "string" &&
        item.range.trim() !== "" &&
        typeof item.label === "string" &&
        item.label.trim() !== ""
    )
    .map((item) => ({
      range: item.range.trim(),
      color: typeof item.color === "string" ? item.color.trim() : "",
      label: item.label.trim(),
    }));
}

export function normalizeThemes(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  const seen = new Set();

  return list
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.label === "string" &&
        item.label.trim() !== ""
    )
    .map((item, index) => {
      const baseId =
        typeof item.id === "string" && item.id.trim() !== ""
          ? item.id.trim()
          : `tema-${index + 1}`;
      let id = baseId;
      let suffix = 2;

      while (seen.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }

      seen.add(id);

      return { id, label: item.label.trim() };
    });
}

export function normalizeOptions(data, fallbackOptions) {
  const cddCategories = normalizeCddCategories(data?.v3?.cddCategories);
  const themes = normalizeThemes(data?.v3?.themes);
  const initialThemeRows =
    Number.isInteger(data?.v3?.initialThemeRows) &&
    data.v3.initialThemeRows > 0
      ? data.v3.initialThemeRows
      : fallbackOptions.v3.initialThemeRows;

  return {
    ...fallbackOptions,
    schools:
      Array.isArray(data.schools) && data.schools.length > 0
        ? data.schools
        : fallbackOptions.schools,
    v3: {
      initialThemeRows,
      cddCategories:
        cddCategories.length > 0
          ? cddCategories
          : fallbackOptions.v3.cddCategories,
      themes: themes.length > 0 ? themes : fallbackOptions.v3.themes,
    },
  };
}
