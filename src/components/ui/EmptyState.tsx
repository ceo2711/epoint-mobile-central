import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/tokens";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export function EmptyState({
  title,
  description,
  icon = "folder-open-outline",
}: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={40} color={colors.brownMuted} />
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.brown,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: colors.soft,
    textAlign: "center",
    lineHeight: 20,
  },
});
