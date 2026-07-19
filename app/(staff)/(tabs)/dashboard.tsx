import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { DashboardMetrics } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = user ? `${user.first_name} ${user.last_name}`.trim() : "";

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const metrics = await api.get<DashboardMetrics>("/dashboard/metrics", token);
        setData(metrics);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, "No se pudieron cargar las métricas"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  if (authLoading || (loading && !data && !error)) {
    return <ScreenState loading message="Cargando panel…" />;
  }

  const summary = data?.summary;

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
      <Text style={styles.title}>Panel</Text>
      <Text style={styles.subtitle}>
        {name ? `Hola, ${name}` : "Bienvenido"} · {user?.role.name}
        {data?.merchant ? ` · ${data.merchant.name}` : ""}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {summary ? (
        <View style={styles.grid}>
          <MetricCard label="Total" value={summary.total} />
          <MetricCard label="Pendientes" value={summary.pending_review} />
          <MetricCard label="Aprobados" value={summary.approved_in_onboarding} />
          <MetricCard label="Rechazados" value={summary.rejected} />
          <MetricCard label="En progreso" value={summary.onboarding_in_progress} />
          <MetricCard label="Completados" value={summary.completed} />
        </View>
      ) : null}

      {data?.areas?.length ? (
        <Card title="Áreas">
          {data.areas.map((area) => (
            <View key={area.code} style={styles.areaRow}>
              <View style={styles.areaInfo}>
                <Text style={styles.areaName}>{area.name}</Text>
                <Text style={styles.areaMeta}>
                  {area.in_pipeline} en pipeline · {area.completed} completados
                </Text>
              </View>
              <Text style={styles.conversion}>
                {area.conversion_rate != null
                  ? `${Math.round(area.conversion_rate * 100)}%`
                  : "—"}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
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
    gap: 12,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 14,
    color: colors.soft,
    marginBottom: 8,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metric: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 4,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.brand,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.soft,
    fontWeight: "600",
  },
  areaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  areaInfo: {
    flex: 1,
    gap: 2,
  },
  areaName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  areaMeta: {
    fontSize: 12,
    color: colors.soft,
  },
  conversion: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.brand,
    marginLeft: 12,
  },
});
