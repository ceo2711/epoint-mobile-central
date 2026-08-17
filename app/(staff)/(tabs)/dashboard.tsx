import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SalesRepList } from "@/components/staff/SalesRepList";
import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { SedeBranchList } from "@/components/staff/SedeBranchList";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { AreaMetricsCard } from "@/features/dashboard/AreaMetricsCard";
import { SalesLeadershipCard } from "@/features/dashboard/SalesLeadershipCard";
import {
  DonutChart,
  Sparkline,
  StackedBar,
  STATUS_CHART_COLORS,
  type ChartSlice,
} from "@/features/dashboard/charts";
import { useAdminSedeScope } from "@/hooks/useAdminSedeScope";
import { isGlobalAdmin, isSalesAreaLeader, seesOnboardingDashboard } from "@/lib/roles";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { buildScopeQuery } from "@/lib/staffScope";
import type { ClientStats, DashboardMetrics, TimeseriesPoint } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

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

export default function DashboardScreen() {
  const { token, user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const salesLeader = isSalesAreaLeader(user);
  const onboardingDashboard = seesOnboardingDashboard(user);
  const scope = useAdminSedeScope({
    loadReps: isGlobalAdmin(user?.role.code) || salesLeader,
  });
  const [selectedRepId, setSelectedRepId] = useState<number | null>(null);
  const [loadedRepId, setLoadedRepId] = useState<number | null>(null);
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metricsEnabled = !scope.isGlobal || scope.selectedSedeId != null;
  const selectedRep =
    salesLeader && selectedRepId != null
      ? (scope.salesReps.find((rep) => rep.id === selectedRepId) ?? null)
      : null;
  const repsForList = scope.isGlobal ? scope.repsForSelectedSede : scope.salesReps;

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
          salesRepId: salesLeader ? selectedRepId : null,
        });
        const metrics = await api.get<DashboardMetrics>(
          `/dashboard/metrics${qs ? `?${qs}` : ""}`,
          token,
        );
        setData(metrics);
        setLoadedRepId(salesLeader ? selectedRepId : null);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("dashboard.loadError")));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      token,
      t,
      metricsEnabled,
      scope.isGlobal,
      scope.selectedSedeId,
      salesLeader,
      selectedRepId,
    ],
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
  const completionTrend = lastDays(data?.completions);
  const hasClientTrend = !salesLeader && clientTrend.some((value) => value > 0);
  const hasProspectTrend =
    !onboardingDashboard && prospectTrend.some((value) => value > 0);
  const hasCompletionTrend =
    onboardingDashboard && completionTrend.some((value) => value > 0);
  const showClientSummary = Boolean(summary) && !salesLeader && !onboardingDashboard;
  const salesArea = data?.areas.find((area) => area.code === "VENTAS") ?? null;
  const metricsMatchSelection = !salesLeader || loadedRepId === selectedRepId;
  const leadership =
    salesLeader && selectedRepId == null && metricsMatchSelection
      ? (data?.sales_leadership ?? null)
      : null;
  const selectedName = selectedRep
    ? `${selectedRep.first_name} ${selectedRep.last_name}`.trim()
    : "";

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

  const viewingRep = salesLeader && selectedRepId != null;
  const headerTitle = viewingRep
    ? selectedName
      ? t("dashboard.metricsOfRep", { name: selectedName })
      : t("dashboard.title")
    : t("dashboard.title");
  const headerBackLabel = viewingRep
    ? t("dashboard.backToGeneralPanel")
    : scope.isGlobal
      ? t("scope.backToSedes")
      : undefined;
  const headerOnBack = viewingRep
    ? () => setSelectedRepId(null)
    : scope.isGlobal
      ? () => {
          setSelectedRepId(null);
          scope.clearSede();
        }
      : undefined;

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
        title={headerTitle}
        backLabel={headerBackLabel}
        onBack={headerOnBack}
      />
      {onboardingDashboard && !viewingRep ? (
        <Text style={styles.subtitle}>{t("dashboard.onboardingMetricsSubtitle")}</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {scope.error && salesLeader ? (
        <Text style={styles.error}>{t(scope.error)}</Text>
      ) : null}

      {showClientSummary && summary ? (
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

      {salesLeader && !metricsMatchSelection && !error ? (
        <ScreenState loading message={t("dashboard.loading")} />
      ) : salesLeader ? (
        <>
          {salesArea ? <AreaMetricsCard area={salesArea} /> : null}
          {leadership ? <SalesLeadershipCard leadership={leadership} /> : null}
          {selectedRepId == null ? (
            <SalesRepList
              reps={repsForList}
              onSelect={setSelectedRepId}
              titleKey="users.vendorsListTitle"
              hintKey="users.vendorsListHint"
              showConnectionStatus={false}
            />
          ) : null}
        </>
      ) : (
        data?.areas?.map((area) => <AreaMetricsCard key={area.code} area={area} />)
      )}

      {(hasClientTrend || hasProspectTrend || hasCompletionTrend) &&
      metricsMatchSelection ? (
        <Card>
          <Text style={styles.sectionTitle}>{t("dashboard.trendTitle")}</Text>
          {hasClientTrend ? (
            <View style={styles.trendBlock}>
              <Text style={styles.trendLabel}>{t("dashboard.clientsTrend")}</Text>
              <Sparkline points={clientTrend} color={colors.brand} />
            </View>
          ) : null}
          {hasCompletionTrend ? (
            <View style={styles.trendBlock}>
              <Text style={styles.trendLabel}>{t("dashboard.completionsTrend")}</Text>
              <Sparkline points={completionTrend} color={colors.brandSoft} />
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
  trendBlock: {
    gap: 4,
  },
  trendLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
});
