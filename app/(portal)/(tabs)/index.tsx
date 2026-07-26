import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { Client } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

const STEPS = [
  {
    step: "1",
    titleKey: "portal.step1Title",
    descKey: "portal.step1Desc",
    href: "/(portal)/(tabs)/datos",
  },
  {
    step: "2",
    titleKey: "portal.step2Title",
    descKey: "portal.step2Desc",
    href: "/(portal)/(tabs)/documentos",
  },
  {
    step: "3",
    titleKey: "portal.step3Title",
    descKey: "portal.step3Desc",
    href: "/(portal)/(tabs)/tablero",
  },
] as const;

export default function PortalHomeScreen() {
  const { token, user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const data = await api.get<Client>("/portal/me", token);
        setClient(data);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("portal.loadError")));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, t],
  );

  useEffect(() => {
    if (!authLoading && token) {
      void load();
    }
  }, [authLoading, token, load]);

  if (authLoading || loading) {
    return <ScreenState loading message={t("portal.loading")} />;
  }

  const firstName = (client?.first_name || user?.first_name || "").trim();

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.brand}
          onRefresh={() => {
            setRefreshing(true);
            void load({ silent: true });
          }}
        />
      }
    >
      <Text style={styles.title}>
        {firstName ? t("portal.welcomeNamed", { name: firstName }) : t("portal.welcome")}
      </Text>
      <Text style={styles.subtitle}>{t("portal.subtitle")}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.sectionLabel}>{t("portal.nextSteps")}</Text>
      {STEPS.map((item) => (
        <TouchableOpacity
          key={item.step}
          accessibilityRole="button"
          activeOpacity={0.85}
          style={styles.stepCard}
          onPress={() => router.push(item.href as never)}
        >
          <View style={styles.stepBadge}>
            <Text style={styles.stepNumber}>{item.step}</Text>
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>{t(item.titleKey)}</Text>
            <Text style={styles.stepDesc}>{t(item.descKey)}</Text>
            <Text style={styles.stepLink}>{t("common.go")}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: 20,
    gap: 14,
    // Deja libre la zona del botón flotante del chat.
    paddingBottom: 130,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 14,
    color: colors.soft,
    lineHeight: 20,
    marginBottom: 4,
  },
  sectionLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.brownMuted,
  },
  stepCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 15,
  },
  stepBody: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  stepDesc: {
    fontSize: 13,
    color: colors.soft,
    lineHeight: 18,
  },
  stepLink: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand,
  },
  error: {
    color: colors.danger,
  },
});
