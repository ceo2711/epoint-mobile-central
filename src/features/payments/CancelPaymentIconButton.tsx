import { ActivityIndicator, Alert, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTranslation } from "@/contexts/LanguageContext";
import { colors } from "@/theme/tokens";

type CancelPaymentIconButtonProps = {
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function confirmCancelPaymentLink(
  t: (key: string, params?: Record<string, string | number>) => string,
  onConfirm: () => void,
) {
  Alert.alert(t("payments.cancel"), t("payments.cancelConfirm"), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("payments.cancel"), style: "destructive", onPress: onConfirm },
  ]);
}

export function CancelPaymentIconButton({
  loading = false,
  disabled = false,
  onPress,
}: CancelPaymentIconButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("payments.cancel")}
      disabled={disabled || loading}
      onPress={onPress}
      hitSlop={8}
      style={styles.btn}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.danger} />
      ) : (
        <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
