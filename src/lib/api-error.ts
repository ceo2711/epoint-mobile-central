export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Mensaje de red orientado a usuario (sin detalles técnicos de infra). */
export const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar. Intentá de nuevo en unos momentos.";

export function getUserFacingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    // status 0 = fallo de red / fetch; no exponer URL ni detalles de infra
    if (error.status === 0) return fallback || NETWORK_ERROR_MESSAGE;
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("network") ||
      msg.includes("failed to fetch") ||
      msg.includes("network request failed") ||
      msg.includes("url de la api") ||
      msg.includes("backend")
    ) {
      return fallback || NETWORK_ERROR_MESSAGE;
    }
    return error.message;
  }
  return fallback;
}
