import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { AuthGlassShell } from "@/features/auth/AuthGlassShell";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { getDefaultAppPath } from "@/lib/appNavigation";
import { colors } from "@/theme/tokens";

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

      <Input
        label={t("changePassword.currentPassword")}
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      <Input
        label={t("changePassword.newPassword")}
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <Input
        label={t("changePassword.confirmPassword")}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button
          title={submitting ? t("changePassword.saving") : t("changePassword.save")}
          loading={submitting}
          fullWidth
          onPress={onSubmit}
        />
        <Button title={t("common.logout")} variant="ghost" fullWidth onPress={logout} />
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
    color: "#0d141a",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#333333",
    lineHeight: 20,
    marginBottom: 18,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 8,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
});
