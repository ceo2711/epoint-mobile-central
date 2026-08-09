import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState } from "@/components/ui/EmptyState";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useTranslation } from "@/contexts/LanguageContext";
import type { CalendlySalesRep } from "@/types/api";
import { colors, spacing } from "@/theme/tokens";

type SalesRepListProps = {
  reps: CalendlySalesRep[];
  onSelect: (id: number) => void;
  titleKey?: string;
  hintKey?: string;
  emptyKey?: string;
  showConnectionStatus?: boolean;
};

type SalesRepTeam = {
  lead: CalendlySalesRep;
  subSellers: CalendlySalesRep[];
};

function repSortKey(rep: CalendlySalesRep): string {
  return `${rep.first_name} ${rep.last_name} ${rep.email}`.toLowerCase();
}

function groupSalesReps(reps: CalendlySalesRep[]): {
  teams: SalesRepTeam[];
  orphanSubs: CalendlySalesRep[];
} {
  const byId = new Map(reps.map((rep) => [rep.id, rep]));
  const subsByParent = new Map<number, CalendlySalesRep[]>();
  const orphanSubs: CalendlySalesRep[] = [];

  for (const rep of reps) {
    if (rep.parent_user_id == null) continue;
    if (!byId.has(rep.parent_user_id)) {
      orphanSubs.push(rep);
      continue;
    }
    const list = subsByParent.get(rep.parent_user_id) ?? [];
    list.push(rep);
    subsByParent.set(rep.parent_user_id, list);
  }

  for (const list of subsByParent.values()) {
    list.sort((a, b) => repSortKey(a).localeCompare(repSortKey(b)));
  }
  orphanSubs.sort((a, b) => repSortKey(a).localeCompare(repSortKey(b)));

  const teams: SalesRepTeam[] = reps
    .filter((rep) => rep.parent_user_id == null)
    .sort((a, b) => repSortKey(a).localeCompare(repSortKey(b)))
    .map((lead) => ({
      lead,
      subSellers: subsByParent.get(lead.id) ?? [],
    }));

  return { teams, orphanSubs };
}

function LeadCard({
  rep,
  onSelect,
  showConnectionStatus,
}: {
  rep: CalendlySalesRep;
  onSelect: (id: number) => void;
  showConnectionStatus: boolean;
}) {
  const { t } = useTranslation();
  const inactive = rep.is_active === false;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(rep.id)}
      style={({ pressed }) => [
        styles.leadCard,
        inactive && styles.leadCardInactive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.leadTop}>
        <UserAvatar
          firstName={rep.first_name}
          lastName={rep.last_name}
          avatarUrl={rep.avatar_url}
          size={48}
        />
        <Ionicons
          name="chevron-forward"
          size={18}
          color={inactive ? "#d4a574" : colors.brownMuted}
        />
      </View>

      <Text style={styles.leadName} numberOfLines={1}>
        {rep.first_name} {rep.last_name}
      </Text>
      <Text style={styles.leadEmail} numberOfLines={1}>
        {rep.email}
      </Text>

      {inactive ? (
        <View style={styles.badgeInactive}>
          <Text style={styles.badgeInactiveText}>{t("common.inactive")}</Text>
        </View>
      ) : null}

      {showConnectionStatus ? (
        <View
          style={[
            styles.connBadge,
            rep.connected ? styles.connOn : styles.connOff,
          ]}
        >
          <Text
            style={[
              styles.connBadgeText,
              rep.connected ? styles.connOnText : styles.connOffText,
            ]}
          >
            {rep.connected ? t("calendly.connected") : t("calendly.notConnected")}
          </Text>
        </View>
      ) : (
        <Text style={styles.viewHint}>{t("common.go")}</Text>
      )}
    </Pressable>
  );
}

function SubCard({
  rep,
  onSelect,
  showConnectionStatus,
}: {
  rep: CalendlySalesRep;
  onSelect: (id: number) => void;
  showConnectionStatus: boolean;
}) {
  const { t } = useTranslation();
  const inactive = rep.is_active === false;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(rep.id)}
      style={({ pressed }) => [
        styles.subCard,
        inactive && styles.subCardInactive,
        pressed && styles.pressed,
      ]}
    >
      <UserAvatar
        firstName={rep.first_name}
        lastName={rep.last_name}
        avatarUrl={rep.avatar_url}
        size={32}
      />
      <View style={styles.subText}>
        <Text style={styles.subName} numberOfLines={1}>
          {rep.first_name} {rep.last_name}
        </Text>
        <View style={styles.subBadges}>
          <View style={[styles.subBadge, inactive && styles.subBadgeInactive]}>
            <Text
              style={[
                styles.subBadgeText,
                inactive && styles.subBadgeInactiveText,
              ]}
            >
              {t("calendly.subSellerBadge")}
            </Text>
          </View>
          {inactive ? (
            <View style={styles.badgeInactive}>
              <Text style={styles.badgeInactiveText}>{t("common.inactive")}</Text>
            </View>
          ) : null}
        </View>
        {showConnectionStatus ? (
          <Text
            style={[
              styles.subConn,
              rep.connected ? styles.connOnText : styles.connOffText,
            ]}
            numberOfLines={1}
          >
            {rep.connected ? t("calendly.connected") : t("calendly.notConnected")}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={inactive ? "#d4a574" : colors.brownMuted}
      />
    </Pressable>
  );
}

