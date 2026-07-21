import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenState } from "@/components/ui/ScreenState";
import { useAuth, mustForcePasswordChange } from "@/features/auth/AuthContext";
import { getUserFacingErrorMessage } from "@/lib/api";
import { getDefaultAppPath } from "@/lib/appNavigation";

export default function LoginScreen() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return <ScreenState loading />;
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
      const result = await login(email, password);
      if (result.requiresTwoFactor) {
        router.push({
          pathname: "/(auth)/two-factor",
          params: { name: result.userName ?? "" },
        });
      }
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo iniciar sesión"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.centerBlock}>
            <View style={styles.logoWrap}>
              <Image
                source={require("../../assets/epoint-logo.png")}
                style={styles.logo}
                resizeMode="cover"
                accessibilityLabel="Epoint"
              />
            </View>
            <Text style={styles.title}>Bienvenido</Text>
            <Text style={styles.subtitle}>Ingresá a Epoint Central</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              placeholder="vos@epoint.com"
              placeholderTextColor="#a08070"
              returnKeyType="next"
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#a08070"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={submitting}
              onPress={onSubmit}
              style={[styles.loginButton, submitting && styles.loginButtonDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginButtonText}>Iniciar sesión</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#faf8f5",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  centerBlock: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  logoWrap: {
    width: 120,
    height: 120,
    alignSelf: "center",
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 12,
    backgroundColor: "#f5f1e6",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#6b6560",
    textAlign: "center",
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5c4033",
    marginBottom: 6,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#e8e4df",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#1a1a1a",
    marginBottom: 16,
  },
  error: {
    color: "#b54a3a",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
    backgroundColor: "#fde8e6",
    borderWidth: 1,
    borderColor: "#f0b4ae",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  loginButton: {
    height: 56,
    width: "100%",
    backgroundColor: "#3d6b45",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
});
