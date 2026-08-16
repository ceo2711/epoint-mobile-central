import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useInScreenBack } from "@/components/shell/BackGestureContext";
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
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 12 }}
      style={styles.hit}
    >
      <Ionicons name="arrow-back" size={18} color={colors.brand} />
      <Text style={styles.backLabel} numberOfLines={1}>
        {label}
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
  useInScreenBack(showBack ? onBack : undefined);

  return (
    <View style={styles.header}>
      {showBack ? <ScopeBackButton label={backLabel!} onPress={onBack!} /> : null}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    minHeight: 32,
  },
  backLabel: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.brand,
  },
  header: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.brown,
  },
});
