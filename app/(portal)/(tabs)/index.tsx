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

import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { Client } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

const STEPS = [
  {
    step: "1",
    title: "Completá tus datos",
    description: "SSN, fecha de nacimiento, domicilio y vehículo.",
    href: "/(portal)/(tabs)/datos",
  },
  {
    step: "2",
    title: "Subí tus documentos",
    description: "Licencia, SSN y comprobantes para verificación.",
    href: "/(portal)/(tabs)/documentos",
  },
  {
    step: "3",
    title: "Seguí tu tablero",
    description: "Revisá el progreso de tu onboarding.",
    href: "/(portal)/(tabs)/tablero",
  },
] as const;

export default function PortalHomeScreen() {
  const { token, user, isLoading: authLoading } = useAuth();
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
        setError(getUserFacingErrorMessage(err, "No se pudo cargar tu portal"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!authLoading && token) {
      void load();
    }
  }, [authLoading, token, load]);

  if (authLoading || loading) {
    return <ScreenState loading message="Cargando tu portal…" />;
  }

  const displayName =
    client
      ? `${client.first_name} ${client.last_name}`.trim()
      : user
        ? `${user.first_name} ${user.last_name}`.trim()
        : "";

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
      <Text style={styles.title}>Bienvenido{displayName ? `, ${displayName}` : ""}</Text>
      <Text style={styles.subtitle}>
        Completá tu información y seguí el avance de tu onboarding desde acá.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card>
        {client?.status ? <StatusBadge status={client.status} /> : null}
        {client?.merchant ? (
          <Text style={styles.meta}>Comercio: {client.merchant.name}</Text>
        ) : null}
        {client?.advisor ? (
          <Text style={styles.meta}>
            Asesor: {client.advisor.first_name} {client.advisor.last_name}
          </Text>
        ) : null}
      </Card>

      <Text style={styles.sectionLabel}>Próximos pasos</Text>
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
            <Text style={styles.stepTitle}>{item.title}</Text>
            <Text style={styles.stepDesc}>{item.description}</Text>
            <Text style={styles.stepLink}>Ir →</Text>
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
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
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
  meta: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
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
