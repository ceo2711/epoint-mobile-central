import { notifyUnauthorized } from "@/lib/auth-unauthorized";
import { refreshAccessToken } from "@/lib/auth-session";
import { ApiError, NETWORK_ERROR_MESSAGE } from "@/lib/api-error";
import { getApiBaseUrl } from "@/lib/api-config";
import { Platform } from "react-native";

/** Resolver en cada request: Constants/hostUri puede no estar listo al import. */
function apiUrl(): string {
  return getApiBaseUrl();
}

/** Evita spinners eternos si la IP LAN cambió o el backend no responde. */
const DEFAULT_TIMEOUT_MS = 15_000;

export { ApiError, isUnauthorizedError } from "@/lib/api-error";

type RequestOptions = RequestInit & {
  token?: string | null;
  skipAuthRefresh?: boolean;
  silentHttpErrors?: boolean;
  timeoutMs?: number;
};

let activeMerchantIdProvider: () => number | null = () => null;

export function setActiveMerchantIdProvider(provider: () => number | null) {
  activeMerchantIdProvider = provider;
}

function merchantHeaders(): Record<string, string> {
  const merchantId = activeMerchantIdProvider();
  return merchantId ? { "X-Merchant-Id": String(merchantId) } : {};
}

function throwNetworkError(cause?: unknown, url?: string): never {
  if (__DEV__) {
    const detail =
      cause instanceof Error
        ? cause.message
        : cause != null
          ? String(cause)
          : "unknown";
    console.warn(`[api] network fail → ${url ?? apiUrl()} | ${detail}`);
  }
  throw new ApiError(0, NETWORK_ERROR_MESSAGE);
}

function mergeAbortSignals(
  timeoutMs: number,
  external?: AbortSignal | null,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onExternalAbort);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}

/**
 * fetch con timeout. En Android, AbortSignal + fetch a veces falla raro;
 * usamos Promise.race sin signal nativo.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  if (Platform.OS === "android") {
    const { signal: external, ...rest } = init;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fetch(url, rest),
        new Promise<Response>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`timeout after ${timeoutMs}ms`));
          }, timeoutMs);
          if (external) {
            if (external.aborted) {
              reject(new Error("aborted"));
            } else {
              external.addEventListener(
                "abort",
                () => reject(new Error("aborted")),
                { once: true },
              );
            }
          }
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const { signal: externalSignal, ...rest } = init;
  const { signal, cleanup } = mergeAbortSignals(timeoutMs, externalSignal);
  try {
    return await fetch(url, { ...rest, signal });
  } finally {
    cleanup();
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const {
    token,
    skipAuthRefresh,
    silentHttpErrors: _silent,
    headers,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    ...rest
  } = options;
  const method = rest.method ?? "GET";
  const url = `${apiUrl()}${path}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        ...rest,
        signal: externalSignal ?? undefined,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...merchantHeaders(),
          ...headers,
        },
      },
      timeoutMs,
    );
  } catch (cause) {
    throwNetworkError(cause, url);
  }

  if (!response.ok) {
    let message = "Error en la solicitud";
    try {
      const data = await response.json();
      const detail = data.detail ?? data.message;
      if (Array.isArray(detail)) {
        message = detail.map((e: { msg?: string }) => e.msg ?? String(e)).join(", ");
      } else if (detail) {
        message = String(detail);
      }
    } catch {
      message = response.statusText || message;
    }
    if (response.status === 401 && token && !isRetry && !skipAuthRefresh) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return request<T>(path, { ...options, token: newToken }, true);
      }
    }
    if (response.status === 401 && token) {
      notifyUnauthorized();
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface BlobResponse {
  data: ArrayBuffer;
  mimeType: string;
}

async function requestBlob(
  path: string,
  token?: string | null,
  isRetry = false,
): Promise<BlobResponse> {
  const url = `${apiUrl()}${path}`;
  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...merchantHeaders(),
        },
      },
      DEFAULT_TIMEOUT_MS,
    );
  } catch (cause) {
    throwNetworkError(cause, url);
  }

  if (!response.ok) {
    let message = "Error en la solicitud";
    try {
      const data = await response.json();
      const detail = data.detail ?? data.message;
      if (Array.isArray(detail)) {
        message = detail.map((e: { msg?: string }) => e.msg ?? String(e)).join(", ");
      } else if (detail) {
        message = String(detail);
      }
    } catch {
      message = response.statusText || message;
    }
    if (response.status === 401 && token && !isRetry) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return requestBlob(path, newToken, true);
      }
    }
    if (response.status === 401 && token) {
      notifyUnauthorized();
    }
    throw new ApiError(response.status, message);
  }

  const mimeType =
    response.headers.get("Content-Type")?.split(";")[0]?.trim() || "application/octet-stream";
  const data = await response.arrayBuffer();
  return { data, mimeType };
}

async function uploadRequest<T>(
  path: string,
  formData: FormData,
  token?: string | null,
  isRetry = false,
): Promise<T> {
  const url = `${apiUrl()}${path}`;
  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...merchantHeaders(),
        },
        body: formData,
      },
      60_000,
    );
  } catch (cause) {
    throwNetworkError(cause, url);
  }

  if (!response.ok) {
    let message = "Error en la solicitud";
    try {
      const data = await response.json();
      const detail = data.detail ?? data.message;
      if (Array.isArray(detail)) {
        message = detail.map((e: { msg?: string }) => e.msg ?? String(e)).join(", ");
      } else if (detail) {
        message = String(detail);
      }
    } catch {
      message = response.statusText || message;
    }
    if (response.status === 401 && token && !isRetry) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        return uploadRequest<T>(path, formData, newToken, true);
      }
    }
    if (response.status === 401 && token) {
      notifyUnauthorized();
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, token?: string | null) =>
    request<T>(path, { method: "GET", token }),

  getBlob: (path: string, token?: string | null) => requestBlob(path, token),

  post: <T>(
    path: string,
    body: unknown,
    token?: string | null,
    options?: Pick<RequestOptions, "silentHttpErrors" | "skipAuthRefresh">,
  ) => request<T>(path, { method: "POST", body: JSON.stringify(body), token, ...options }),

  upload: <T>(path: string, formData: FormData, token?: string | null) =>
    uploadRequest<T>(path, formData, token),

  patch: <T>(path: string, body: unknown, token?: string | null) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body), token }),

  put: <T>(path: string, body: unknown, token?: string | null) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body), token }),

  delete: <T>(path: string, token?: string | null) =>
    request<T>(path, { method: "DELETE", token }),
};

export { getApiBaseUrl } from "@/lib/api-config";
export { getUserFacingErrorMessage, NETWORK_ERROR_MESSAGE } from "@/lib/api-error";
