import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ScreenState } from "@/components/ui/ScreenState";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { getDefaultAppPath } from "@/lib/appNavigation";
import { colors, radii } from "@/theme/tokens";

export default function ChangePasswordScreen() {
  const { user, token, refreshUser, isLoading, logout } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <ScreenState loading />;
  if (!user || !token) return <Redirect href="/(auth)/login" />;

  const currentUser = user;
  const currentToken = token;

  async function onSubmit() {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres");
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
      setError(getUserFacingErrorMessage(err, "No se pudo cambiar la contraseña"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Cambiá tu contraseña</Text>
        <Text style={styles.subtitle}>
          Por seguridad, necesitás actualizar tu contraseña antes de continuar.
        </Text>

        <Input
          label="Contraseña actual"
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <Input
          label="Nueva contraseña"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <Input
          label="Confirmar contraseña"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={submitting ? "Guardando…" : "Guardar"}
          loading={submitting}
          fullWidth
          onPress={onSubmit}
        />
        <Button title="Cerrar sesión" variant="ghost" fullWidth onPress={logout} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.cream,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
  },
  subtitle: {
    fontSize: 14,
    color: colors.soft,
    lineHeight: 20,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
