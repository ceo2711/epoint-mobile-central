import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTranslation } from "@/contexts/LanguageContext";
import { AuthGlassShell } from "@/features/auth/AuthGlassShell";
import { useAuth } from "@/features/auth/AuthContext";
import { getUserFacingErrorMessage } from "@/lib/api";
import { colors } from "@/theme/tokens";

export default function TwoFactorScreen() {
  const { completeTwoFactorLogin, cancelTwoFactorLogin } = useAuth();
  const { t } = useTranslation();
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
      setError(getUserFacingErrorMessage(err, t("twoFactor.verifyError")));
    } finally {
      setSubmitting(false);
    }
  }

  function onBack() {
    cancelTwoFactorLogin();
    router.replace("/(auth)/login");
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
      <Text style={styles.title}>{t("twoFactor.verifyTitle")}</Text>
      <Text style={styles.subtitle}>
        {params.name
          ? t("twoFactor.verifySubtitleNamed", { name: params.name })
          : t("twoFactor.verifySubtitle")}
      </Text>

      <Input
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
        placeholder={t("twoFactor.codeLabel")}
        maxLength={8}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button
          title={submitting ? t("twoFactor.verifying") : t("twoFactor.verifySubmit")}
          loading={submitting}
          fullWidth
          onPress={onSubmit}
        />
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>
      </View>
    </AuthGlassShell>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 24,
    fontWeight: "700",
    color: "#faf7f0",
    marginBottom: 8,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#f5f0e6",
    lineHeight: 20,
    marginBottom: 18,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  backBtn: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#faf7f0",
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
