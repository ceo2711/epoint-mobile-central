import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { colors, radii } from "@/theme/tokens";

export function MerchantSwitcher() {
  const { user, token, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const merchants = user?.merchants ?? [];
  if (merchants.length <= 1) return null;

  const active = user?.active_merchant;

  async function setActiveMerchant(merchantId: number) {
    if (!token || merchantId === user?.active_merchant_id) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await api.put("/auth/me/active-merchant", { merchant_id: merchantId }, token);
      await refreshUser();
      setOpen(false);
    } catch (err) {
      Alert.alert(
        t("common.error"),
        getUserFacingErrorMessage(err, t("account.merchantSwitchError")),
      );
    } finally {
      setSwitching(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("account.activeMerchant")}
        onPress={() => setOpen(true)}
        style={styles.trigger}
        disabled={switching}
      >
        <Ionicons name="storefront-outline" size={16} color={colors.cream} />
        <Text style={styles.triggerText} numberOfLines={1}>
          {active?.name ?? t("account.activeMerchant")}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.cream} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t("account.activeMerchant")}</Text>
            {switching ? (
              <ActivityIndicator color={colors.brand} style={{ marginVertical: 16 }} />
            ) : (
              <ScrollView style={styles.list}>
                {merchants.map((m) => {
                  const isActive = user?.active_merchant_id === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.option, isActive && styles.optionActive]}
                      onPress={() => void setActiveMerchant(m.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionName, isActive && styles.optionNameActive]}>
                          {m.name}
                        </Text>
                        <Text style={styles.optionCode}>{m.code}</Text>
                      </View>
                      {isActive ? (
                        <Ionicons name="checkmark-circle" size={22} color={colors.brand} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    maxWidth: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  triggerText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    color: colors.cream,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,16,8,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: 16,
    maxHeight: "70%",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.brown,
    marginBottom: 12,
  },
  list: {
    maxHeight: 360,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  optionActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  optionName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  optionNameActive: {
    color: colors.brand,
  },
  optionCode: {
    fontSize: 12,
    color: colors.soft,
  },
});
