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
      style={styles.hit}
    >
      <View style={styles.row}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
        {showChevron && onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.brownMuted} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hit: {
    backgroundColor: colors.white,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.soft,
  },
});