export function SalesRepList({
  reps,
  onSelect,
  titleKey = "scope.adminRepsTitle",
  hintKey = "scope.adminRepsHint",
  emptyKey = "scope.adminRepsEmpty",
  showConnectionStatus = true,
}: SalesRepListProps) {
  const { t } = useTranslation();
  const { teams, orphanSubs } = useMemo(() => groupSalesReps(reps), [reps]);

  if (reps.length === 0) {
    return <EmptyState title={t(emptyKey)} />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{t(titleKey)}</Text>
      <Text style={styles.hint}>{t(hintKey)}</Text>

      <View style={styles.teams}>
        {teams.map(({ lead, subSellers }) => {
          const leadName = `${lead.first_name} ${lead.last_name}`.trim();
          return (
            <View key={lead.id} style={styles.teamBox}>
              <LeadCard
                rep={lead}
                onSelect={onSelect}
                showConnectionStatus={showConnectionStatus}
              />

              {subSellers.length > 0 ? (
                <View style={styles.subsBlock}>
                  <Text style={styles.subsLabel}>
                    {t("calendly.teamOf", {
                      name: leadName,
                      count: subSellers.length,
                    })}
                  </Text>
                  <View style={styles.subsList}>
                    {subSellers.map((sub) => (
                      <SubCard
                        key={sub.id}
                        rep={sub}
                        onSelect={onSelect}
                        showConnectionStatus={showConnectionStatus}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.noSubsBox}>
                  <Text style={styles.noSubsText}>{t("calendly.noSubSellers")}</Text>
                </View>
              )}
            </View>
          );
        })}

        {orphanSubs.length > 0 ? (
          <View style={styles.teamBox}>
            <Text style={styles.subsLabel}>{t("calendly.orphanSubSellers")}</Text>
            <View style={styles.subsList}>
              {orphanSubs.map((sub) => (
                <SubCard
                  key={sub.id}
                  rep={sub}
                  onSelect={onSelect}
                  showConnectionStatus={showConnectionStatus}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  heading: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.soft,
  },
  hint: {
    fontSize: 14,
    color: colors.soft,
    marginTop: -4,
  },
  teams: {
    gap: spacing.md,
  },
  teamBox: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.goldMuted,
    backgroundColor: "#f7f4ef",
    padding: spacing.md,
    gap: spacing.md,
  },
  leadCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#cfc7bc",
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: "#5c4033",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  leadCardInactive: {
    borderColor: "#e8c48a",
    backgroundColor: "#fffaf0",
  },
  pressed: {
    opacity: 0.94,
  },
  leadTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  leadName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  leadEmail: {
    fontSize: 13,
    color: colors.soft,
  },
  viewHint: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: "600",
    color: colors.brand,
  },
  connBadge: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  connOn: {
    backgroundColor: "#d1fae5",
  },
  connOff: {
    backgroundColor: "#eceae6",
  },
  connBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  connOnText: {
    color: "#047857",
  },
  connOffText: {
    color: colors.soft,
  },
  badgeInactive: {
    alignSelf: "flex-start",
    backgroundColor: "#fde68a",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeInactiveText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400e",
    textTransform: "uppercase",
  },
  subsBlock: {
    gap: spacing.sm,
  },
  subsLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.brownMuted,
  },
  subsList: {
    gap: spacing.sm,
  },
  subCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "#f3f1ed",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd6cc",
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  subCardInactive: {
    backgroundColor: "#fff7ed",
    borderColor: "#f5d0a9",
    borderLeftColor: "#f59e0b",
  },
  subText: {
    flex: 1,
    gap: 3,
  },
  subName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  subBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  subBadge: {
    backgroundColor: colors.brandLight,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  subBadgeInactive: {
    backgroundColor: "#fde68a",
  },
  subBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.brand,
    textTransform: "uppercase",
  },
  subBadgeInactiveText: {
    color: "#92400e",
  },
  subConn: {
    fontSize: 11,
    fontWeight: "600",
  },
  noSubsBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.goldMuted,
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  noSubsText: {
    fontSize: 12,
    color: colors.soft,
  },
});
