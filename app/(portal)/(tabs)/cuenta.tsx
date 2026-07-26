import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AvatarEditorCard } from "@/features/auth/AvatarEditorCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Section } from "@/components/ui/Section";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { colors } from "@/theme/tokens";

export default function PortalCuentaScreen() {
  const { user, token, logout } = useAuth();
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onChangePassword() {
    if (!token) return;
    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(t("changePassword.mismatch"));
      return;
    }
    if (newPassword.length < 8) {
      setError(t("changePassword.minLength"));
      return;
    }

    setSubmitting(true);
    try {
      await api.post(
        "/auth/change-password",
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        token,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(t("account.passwordUpdated"));
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("account.passwordError")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t("account.portalTitle")}</Text>

        <AvatarEditorCard />

        <Card title={t("account.profileTitle")}>
          <Text style={styles.name}>
            {user?.first_name} {user?.last_name}
          </Text>
          <Text style={styles.meta}>{user?.email}</Text>
          {user?.phone ? <Text style={styles.meta}>{user.phone}</Text> : null}
          {user?.role ? (
            <Text style={styles.meta}>
              {t("common.role")}: {user.role.name}
            </Text>
          ) : null}
        </Card>

        <Section title={t("account.passwordTitle")}>
          <View style={styles.form}>
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
            {message ? <Text style={styles.success}>{message}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title={submitting ? t("common.saving") : t("account.passwordUpdate")}
              loading={submitting}
              fullWidth
              onPress={onChangePassword}
            />
          </View>
        </Section>

        <Button
          title={t("common.logout")}
          variant="secondary"
          fullWidth
          onPress={logout}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: 20,
    gap: 18,
    // Deja libre la zona del botón flotante del chat.
    paddingBottom: 130,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.brown,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  meta: {
    fontSize: 14,
    color: colors.soft,
  },
  form: {
    gap: 12,
  },
  success: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "600",
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
