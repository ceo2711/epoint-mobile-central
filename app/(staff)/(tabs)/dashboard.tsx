import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { SedeBranchList } from "@/components/staff/SedeBranchList";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import {
  BarList,
  DonutChart,
  Sparkline,
  StackedBar,
  STATUS_CHART_COLORS,
  formatPercent,
  type ChartSlice,
} from "@/features/dashboard/charts";
import { useAdminSedeScope } from "@/hooks/useAdminSedeScope";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { buildScopeQuery } from "@/lib/staffScope";
import type {
  AreaMetrics,
  ClientStats,
  DashboardMetrics,
  StatusCount,
  TimeseriesPoint,
} from "@/types/api";
import { CLIENT_STATUS_LABELS, PROSPECT_STATUS_LABELS } from "@/types/api";
import { colors, radii, spacing } from "@/theme/tokens";

const CLIENT_SUMMARY_KEYS: Array<{
  key: keyof ClientStats;
  status: string;
  labelKey: string;
  hintKey: string;
}> = [
  {
    key: "pending_review",
    status: "PENDIENTE_DE_REVISION",
    labelKey: "dashboard.pendingReview",
    hintKey: "dashboard.pendingReviewHint",
  },
  {
    key: "approved_in_onboarding",
    status: "APROBADO_PARA_ONBOARDING",
    labelKey: "dashboard.approvedClients",
    hintKey: "dashboard.approvedClientsHint",
  },
  {
    key: "rejected",
    status: "RECHAZADO",
    labelKey: "dashboard.rejectedClients",
    hintKey: "dashboard.rejectedClientsHint",
  },
  {
    key: "onboarding_in_progress",
    status: "ONBOARDING_EN_PROGRESO",
    labelKey: "dashboard.onboardingInProgress",
    hintKey: "dashboard.onboardingInProgressHint",
  },
  {
    key: "completed",
    status: "ONBOARDING_COMPLETADO",
    labelKey: "dashboard.completedClients",
    hintKey: "dashboard.completedClientsHint",
  },
];

function statusLabel(status: string): string {
  return CLIENT_STATUS_LABELS[status] ?? PROSPECT_STATUS_LABELS[status] ?? status;
}

function slicesFromStatus(items: StatusCount[]): ChartSlice[] {
  return items.map((item) => ({
    key: item.status,
    label: statusLabel(item.status),
    value: item.count,
    color: STATUS_CHART_COLORS[item.status] ?? colors.brownMuted,
  }));
}

function lastDays(series: TimeseriesPoint[] | undefined, days = 14): number[] {
  if (!series?.length) return [];
  const byDate = new Map(series.map((point) => [point.date, point.count]));
  const out: number[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    out.push(byDate.get(key) ?? 0);
  }
  return out;
}

