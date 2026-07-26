import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";

import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { AuthGlassShell } from "@/features/auth/AuthGlassShell";
import { useAuth, mustForcePasswordChange } from "@/features/auth/AuthContext";
import { getUserFacingErrorMessage } from "@/lib/api";
import { getDefaultAppPath } from "@/lib/appNavigation";
import { colors } from "@/theme/tokens";

export default function LoginScreen() {
  const { login, user, isLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View style={styles.loadingRoot}>
        <ScreenState loading />
      </View>
    );
  }

  if (user) {
    if (mustForcePasswordChange(user)) {
      return <Redirect href="/(auth)/change-password" />;
    }
    return <Redirect href={getDefaultAppPath(user.role.code) as never} />;
  }

  async function onSubmit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (result.requiresTwoFactor) {
        router.push({
          pathname: "/(auth)/two-factor",
          params: { name: result.userName ?? "" },
        });
      }
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("common.loginError")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGlassShell
      cardPaddingTop={20}
      topLeftContent={
        <View style={styles.brandRow}>
          <View style={styles.logoWrap}>
            <Image
              source={require("../../assets/epoint-logo.png")}
              style={styles.logo}
              resizeMode="cover"
              accessibilityLabel="Epoint"
            />
          </View>
          <Text style={styles.brandName}>Epoint Corporation</Text>
        </View>
      }
    >
      <Text style={styles.title}>{t("login.welcome")}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inputWrap}>
        <Ionicons name="mail-outline" size={18} color={colors.brownMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          autoComplete="email"
          value={email}
          onChangeText={(value) => setEmail(value.toLowerCase())}
          placeholder={t("login.emailLabel")}
          placeholderTextColor={colors.brownMuted}
          returnKeyType="next"
        />
      </View>

      <View style={styles.inputWrap}>
        <Ionicons
          name="lock-closed-outline"
          size={18}
          color={colors.brownMuted}
          style={styles.inputIcon}
        />
        <TextInput
          style={[styles.input, styles.inputWithToggle]}
          secureTextEntry={!showPassword}
          textContentType="password"
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          placeholder={t("login.passwordLabel")}
          placeholderTextColor={colors.brownMuted}
          returnKeyType="go"
          onSubmitEditing={onSubmit}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showPassword ? t("login.hidePassword") : t("login.showPassword")
          }
          onPress={() => setShowPassword((v) => !v)}
          style={styles.eyeBtn}
          hitSlop={8}
        >
          <Ionicons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={colors.brownMuted}
          />
        </Pressable>
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        disabled={submitting}
        onPress={onSubmit}
        style={[styles.loginButton, submitting && styles.loginButtonDisabled]}
      >
        <LinearGradient
          colors={["#4a8054", "#3d6b45", "#2d5234"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loginGradient}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>{t("login.submit")}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </AuthGlassShell>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: "#1a1008",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoWrap: {
    width: 54,
    height: 54,
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: "#f0ebe1",
    borderWidth: 1,
    borderColor: "rgba(240, 234, 218, 0.9)",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  brandName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#faf7f0",
    marginBottom: 22,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e8e4df",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginBottom: 16,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
    paddingVertical: 12,
  },
  inputWithToggle: {
    paddingRight: 8,
  },
  eyeBtn: {
    padding: 4,
  },
  error: {
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 14,
    textAlign: "left",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  loginButton: {
    marginTop: 8,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#3d6b45",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.75,
  },
  loginGradient: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
});
