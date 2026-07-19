import { notifyUnauthorized } from "@/lib/auth-unauthorized";
import { refreshAccessToken } from "@/lib/auth-session";
import { ApiError, NETWORK_ERROR_MESSAGE } from "@/lib/api-error";
import { getApiBaseUrl } from "@/lib/api-config";

const API_URL = getApiBaseUrl();

export { ApiError, isUnauthorizedError } from "@/lib/api-error";

type RequestOptions = RequestInit & {
  token?: string | null;
  skipAuthRefresh?: boolean;
  silentHttpErrors?: boolean;
};

let activeMerchantIdProvider: () => number | null = () => null;

export function setActiveMerchantIdProvider(provider: () => number | null) {
  activeMerchantIdProvider = provider;
}

function merchantHeaders(): Record<string, string> {
  const merchantId = activeMerchantIdProvider();
  return merchantId ? { "X-Merchant-Id": String(merchantId) } : {};
}

function throwNetworkError(): never {
  throw new ApiError(0, NETWORK_ERROR_MESSAGE);
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const { token, skipAuthRefresh, silentHttpErrors: _silent, headers, ...rest } = options;
  const method = rest.method ?? "GET";

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...merchantHeaders(),
        ...headers,
      },
    });
  } catch {
    throwNetworkError();
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
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...merchantHeaders(),
      },
    });
  } catch {
    throwNetworkError();
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
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...merchantHeaders(),
      },
      body: formData,
    });
  } catch {
    throwNetworkError();
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

export { API_URL };
export { getUserFacingErrorMessage, NETWORK_ERROR_MESSAGE } from "@/lib/api-error";
