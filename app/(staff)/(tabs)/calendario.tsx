import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CalendlyMonthCalendar } from "@/components/staff/CalendlyMonthCalendar";
import { SalesRepList } from "@/components/staff/SalesRepList";
import { ScopeBackButton } from "@/components/staff/ScopeBackButton";
import { SedeBranchList } from "@/components/staff/SedeBranchList";
import { Button } from "@/components/ui/Button";
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
      setInfo(
        locale === "en"
          ? `Synced ${result.synced_count} events`
          : `Sincronizados ${result.synced_count} eventos`,
      );
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
        <ScopeBackButton label={t("scope.backToSedes")} onPress={scope.clearSede} />
        <Text style={styles.title}>{t("calendar.title")}</Text>
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

  const repName = scope.selectedRep
    ? `${scope.selectedRep.first_name} ${scope.selectedRep.last_name}`.trim()
    : null;

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
      {scope.isGlobal ? (
        <ScopeBackButton label={t("scope.backToReps")} onPress={scope.clearRep} />
      ) : null}
      <Text style={styles.title}>{t("calendar.title")}</Text>
      {repName || scope.selectedSede ? (
        <Text style={styles.subtitle}>
          {[scope.selectedSede?.name, repName].filter(Boolean).join(" · ")}
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      {!connection?.connected ? (
        <Card>
          <Text style={styles.body}>{t("calendar.notConnected")}</Text>
        </Card>
      ) : (
        <>
          <Text style={styles.subtitle}>
            {connection.calendly_user_name ?? t("calendly.connected")}
            {connection.last_synced_at
              ? ` · ${new Date(connection.last_synced_at).toLocaleString(
                  locale === "en" ? "en-US" : "es",
                )}`
              : ""}
          </Text>
          <Button
            title={t("calendar.sync")}
            fullWidth
            loading={syncing}
            onPress={() => void onSync()}
          />
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
    fontSize: 28,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 13,
    color: colors.soft,
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
