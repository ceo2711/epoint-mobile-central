import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { AuthGlassShell } from "@/features/auth/AuthGlassShell";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { getDefaultAppPath } from "@/lib/appNavigation";

const PLACEHOLDER_WHITE = "rgba(255, 255, 255, 0.92)";

export default function ChangePasswordScreen() {
  const { user, token, refreshUser, isLoading, logout } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View style={styles.loadingRoot}>
        <ScreenState loading />
      </View>
    );
  }
  if (!user || !token) return <Redirect href="/(auth)/login" />;

  const currentUser = user;
  const currentToken = token;

  async function onSubmit() {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t("changePassword.mismatch"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("changePassword.minLength"));
      return;
    }

    const roleFallback = currentUser.role.code;
    setSubmitting(true);
    try {
      await api.post(
        "/auth/change-password",
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        currentToken,
      );
      const updated = await refreshUser();
      router.replace(getDefaultAppPath(updated?.role.code ?? roleFallback) as never);
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("changePassword.error")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGlassShell>
      <Text style={styles.title}>{t("changePassword.title")}</Text>
      <Text style={styles.subtitle}>{t("changePassword.subtitle")}</Text>

      <View style={styles.fields}>
        <Input
          placeholder={t("changePassword.currentPassword")}
          placeholderTextColor={PLACEHOLDER_WHITE}
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
          style={styles.field}
        />
        <Input
          placeholder={t("changePassword.newPassword")}
          placeholderTextColor={PLACEHOLDER_WHITE}
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.field}
        />
        <Input
          placeholder={t("changePassword.confirmPassword")}
          placeholderTextColor={PLACEHOLDER_WHITE}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.field}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button
          title={submitting ? t("changePassword.saving") : t("changePassword.save")}
          loading={submitting}
          fullWidth
          onPress={onSubmit}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.logout")}
          onPress={logout}
          style={styles.logoutBtn}
        >
          <Text style={styles.logoutText}>{t("common.logout")}</Text>
        </Pressable>
      </View>
    </AuthGlassShell>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: "#1a1008",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#faf7f0",
    marginBottom: 6,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(250, 247, 240, 0.88)",
    lineHeight: 20,
    marginBottom: 18,
  },
  fields: {
    gap: 12,
  },
  field: {
    backgroundColor: "rgba(20, 14, 8, 0.45)",
    borderColor: "rgba(255, 255, 255, 0.35)",
    color: "#ffffff",
  },
  error: {
    color: "#fecaca",
    fontSize: 13,
    marginTop: 10,
    marginBottom: 8,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  logoutBtn: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
