export function wireSchoolChangeDialog({
  dialog,
  cancelButton,
  confirmButton,
  onCancel,
  onConfirm,
  onClose,
}) {
  cancelButton.addEventListener("click", onCancel);
  confirmButton.addEventListener("click", onConfirm);
  dialog.addEventListener("close", onClose);
}
