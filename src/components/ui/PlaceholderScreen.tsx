import { StyleSheet, Text, View } from "react-native";

import { colors, radii } from "@/theme/tokens";

interface PlaceholderScreenProps {
  title: string;
  description?: string;
}

export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Próximamente</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>
        {description ??
          "Esta sección estará disponible en una próxima fase de la app móvil."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
    padding: 24,
    justifyContent: "center",
    gap: 12,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  badgeText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.brown,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.soft,
  },
});
