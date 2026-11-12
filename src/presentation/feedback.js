export function createFeedback(element) {
  function show(message, type, reason) {
    element.textContent = message;
    element.className = `feedback ${type}`;
    element.dataset.reason = reason;
    element.hidden = false;
  }

  function hide() {
    element.hidden = true;
    element.textContent = "";
    element.className = "feedback";
    delete element.dataset.reason;
  }

  function hideOnDataChange() {
    if (element.dataset.reason !== "incomplete") {
      hide();
    }
  }

  function hideIfIncomplete() {
    if (element.dataset.reason === "incomplete") {
      hide();
    }
  }

  return { show, hide, hideOnDataChange, hideIfIncomplete };
}
