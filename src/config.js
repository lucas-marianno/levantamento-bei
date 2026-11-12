export const V3_STORAGE_KEY = "registro-livros:v3:draft";
export const V3_DRAFT_VERSION = 3;
export const SAVE_LABEL = "Salvar";
export const SAVE_IN_PROGRESS_LABEL = "Salvando...";
export const OPTIONS_URL = "data/options.json";

export const FALLBACK_OPTIONS = {
  schools: ["EMEB Exemplo 1", "EMEB Exemplo 2"],
  v3: {
    initialThemeRows: 5,
    cddCategories: [
      { range: "000-099", color: "BRANCA", label: "Generalidades" },
      {
        range: "100-199",
        color: "AMARELA",
        label: "Filosofia e Religião",
      },
      { range: "200-299", color: "AZUL", label: "Religião" },
      { range: "300-399", color: "VERDE", label: "Ciências Sociais" },
    ],
    themes: [
      { id: "indigena", label: "Temática Indígena" },
      { id: "africana", label: "Temática Africana" },
    ],
  },
};

export const THEME_COLUMNS = [
  {
    key: "titulo",
    label: "Título do Livro",
    type: "text",
    required: true,
    sanitize: true,
  },
  {
    key: "autor",
    label: "Autor",
    type: "text",
    required: true,
    sanitize: true,
  },
  {
    key: "editora",
    label: "Editora",
    type: "text",
    required: true,
    sanitize: true,
  },
  {
    key: "quantidade",
    label: "Quantidade de Exemplares",
    type: "number",
    required: true,
  },
];

export const COLOR_OPTIONS = [
  { value: "BRANCA", hex: "#ffffff", text: "#0f172a" },
  { value: "AMARELA", hex: "#facc15", text: "#422006" },
  { value: "AZUL", hex: "#3b82f6", text: "#ffffff" },
  { value: "LARANJA", hex: "#f97316", text: "#ffffff" },
  { value: "PRETA", hex: "#111827", text: "#ffffff" },
  { value: "VERDE", hex: "#22c55e", text: "#052e16" },
  { value: "VERMELHA", hex: "#ef4444", text: "#ffffff" },
];