function AreaCard({
  area,
  t,
}: {
  area: AreaMetrics;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const isSales = area.code === "VENTAS";
  const slices = slicesFromStatus(area.by_status ?? []);
  const conversion = formatPercent(area.conversion_rate);

  return (
    <Card>
      <Text style={styles.sectionTitle}>{area.name}</Text>

      <View style={styles.areaKpis}>
        <View style={styles.areaKpi}>
          <Text style={styles.areaKpiValue}>{area.total}</Text>
          <Text style={styles.areaKpiLabel}>
            {isSales ? t("dashboard.totalProspects") : t("dashboard.totalInArea")}
          </Text>
        </View>
        <View style={styles.areaKpi}>
          <Text style={styles.areaKpiValue}>{area.in_pipeline}</Text>
          <Text style={styles.areaKpiLabel}>
            {isSales ? t("dashboard.prospectsInPipeline") : t("dashboard.inPipeline")}
          </Text>
        </View>
        <View style={styles.areaKpi}>
          <Text style={[styles.areaKpiValue, styles.areaKpiAccent]}>
            {isSales ? conversion : area.completed}
          </Text>
          <Text style={styles.areaKpiLabel}>
            {isSales ? t("dashboard.salesConversion") : t("dashboard.completedClients")}
          </Text>
        </View>
      </View>

      {isSales ? (
        <Text style={styles.conversionCaption}>{t("dashboard.salesConversionHint")}</Text>
      ) : null}

      <StackedBar slices={slices} />
      <BarList slices={slices} />
    </Card>
  );
}

export default function DashboardScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const scope = useAdminSedeScope({ loadReps: true });
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metricsEnabled = !scope.isGlobal || scope.selectedSedeId != null;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !metricsEnabled) {
        setData(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const qs = buildScopeQuery({
          sedeId: scope.isGlobal ? scope.selectedSedeId : null,
        });
        const metrics = await api.get<DashboardMetrics>(
          `/dashboard/metrics${qs ? `?${qs}` : ""}`,
          token,
        );
        setData(metrics);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("dashboard.loadError")));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, t, metricsEnabled, scope.isGlobal, scope.selectedSedeId],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  const summary = data?.summary;
  const clientSlices = useMemo<ChartSlice[]>(() => {
    if (!summary) return [];
    return CLIENT_SUMMARY_KEYS.map((item) => ({
      key: item.status,
      label: t(item.labelKey),
      value: summary[item.key],
      color: STATUS_CHART_COLORS[item.status] ?? colors.brownMuted,
    }));
  }, [summary, t]);

  const clientTrend = lastDays(data?.registrations);
  const prospectTrend = lastDays(data?.prospect_registrations);
  const hasClientTrend = clientTrend.some((value) => value > 0);
  const hasProspectTrend = prospectTrend.some((value) => value > 0);

  if (authLoading || scope.loading) {
    return <ScreenState loading message={t("dashboard.loading")} />;
  }

  if (scope.showSedePicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("dashboard.title")}</Text>
        <Text style={styles.subtitle}>{t("dashboard.pickSede")}</Text>
        {scope.error ? <Text style={styles.error}>{t(scope.error)}</Text> : null}
        <SedeBranchList
          branches={scope.branches}
          onSelect={scope.selectSede}
          hintKey="dashboard.pickSede"
        />
      </ScrollView>
    );
  }

  if (loading && !data && !error) {
    return <ScreenState loading message={t("dashboard.loading")} />;
  }

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
      <ScopePageHeader
        title={t("dashboard.title")}
        backLabel={scope.isGlobal ? t("scope.backToSedes") : undefined}
        onBack={scope.isGlobal ? scope.clearSede : undefined}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {summary ? (
        <Card>
          <Text style={styles.sectionTitle}>{t("dashboard.clientsTitle")}</Text>

          <View style={styles.donutRow}>
            <DonutChart
              slices={clientSlices}
              centerValue={summary.total}
              centerLabel={t("dashboard.totalClientsShort")}
            />
            <View style={styles.legend}>
              {clientSlices.map((slice) => (
                <View key={slice.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                  <Text style={styles.legendLabel} numberOfLines={2}>
                    {slice.label}
                  </Text>
                  <Text style={styles.legendValue}>{slice.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <StackedBar slices={clientSlices} />

          <View style={styles.statGrid}>
            {CLIENT_SUMMARY_KEYS.map((item) => (
              <View key={item.key} style={styles.statCard}>
                <Text style={styles.statValue}>{summary[item.key]}</Text>
                <Text style={styles.statLabel}>{t(item.labelKey)}</Text>
                <Text style={styles.statHint}>{t(item.hintKey)}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {data?.areas?.map((area) => (
        <AreaCard key={area.code} area={area} t={t} />
      ))}

      {hasClientTrend || hasProspectTrend ? (
        <Card>
          <Text style={styles.sectionTitle}>{t("dashboard.trendTitle")}</Text>
          {hasClientTrend ? (
            <View style={styles.trendBlock}>
              <Text style={styles.trendLabel}>{t("dashboard.clientsTrend")}</Text>
              <Sparkline points={clientTrend} color={colors.brand} />
            </View>
          ) : null}
          {hasProspectTrend ? (
            <View style={styles.trendBlock}>
              <Text style={styles.trendLabel}>{t("dashboard.prospectsTrend")}</Text>
              <Sparkline points={prospectTrend} color={colors.gold} />
            </View>
          ) : null}
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
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 14,
    color: colors.soft,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.brown,
    marginBottom: 4,
  },
  donutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
  },
  legendValue: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brown,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  statCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.brand,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  statHint: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.soft,
  },
  areaKpis: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  areaKpi: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 2,
  },
  areaKpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brown,
  },
  areaKpiAccent: {
    color: colors.brand,
  },
  areaKpiLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.soft,
  },
  conversionCaption: {
    fontSize: 12,
    color: colors.soft,
    marginBottom: 4,
  },
  trendBlock: {
    gap: 4,
  },
  trendLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
});
