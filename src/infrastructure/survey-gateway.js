export async function sendSurveyToBackend(payload, options = {}) {
  // TODO: replace this stub with the real backend call.
  // TODO: send `payload` as JSON to the Apps Script/Google Sites endpoint.
  // TODO: use options.signal to cancel in-flight requests.
  // TODO: map HTTP/network failures to thrown errors or { success: false, message }.
  void payload;
  void options;

  return { success: true };
}

export async function deleteBookRow(book) {
  // TODO: notify the backend that a saved row was deleted.
  // TODO: define whether deletion is permanent or a stale/deleted marker.
  // TODO: include the backend row id once rows are persisted server-side.
  void book;

  return { success: true };
}

export function createSurveyGateway() {
  return {
    sendSurveyToBackend,
    deleteBookRow,
  };
}
