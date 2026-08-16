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

import { AvatarEditorCard } from "@/features/auth/AvatarEditorCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { isSedeRequiredRole } from "@/lib/roles";
import type { User } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

export default function CuentaScreen() {
  const { user, token, logout, refreshUser } = useAuth();
  const { t } = useTranslation();
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
      setProfileOk(t("account.profileSaved"));
    } catch (err) {
      setProfileError(getUserFacingErrorMessage(err, t("account.profileError")));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    if (!token) return;
    setPasswordError(null);
    setPasswordOk(null);
    if (newPassword !== confirmPassword) {
      setPasswordError(t("changePassword.mismatch"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("changePassword.minLength"));
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
      setPasswordOk(t("account.passwordUpdated"));
    } catch (err) {
      setPasswordError(
        getUserFacingErrorMessage(err, t("account.passwordError")),
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
        t("common.error"),
        getUserFacingErrorMessage(err, t("account.merchantSwitchError")),
      );
    } finally {
      setSwitchingMerchant(false);
    }
  }

  const merchants = user?.merchants ?? [];
  const showSede = isSedeRequiredRole(user?.role.code);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("account.title")}</Text>

        <AvatarEditorCard />

        <Card title={t("account.profileTitle")}>
          {isAdmin ? (
            <View style={styles.form}>
              <Input
                label={t("common.firstName")}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
              <Input
                label={t("common.lastName")}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
              <Input
                label={t("common.email")}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={styles.meta}>
                {t("common.phone")}: {user?.phone || t("common.dash")}
              </Text>
              {profileError ? <Text style={styles.error}>{profileError}</Text> : null}
              {profileOk ? <Text style={styles.ok}>{profileOk}</Text> : null}
              <Button
                title={t("account.profileSave")}
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
              <Text style={styles.meta}>
                {t("common.phone")}: {user?.phone || t("common.dash")}
              </Text>
              <Text style={styles.meta}>
                {t("common.role")}: {user?.role.name || t("common.dash")}
              </Text>
              {showSede ? (
                <Text style={styles.meta}>
                  {t("users.sede")}: {user?.sede?.name || t("users.noSede")}
                </Text>
              ) : null}
              {user?.active_merchant ? (
                <Text style={styles.merchant}>
                  {t("account.merchantLabel")}: {user.active_merchant.name}
                </Text>
              ) : null}
            </View>
          )}
        </Card>

        {merchants.length > 1 ? (
          <Card title={t("account.activeMerchant")}>
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

        <Card title={t("account.passwordTitle")}>
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
            {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
            {passwordOk ? <Text style={styles.ok}>{passwordOk}</Text> : null}
            <Button
              title={t("account.passwordUpdate")}
              fullWidth
              loading={savingPassword}
              onPress={() => void changePassword()}
            />
          </View>
        </Card>

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
