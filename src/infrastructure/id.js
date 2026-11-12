export function generateRowId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
