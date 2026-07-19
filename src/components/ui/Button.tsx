import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, radii } from "@/theme/tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps {
  title: string;
  loading?: boolean;
  variant?: Variant;
  fullWidth?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

const variantStyles: Record<
  Variant,
  { bg: string; text: string; border?: string }
> = {
  primary: { bg: colors.brand, text: colors.white },
  secondary: { bg: colors.creamSoft, text: colors.brown, border: colors.line },
  ghost: { bg: "transparent", text: colors.brand },
  danger: { bg: colors.danger, text: colors.white },
};

export function Button({
  title,
  loading,
  variant = "primary",
  fullWidth,
  disabled,
  style,
  onPress,
}: ButtonProps) {
  const v = variantStyles[variant];
  const isDisabled = Boolean(disabled || loading);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      activeOpacity={0.85}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.base,
        fullWidth ? styles.fullWidth : null,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? "transparent",
          borderWidth: v.border ? 1 : 0,
          opacity: isDisabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={[styles.label, { color: v.text }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: radii.control,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    width: "100%",
    alignSelf: "stretch",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
