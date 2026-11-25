import { formatSubmittedAt } from "../domain/last-response.js";

export function createSentResponseDialog({ dialog, description, note, editButton }) {
  function show({ escola, submittedAt, unchanged = false }) {
    const when = formatSubmittedAt(submittedAt) || "data e hora indisponíveis";
    const school = String(escola ?? "").trim() || "EMEB selecionada";

    description.textContent = unchanged
      ? `Essa resposta para ${school} já foi enviada em ${when}.`
      : `Sua resposta para ${school} foi enviada com sucesso em ${when}.`;

    note.textContent = unchanged
      ? "Nenhuma alteração foi feita desde o último envio."
      : "";
    note.hidden = !unchanged;

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function close() {
    if (dialog.open) {
      dialog.close();
    }
  }

  function wireEvents() {
    editButton.addEventListener("click", close);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
    });

    // Chromium force-closes a dialog after several canceled `cancel` events,
    // so suppress Escape before the user agent starts a close request.
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape" || !dialog.open) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
      },
      true
    );
  }

  return { show, close, wireEvents, isOpen: () => dialog.open };
}
