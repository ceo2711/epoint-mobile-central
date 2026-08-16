import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  BarList,
  StackedBar,
  STATUS_CHART_COLORS,
  formatPercent,
  type ChartSlice,
} from "@/features/dashboard/charts";
import type { AreaMetrics } from "@/types/api";
import { CLIENT_STATUS_LABELS, PROSPECT_STATUS_LABELS } from "@/types/api";
import { colors, radii, spacing } from "@/theme/tokens";

function statusLabel(status: string): string {
  return CLIENT_STATUS_LABELS[status] ?? PROSPECT_STATUS_LABELS[status] ?? status;
}

function slicesFromStatus(items: AreaMetrics["by_status"]): ChartSlice[] {
  return (items ?? []).map((item) => ({
    key: item.status,
    label: statusLabel(item.status),
    value: item.count,
    color: STATUS_CHART_COLORS[item.status] ?? colors.brownMuted,
  }));
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function AreaMetricsCard({ area }: { area: AreaMetrics }) {
  const { t } = useTranslation();
  const isSales = area.code === "VENTAS";
  const slices = slicesFromStatus(area.by_status);
  const conversion = formatPercent(area.conversion_rate);
  const showCommission =
    isSales &&
    (area.monthly_commission != null || area.monthly_paid_count != null);

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

      {showCommission ? (
        <View style={styles.areaKpis}>
          <View style={styles.areaKpi}>
            <Text style={styles.areaKpiValue}>{area.monthly_paid_count ?? 0}</Text>
            <Text style={styles.areaKpiLabel}>{t("dashboard.monthlySales")}</Text>
          </View>
          <View style={styles.areaKpi}>
            <Text style={[styles.areaKpiValue, styles.areaKpiAccent]}>
              {formatUsd(area.monthly_commission)}
            </Text>
            <Text style={styles.areaKpiLabel}>{t("dashboard.monthlyCommission")}</Text>
          </View>
        </View>
      ) : null}

      {isSales ? (
        <Text style={styles.conversionCaption}>{t("dashboard.salesConversionHint")}</Text>
      ) : null}

      <StackedBar slices={slices} />
      <BarList slices={slices} />
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.brown,
    marginBottom: 4,
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
});
