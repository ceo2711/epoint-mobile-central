import { StyleSheet, Text, View } from "react-native";

import { CLIENT_STATUS_LABELS } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDIENTE_DE_REVISION: { bg: "#fef3c7", text: "#92400e" },
  RECHAZADO: { bg: "#fee2e2", text: "#991b1b" },
  APROBADO_PARA_ONBOARDING: { bg: colors.brandLight, text: colors.brand },
  EN_CARGA_DATOS: { bg: "#dbeafe", text: "#1e40af" },
  DOCUMENTOS_EN_REVISION: { bg: "#dbeafe", text: "#1e40af" },
  LISTO_PARA_TRABAJAR: { bg: colors.brandLight, text: colors.brand },
  ONBOARDING_EN_PROGRESO: { bg: "#dbeafe", text: "#1e40af" },
  ONBOARDING_COMPLETADO: { bg: colors.brandLight, text: colors.brand },
  INACTIVO: { bg: colors.creamWarm, text: colors.soft },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const palette = STATUS_COLORS[status] ?? { bg: colors.creamWarm, text: colors.soft };
  const label = CLIENT_STATUS_LABELS[status] ?? status;

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
  },
});
