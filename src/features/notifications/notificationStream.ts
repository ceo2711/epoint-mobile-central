import { fetch as expoFetch } from "expo/fetch";

import { refreshAccessToken } from "@/lib/auth-session";
import { getToken } from "@/lib/auth-storage";
import { getApiBaseUrl } from "@/lib/api-config";
import type { Notification } from "@/types/api";

type StreamMessage =
  | { type: "connected" }
  | { type: "notification"; notification: Notification };

export type NotificationStreamHandlers = {
  onNotification: (notification: Notification) => void;
  onConnected?: () => void;
  onError?: (error: unknown) => void;
};

function parseSseEvent(rawEvent: string): StreamMessage | null {
  const dataLines = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());
  if (dataLines.length === 0) return null;

  try {
    return JSON.parse(dataLines.join("\n")) as StreamMessage;
  } catch {
    return null;
  }
}

async function resolveToken(fallback?: string | null): Promise<string | null> {
  return (await getToken()) ?? fallback ?? null;
}

async function readNotificationStream(
  response: Response,
  handlers: NotificationStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const body = response.body;
  if (!body || typeof body.getReader !== "function") {
    throw new Error("Notification stream unsupported");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal.aborted) break;
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const rawEvent of events) {
      const message = parseSseEvent(rawEvent);
      if (!message) continue;
      if (message.type === "connected") {
        handlers.onConnected?.();
        continue;
      }
      if (message.type === "notification") {
        handlers.onNotification(message.notification);
      }
    }
  }

  if (!signal.aborted) {
    throw new Error("Notification stream closed");
  }
}

/**
 * SSE contra GET /notifications/stream.
 * Usa expo/fetch porque el fetch de RN no siempre expone body streaming.
 */
export function connectNotificationStream(
  getAccessToken: () => Promise<string | null> | string | null,
  handlers: NotificationStreamHandlers,
  signal: AbortSignal,
): void {
  void (async () => {
    try {
      let token = await getAccessToken();
      if (!token) return;

      const openStream = (accessToken: string) =>
        expoFetch(`${getApiBaseUrl()}/notifications/stream`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "text/event-stream",
          },
          signal,
        });

      let response = await openStream(token);

      if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          response = await openStream(refreshed);
        }
      }

      if (!response.ok || !response.body) {
        throw new Error("Notification stream failed");
      }

      await readNotificationStream(response, handlers, signal);
    } catch (error) {
      if (signal.aborted) return;
      handlers.onError?.(error);
    }
  })();
}

export async function getStreamAccessToken(fallback?: string | null): Promise<string | null> {
  return resolveToken(fallback);
}
