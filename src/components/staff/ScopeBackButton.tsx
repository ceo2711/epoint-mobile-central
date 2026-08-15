import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing } from "@/theme/tokens";

type ScopeBackButtonProps = {
  label: string;
  onPress: () => void;
};

export function ScopeBackButton({ label, onPress }: ScopeBackButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.hit}
    >
      <Text style={styles.backLabel} numberOfLines={1}>
        <Ionicons name="arrow-back" size={16} color={colors.brand} />
        {`  ${label}`}
      </Text>
    </TouchableOpacity>
  );
}

type ScopePageHeaderProps = {
  title: string;
  backLabel?: string;
  onBack?: () => void;
};

export function ScopePageHeader({ title, backLabel, onBack }: ScopePageHeaderProps) {
  const showBack = Boolean(backLabel && onBack);

  return (
    <View style={styles.header}>
      {showBack ? <ScopeBackButton label={backLabel!} onPress={onBack!} /> : null}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    flexShrink: 1,
    minWidth: 0,
  },
  backLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.brand,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
    marginBottom: spacing.sm,
  },
  title: {
    flexShrink: 0,
    marginLeft: spacing.sm,
    fontSize: 22,
    fontWeight: "700",
    color: colors.brown,
  },
});
