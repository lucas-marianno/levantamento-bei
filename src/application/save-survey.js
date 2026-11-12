export async function submitSurvey({ gateway, payload }) {
  const result = await gateway.sendSurveyToBackend(payload);

  if (result?.success === false) {
    throw new Error(
      result.message || "Não foi possível salvar o levantamento."
    );
  }

  return result;
}
