import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { useTranslation } from "@/contexts/LanguageContext";
import { formatUsd } from "@/features/dashboard/AreaMetricsCard";
import type { SalesLeadershipMetrics } from "@/types/api";
import { colors, radii, spacing } from "@/theme/tokens";

const WEEKDAY_KEYS = [
  "dashboard.weekday.mon",
  "dashboard.weekday.tue",
  "dashboard.weekday.wed",
  "dashboard.weekday.thu",
  "dashboard.weekday.fri",
  "dashboard.weekday.sat",
  "dashboard.weekday.sun",
] as const;

export function SalesLeadershipCard({
  leadership,
}: {
  leadership: SalesLeadershipMetrics;
}) {
  const { t } = useTranslation();
  const bestLabel =
    leadership.best_weekday != null
      ? t(WEEKDAY_KEYS[leadership.best_weekday])
      : t("common.dash");
  const maxPaid = Math.max(
    1,
    ...leadership.weekday_sales.map((point) => point.paid_count),
  );

  return (
    <Card>
      <Text style={styles.sectionTitle}>{t("dashboard.leadershipTitle")}</Text>
      <Text style={styles.subtitle}>{t("dashboard.leadershipSubtitle")}</Text>

      <View style={styles.kpis}>
        <View style={styles.kpi}>
          <Text style={styles.kpiValue}>{leadership.active_sales_reps}</Text>
          <Text style={styles.kpiLabel}>{t("dashboard.leadershipActiveReps")}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiValue}>{leadership.team_monthly_paid_count}</Text>
          <Text style={styles.kpiLabel}>{t("dashboard.leadershipTeamSales")}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={[styles.kpiValue, styles.kpiAccent]}>
            {formatUsd(leadership.team_monthly_commission)}
          </Text>
          <Text style={styles.kpiLabel}>{t("dashboard.leadershipTeamCommission")}</Text>
        </View>
      </View>

      <Text style={styles.blockTitle}>{t("dashboard.leadershipWeekdayTitle")}</Text>
      <Text style={styles.hint}>
        {leadership.best_weekday != null && leadership.best_weekday_paid_count > 0
          ? t("dashboard.leadershipWeekdayHint", {
              day: bestLabel,
              count: leadership.best_weekday_paid_count,
              amount: formatUsd(leadership.best_weekday_paid_amount),
            })
          : t("dashboard.leadershipWeekdayEmpty")}
      </Text>
      <View style={styles.weekdayRow}>
        {leadership.weekday_sales.map((point) => {
          const isBest =
            point.weekday === leadership.best_weekday &&
            leadership.best_weekday_paid_count > 0;
          const height = Math.max(6, (point.paid_count / maxPaid) * 72);
          return (
            <View key={point.weekday} style={styles.weekdayCol}>
              <Text style={styles.weekdayCount}>{point.paid_count}</Text>
              <View style={styles.weekdayTrack}>
                <View
                  style={[
                    styles.weekdayBar,
                    {
                      height,
                      backgroundColor: isBest ? colors.brand : colors.gold,
                    },
                  ]}
                />
              </View>
              <Text style={styles.weekdayLabel}>
                {WEEKDAY_KEYS[point.weekday] ? t(WEEKDAY_KEYS[point.weekday]) : String(point.weekday)}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.blockTitle}>{t("dashboard.leadershipLeaderboardTitle")}</Text>
      <Text style={styles.hint}>{t("dashboard.leadershipLeaderboardHint")}</Text>
      {leadership.leaderboard.length === 0 ? (
        <Text style={styles.empty}>{t("dashboard.leadershipLeaderboardEmpty")}</Text>
      ) : (
        leadership.leaderboard.map((row, index) => (
          <View key={row.user_id} style={styles.rankRow}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankIndex}>{index + 1}</Text>
            </View>
            <View style={styles.rankMeta}>
              <Text style={styles.rankName} numberOfLines={1}>
                {row.first_name} {row.last_name}
              </Text>
              <Text style={styles.rankSales}>
                {t("dashboard.leadershipLeaderboardSales", { count: row.paid_count })}
              </Text>
            </View>
            <View style={styles.rankAmounts}>
              <Text style={styles.rankCommission}>{formatUsd(row.commission)}</Text>
              <Text style={styles.rankPaid}>{formatUsd(row.paid_amount)}</Text>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 13,
    color: colors.soft,
    marginBottom: 8,
  },
  kpis: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  kpi: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 2,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.brown,
  },
  kpiAccent: {
    color: colors.brand,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.soft,
  },
  blockTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brown,
    marginTop: 8,
  },
  hint: {
    fontSize: 12,
    color: colors.soft,
    marginBottom: 8,
  },
  weekdayRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginBottom: 8,
    minHeight: 108,
  },
  weekdayCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  weekdayCount: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brown,
  },
  weekdayTrack: {
    height: 72,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  weekdayBar: {
    width: "70%",
    borderRadius: 6,
    minHeight: 6,
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.soft,
  },
  empty: {
    fontSize: 13,
    color: colors.soft,
    textAlign: "center",
    paddingVertical: 16,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.creamWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  rankIndex: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brown,
  },
  rankMeta: {
    flex: 1,
    minWidth: 0,
  },
  rankName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  rankSales: {
    fontSize: 11,
    color: colors.soft,
  },
  rankAmounts: {
    alignItems: "flex-end",
  },
  rankCommission: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brand,
  },
  rankPaid: {
    fontSize: 11,
    color: colors.soft,
  },
});
