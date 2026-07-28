import { useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { colors, radii } from "@/theme/tokens";

type TotpSetupResponse = {
  secret: string;
  provisioning_uri: string;
};

/**
 * Modal bloqueante: obliga a configurar 2FA (igual que en web).
 * No se puede usar la app hasta completarlo.
 */
export function MandatoryTwoFactorModal() {
  const { user, token, refreshUser, logout } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [setupData, setSetupData] = useState<TotpSetupResponse | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user || !token || user.totp_enabled) return null;

  async function handleStart() {
    setError("");
    setBusy(true);
    try {
      const data = await api.post<TotpSetupResponse>("/auth/2fa/setup", {}, token);
      setSetupData(data);
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("twoFactorRequired.error")));
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenAuthenticator() {
    if (!setupData?.provisioning_uri) return;
    try {
      await Linking.openURL(setupData.provisioning_uri);
    } catch {
      setError(t("twoFactorRequired.openAppError"));
    }
  }

  async function handleConfirm() {
    if (confirmCode.length !== 6 || !token) return;
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/2fa/confirm", { code: confirmCode }, token);
      await refreshUser();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("twoFactorRequired.error")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.backdrop,
            {
              paddingTop: Math.max(insets.top, 16) + 8,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
        >
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="shield-checkmark" size={36} color={colors.brand} />
            </View>
            <Text style={styles.title}>{t("twoFactorRequired.title")}</Text>
            <Text style={styles.subtitle}>{t("twoFactorRequired.subtitle")}</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {!setupData ? (
              <>
                <Text style={styles.body}>{t("twoFactorRequired.explanation")}</Text>
                <View style={styles.actions}>
                  <Button
                    title={busy ? t("twoFactorRequired.settingUp") : t("twoFactorRequired.start")}
                    loading={busy}
                    fullWidth
                    onPress={() => void handleStart()}
                  />
                  <Pressable onPress={logout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>{t("common.logout")}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.body}>{t("twoFactorRequired.scanHint")}</Text>
                <Button
                  title={t("twoFactorRequired.openApp")}
                  variant="secondary"
                  fullWidth
                  onPress={() => void handleOpenAuthenticator()}
                />
                <Text style={styles.manualLabel}>{t("twoFactorRequired.manualEntry")}</Text>
                <Text selectable style={styles.secret}>
                  {setupData.secret}
                </Text>
                <TextInput
                  value={confirmCode}
                  onChangeText={(v) => setConfirmCode(v.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={colors.brownMuted}
                  style={styles.codeInput}
                  editable={!busy}
                />
                <View style={styles.actions}>
                  <Button
                    title={
                      busy ? t("twoFactorRequired.confirming") : t("twoFactorRequired.confirm")
                    }
                    loading={busy}
                    disabled={confirmCode.length !== 6}
                    fullWidth
                    onPress={() => void handleConfirm()}
                  />
                  <Pressable onPress={logout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>{t("common.logout")}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flexGrow: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: 22,
    gap: 10,
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.soft,
    textAlign: "center",
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.brown,
    textAlign: "center",
    marginBottom: 4,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
  },
  manualLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brown,
    marginTop: 4,
  },
  secret: {
    fontFamily: "Courier",
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.creamSoft,
    borderRadius: radii.control,
    padding: 12,
    overflow: "hidden",
  },
  codeInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    paddingHorizontal: 14,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: "center",
    color: colors.ink,
    backgroundColor: colors.cream,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  logoutBtn: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.soft,
  },
});
