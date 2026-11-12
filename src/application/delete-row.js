export async function notifySavedRowDeletion({ gateway, payload }) {
  void gateway.deleteBookRow(payload).catch((error) => {
    console.error("Falha ao notificar a exclusão da linha.", error);
  });
}
