import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/features/auth/AuthContext";
import { getUserFacingErrorMessage } from "@/lib/api";
import { colors, radii } from "@/theme/tokens";

export default function TwoFactorScreen() {
  const { completeTwoFactorLogin, cancelTwoFactorLogin } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await completeTwoFactorLogin(code.trim());
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "Código inválido"));
    } finally {
      setSubmitting(false);
    }
  }

  function onBack() {
    cancelTwoFactorLogin();
    router.replace("/(auth)/login");
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Verificación en dos pasos</Text>
        <Text style={styles.subtitle}>
          {params.name
            ? `Hola ${params.name}. Ingresá el código de tu app autenticadora.`
            : "Ingresá el código de tu app autenticadora."}
        </Text>

        <Input
          label="Código"
          keyboardType="number-pad"
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          maxLength={8}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={submitting ? "Verificando…" : "Continuar"}
          loading={submitting}
          fullWidth
          onPress={onSubmit}
        />
        <Button title="Volver" variant="ghost" fullWidth onPress={onBack} />
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
