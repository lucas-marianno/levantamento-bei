export async function submitResponse({ gateway, payload }) {
  const result = await gateway.submitResponse(payload);

  if (result?.success === false) {
    throw new Error(
      result.message || "Não foi possível enviar a resposta."
    );
  }

  return result;
}
