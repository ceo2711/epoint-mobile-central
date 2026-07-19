import { StyleSheet, Text, View } from "react-native";

import { colors, radii } from "@/theme/tokens";

interface MetricCardProps {
  value: string | number;
  label: string;
}

export function MetricCard({ value, label }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.creamSoft,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.brand,
  },
  label: {
    fontSize: 13,
    color: colors.soft,
  },
});
