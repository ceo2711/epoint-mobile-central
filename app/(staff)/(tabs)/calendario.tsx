import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { CalendlyMonthCalendar } from "@/components/staff/CalendlyMonthCalendar";
import { SalesRepList } from "@/components/staff/SalesRepList";
import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { SedeBranchList } from "@/components/staff/SedeBranchList";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { useAdminSedeScope } from "@/hooks/useAdminSedeScope";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type {
  CalendlyConnection,
  CalendlyEvent,
  CalendlySyncResponse,
} from "@/types/api";
import { colors } from "@/theme/tokens";

export default function CalendarioScreen() {
  const { t, locale } = useTranslation();
  const { token, isLoading: authLoading } = useAuth();
  const scope = useAdminSedeScope({ loadReps: true });

  const [connection, setConnection] = useState<CalendlyConnection | null>(null);
  const [events, setEvents] = useState<CalendlyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const targetUserId = scope.isGlobal ? scope.selectedRepId : null;
  const detailEnabled =
    !scope.isGlobal || (scope.selectedSedeId != null && scope.selectedRepId != null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !detailEnabled) {
        setConnection(null);
        setEvents([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const userQs =
          targetUserId != null ? `?user_id=${targetUserId}` : "";
        const conn = await api.get<CalendlyConnection>(
          `/calendly/connection${userQs}`,
          token,
        );
        setConnection(conn);
        if (conn.connected) {
          const list = await api.get<CalendlyEvent[]>(
            `/calendly/events${userQs}`,
            token,
          );
          setEvents(list);
        } else {
          setEvents([]);
        }
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("calendar.loadError")));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, detailEnabled, targetUserId, t],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  async function onSync() {
    if (!token) return;
    setSyncing(true);
    setInfo(null);
    setError(null);
    try {
      const userQs =
        targetUserId != null ? `?user_id=${targetUserId}` : "";
      const result = await api.post<CalendlySyncResponse>(
        `/calendly/sync${userQs}`,
        {},
        token,
      );
      setInfo(t("calendar.syncedCount", { count: result.synced_count }));
      await load({ silent: true });
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo sincronizar Calendly"));
    } finally {
      setSyncing(false);
    }
  }

  if (authLoading || scope.loading) {
    return <ScreenState loading message={`${t("calendar.title")}…`} />;
  }

  if (scope.showSedePicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <Text style={styles.title}>{t("calendar.title")}</Text>
        <Text style={styles.subtitle}>{t("scope.adminSedesHint")}</Text>
        <SedeBranchList branches={scope.branches} onSelect={scope.selectSede} />
      </ScrollView>
    );
  }

  if (scope.isGlobal && scope.showRepPicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <ScopePageHeader
          title={t("calendar.title")}
          backLabel={t("scope.backToSedes")}
          onBack={scope.clearSede}
        />
        <Text style={styles.subtitle}>
          {scope.selectedSede
            ? t("scope.selectedSede", { name: scope.selectedSede.name })
            : t("calendly.salesRepsHint")}
        </Text>
        <SalesRepList
          reps={scope.repsForSelectedSede}
          onSelect={scope.selectRep}
          titleKey="calendly.salesRepsTitle"
          hintKey="calendly.salesRepsHint"
          showConnectionStatus
        />
      </ScrollView>
    );
  }

  if (loading && !connection && !error) {
    return <ScreenState loading message={`${t("calendar.title")}…`} />;
  }

  const selectedRepName = scope.selectedRep
    ? `${scope.selectedRep.first_name} ${scope.selectedRep.last_name}`.trim()
    : "";
  const ownerLabel = selectedRepName
    ? t("calendar.ofRep", { name: selectedRepName })
    : t("calendar.yours");
  const lastSyncedLabel = connection?.last_synced_at
    ? t("calendar.lastSynced", {
        datetime: new Date(connection.last_synced_at).toLocaleString(
          locale === "en" ? "en-US" : "es",
          {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          },
        ),
      })
    : t("calendar.neverSynced");

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.detailContent}
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
        title={t("calendar.title")}
        backLabel={scope.isGlobal ? t("scope.backToReps") : undefined}
        onBack={scope.isGlobal ? scope.clearRep : undefined}
      />

      <View style={styles.ownerBlock}>
        <Text style={styles.ownerName} numberOfLines={2}>
          {ownerLabel}
        </Text>
        {scope.selectedSede ? (
          <Text style={styles.meta}>
            {t("scope.selectedSede", { name: scope.selectedSede.name })}
          </Text>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      {!connection?.connected ? (
        <Card>
          <Text style={styles.body}>{t("calendar.notConnected")}</Text>
        </Card>
      ) : (
        <>
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel} numberOfLines={2}>
              {lastSyncedLabel}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t("calendar.sync")}
              activeOpacity={0.7}
              disabled={syncing}
              onPress={() => void onSync()}
              style={styles.syncBtn}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <Ionicons name="sync" size={20} color={colors.brand} />
              )}
            </TouchableOpacity>
          </View>
          <CalendlyMonthCalendar events={events} locale={locale} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  pickerContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 13,
    color: colors.soft,
  },
  ownerBlock: {
    gap: 2,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.brown,
  },
  meta: {
    fontSize: 13,
    color: colors.soft,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  syncLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.soft,
  },
  syncBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
  },
  info: {
    color: colors.brand,
    fontWeight: "600",
  },
});
