import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { User } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

export default function CuentaScreen() {
  const { user, token, logout, refreshUser } = useAuth();
  const isAdmin = user?.role.code === "ADMIN";

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileOk, setProfileOk] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordOk, setPasswordOk] = useState<string | null>(null);

  const [switchingMerchant, setSwitchingMerchant] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name);
    setLastName(user.last_name);
    setEmail(user.email);
  }, [user]);

  async function saveProfile() {
    if (!token) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileOk(null);
    try {
      await api.patch<User>(
        "/auth/me",
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
        },
        token,
      );
      await refreshUser();
      setProfileOk("Perfil actualizado");
    } catch (err) {
      setProfileError(getUserFacingErrorMessage(err, "No se pudo guardar el perfil"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (!token) return;
    setPasswordError(null);
    setPasswordOk(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    setSavingPassword(true);
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
      setPasswordOk("Contraseña actualizada");
    } catch (err) {
      setPasswordError(
        getUserFacingErrorMessage(err, "No se pudo cambiar la contraseña"),
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function setActiveMerchant(merchantId: number) {
    if (!token) return;
    setSwitchingMerchant(true);
    try {
      await api.put("/auth/me/active-merchant", { merchant_id: merchantId }, token);
      await refreshUser();
    } catch (err) {
      Alert.alert(
        "Error",
        getUserFacingErrorMessage(err, "No se pudo cambiar el comercio"),
      );
    } finally {
      setSwitchingMerchant(false);
    }
  }

  const merchants = user?.merchants ?? [];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Mi cuenta</Text>

        <Card title="Perfil">
          {isAdmin ? (
            <View style={styles.form}>
              <Input
                label="Nombre"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
              <Input
                label="Apellido"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={styles.meta}>Teléfono: {user?.phone || "—"}</Text>
              <Text style={styles.meta}>Rol: {user?.role.name}</Text>
              {profileError ? <Text style={styles.error}>{profileError}</Text> : null}
              {profileOk ? <Text style={styles.ok}>{profileOk}</Text> : null}
              <Button
                title="Guardar perfil"
                fullWidth
                loading={savingProfile}
                onPress={() => void saveProfile()}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.name}>
                {user?.first_name} {user?.last_name}
              </Text>
              <Text style={styles.meta}>{user?.email}</Text>
              <Text style={styles.meta}>Teléfono: {user?.phone || "—"}</Text>
              <Text style={styles.meta}>{user?.role.name}</Text>
              {user?.active_merchant ? (
                <Text style={styles.merchant}>
                  Comercio: {user.active_merchant.name}
                </Text>
              ) : null}
            </View>
          )}
        </Card>

        {merchants.length > 1 ? (
          <Card title="Comercio activo">
            <View style={styles.form}>
              {merchants.map((m) => {
                const active = user?.active_merchant_id === m.id;
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.merchantOption, active && styles.merchantActive]}
                    disabled={switchingMerchant || active}
                    onPress={() => void setActiveMerchant(m.id)}
                  >
                    <Text style={[styles.merchantName, active && styles.merchantNameActive]}>
                      {m.name}
                    </Text>
                    <Text style={styles.meta}>{m.code}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}

        <Card title="Cambiar contraseña">
          <View style={styles.form}>
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
            {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
            {passwordOk ? <Text style={styles.ok}>{passwordOk}</Text> : null}
            <Button
              title="Actualizar contraseña"
              fullWidth
              loading={savingPassword}
              onPress={() => void changePassword()}
            />
          </View>
        </Card>

        <Button title="Cerrar sesión" variant="secondary" fullWidth onPress={logout} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.brown,
  },
  form: {
    gap: 12,
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
  merchant: {
    marginTop: 4,
    fontSize: 13,
    color: colors.brand,
    fontWeight: "600",
  },
  merchantOption: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    backgroundColor: colors.white,
    padding: 12,
    gap: 2,
  },
  merchantActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  merchantName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  merchantNameActive: {
    color: colors.brand,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  ok: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "600",
  },
});
