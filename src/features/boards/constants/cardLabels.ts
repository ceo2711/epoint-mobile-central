import type { BoardCardLabel } from "@/types/api";
import { colors } from "@/theme/tokens";

export const BOARD_CARD_LABELS = [
  "URGENTE",
  "RECHAZADA",
  "DENEGADA",
  "APROBADA",
  "PENDIENTE",
] as const satisfies readonly BoardCardLabel[];

export const DEFAULT_BOARD_CARD_LABEL: BoardCardLabel = "PENDIENTE";

export const BOARD_CARD_LABEL_TEXT: Record<BoardCardLabel, string> = {
  URGENTE: "Urgente",
  RECHAZADA: "Rechazada",
  DENEGADA: "Denegada",
  APROBADA: "Aprobada",
  PENDIENTE: "Pendiente",
};

export function isBoardCardLabel(value: string | null | undefined): value is BoardCardLabel {
  return !!value && (BOARD_CARD_LABELS as readonly string[]).includes(value);
}

export function resolveCardLabel(label: string | null | undefined): BoardCardLabel {
  return isBoardCardLabel(label) ? label : DEFAULT_BOARD_CARD_LABEL;
}

/** Colores de superficie de la tarjeta según etiqueta (estilo Kanban web). */
export function cardLabelSurface(label: string | null | undefined): {
  bg: string;
  border: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
} {
  switch (resolveCardLabel(label)) {
    case "URGENTE":
      return {
        bg: "#fff5f5",
        border: "#f87171",
        accent: "#dc2626",
        badgeBg: "#dc2626",
        badgeText: colors.white,
      };
    case "RECHAZADA":
      return {
        bg: "#fffbeb",
        border: "#fbbf24",
        accent: "#d97706",
        badgeBg: "#f59e0b",
        badgeText: colors.white,
      };
    case "DENEGADA":
      return {
        bg: "#fff1f2",
        border: "#fb7185",
        accent: "#e11d48",
        badgeBg: "#e11d48",
        badgeText: colors.white,
      };
    case "APROBADA":
      return {
        bg: colors.brandLight,
        border: "#5a8f63",
        accent: colors.brand,
        badgeBg: colors.brand,
        badgeText: colors.white,
      };
    case "PENDIENTE":
    default:
      return {
        bg: "#f8fafc",
        border: "#64748b",
        accent: "#64748b",
        badgeBg: "#64748b",
        badgeText: colors.white,
      };
  }
}
