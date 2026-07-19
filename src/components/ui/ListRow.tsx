import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii } from "@/theme/tokens";

interface ListRowProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  showChevron?: boolean;
}

export function ListRow({
  title,
  subtitle,
  onPress,
  right,
  showChevron = true,
}: ListRowProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.75}
      disabled={!onPress}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
      {showChevron && onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.brownMuted} />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 13,
    color: colors.soft,
  },
});
