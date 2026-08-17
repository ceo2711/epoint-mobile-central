import type { Notification } from "@/types/api";

const BOARD_EVENT_TYPES = new Set([
  "TASK_COMMENTED",
  "TASK_COMPLETED",
  "BOARD_ATTACHMENT_REJECTED",
]);

export function payloadPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return parsed > 0 ? parsed : null;
  }
  return null;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseWorkspaceTab(
  value: string | string[] | undefined,
): "resumen" | "documentos" | "tablero" | null {
  const tab = firstParam(value);
  if (tab === "resumen" || tab === "documentos" || tab === "tablero") return tab;
  if (tab === "board") return "tablero";
  if (tab === "overview") return "resumen";
  if (tab === "documents") return "documentos";
  return null;
}

function readField(
  input: Notification | Record<string, unknown>,
  key: string,
): unknown {
  const nested = (input as Notification).payload?.[key];
  if (nested !== undefined && nested !== null) return nested;
  return (input as Record<string, unknown>)[key];
}

function eventTypeOf(input: Notification | Record<string, unknown>): string {
  return String(readField(input, "event_type") ?? (input as Notification).event_type ?? "");
}

/** Ruta Expo Router según el tipo de notificación y el rol. */
export function getNotificationAppPath(
  input: Notification | Record<string, unknown> | null | undefined,
  roleCode: string | undefined,
): string | null {
  if (!input) return null;
  const eventType = eventTypeOf(input);
  const isClient = roleCode === "CLIENT";
  const clientId = payloadPositiveInt(readField(input, "client_id"));
  const cardId = payloadPositiveInt(readField(input, "card_id"));
  const prospectId = payloadPositiveInt(readField(input, "prospect_id"));

  if (BOARD_EVENT_TYPES.has(eventType)) {
    if (isClient) {
      return cardId
        ? `/(portal)/(tabs)/tablero?card=${cardId}`
        : "/(portal)/(tabs)/tablero";
    }
    if (!clientId) return null;
    const qs = new URLSearchParams({ tab: "tablero" });
    if (cardId) qs.set("card", String(cardId));
    return `/(staff)/(tabs)/clientes/${clientId}?${qs.toString()}`;
  }

  if (eventType === "CALENDLY_EVENT_SCHEDULED" && !isClient) {
    return "/(staff)/(tabs)/calendario";
  }

  if (eventType === "DOCUSIGN_ENVELOPE_COMPLETED" && !isClient) {
    if (clientId) return `/(staff)/(tabs)/clientes/${clientId}`;
    return "/(staff)/(tabs)/contratos";
  }

  if (eventType === "PAYMENT_LINK_COMPLETED" && !isClient) {
    if (clientId) return `/(staff)/(tabs)/clientes/${clientId}`;
    if (prospectId) return `/(staff)/(tabs)/prospectos/${prospectId}`;
    return "/(staff)/(tabs)/pagos";
  }

  if (eventType === "PROSPECT_CONVERTED" && !isClient) {
    if (clientId) return `/(staff)/(tabs)/clientes/${clientId}`;
    if (prospectId) return `/(staff)/(tabs)/prospectos/${prospectId}`;
    return "/(staff)/(tabs)/prospectos";
  }

  if (clientId) {
    if (isClient) {
      if (eventType === "DOCUMENT_REJECTED" || eventType === "DOCUMENT_EXPIRING_SOON") {
        return "/(portal)/(tabs)/documentos";
      }
      return "/(portal)/(tabs)/datos";
    }
    return `/(staff)/(tabs)/clientes/${clientId}`;
  }

  if (isClient) {
    if (eventType === "DOCUMENT_REJECTED" || eventType === "DOCUMENT_EXPIRING_SOON") {
      return "/(portal)/(tabs)/documentos";
    }
    return null;
  }

  return null;
}

export function isNotificationNavigable(
  notification: Notification,
  roleCode: string | undefined,
): boolean {
  return getNotificationAppPath(notification, roleCode) !== null;
}
