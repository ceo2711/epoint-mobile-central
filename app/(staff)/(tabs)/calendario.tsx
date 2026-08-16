import { useCallback, useEffect, useRef, useState } from "react";
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
import { SalesToolsScopeToggle } from "@/components/staff/SalesToolsScopeToggle";
import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { SedeBranchList } from "@/components/staff/SedeBranchList";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { CalendlyConnectPanel } from "@/features/calendly/CalendlyConnectPanel";
import { CalendlySettingsModal } from "@/features/calendly/CalendlySettingsModal";
import { CalendlyShareLinks } from "@/features/calendly/CalendlyShareLinks";
import { useAdminSedeScope } from "@/hooks/useAdminSedeScope";
import { useSalesToolsScope } from "@/hooks/useSalesToolsScope";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type {
  CalendlyConnection,
  CalendlyEvent,
  CalendlyEventType,
  CalendlySyncResponse,
} from "@/types/api";
import { colors } from "@/theme/tokens";

export default function CalendarioScreen() {
  const { t, locale } = useTranslation();
  const { token, isLoading: authLoading } = useAuth();
  const tools = useSalesToolsScope();
  const scope = useAdminSedeScope({
    loadReps: tools.viewingTeam,
    pickRep: tools.viewingTeam,
  });

  const [connection, setConnection] = useState<CalendlyConnection | null>(null);
  const [events, setEvents] = useState<CalendlyEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<CalendlyEventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  const [eventTypesLoading, setEventTypesLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const monthRequestId = useRef(0);

  const canConfigure = tools.viewingOwn;

  const targetUserId = scope.needsRepPicker ? scope.selectedRepId : null;
  const detailEnabled = !scope.needsRepPicker || scope.selectedRepId != null;
  const sedeName = scope.selectedSede?.name ?? scope.ownSede?.name ?? null;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !detailEnabled) {
        setConnection(null);
        setEvents([]);
        setLoading(Boolean(token && !detailEnabled));
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
          if (canConfigure) {
            setEventTypesLoading(true);
            try {
              const types = await api.get<CalendlyEventType[]>(
                `/calendly/event-types${userQs}`,
                token,
              );
              setEventTypes(types);
            } catch {
              setEventTypes([]);
            } finally {
              setEventTypesLoading(false);
            }
          } else {
            setEventTypes([]);
          }
        } else {
          setEvents([]);
          setEventTypes([]);
        }
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("calendar.loadError")));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, detailEnabled, targetUserId, t, canConfigure],
  );

  const loadMonthEvents = useCallback(
    async (range: { start: string; end: string }) => {
      if (!token || !detailEnabled) return;
      const requestId = ++monthRequestId.current;
      setMonthLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          start: range.start,
          end: range.end,
        });
        if (targetUserId != null) params.set("user_id", String(targetUserId));
        const list = await api.get<CalendlyEvent[]>(
          `/calendly/events?${params.toString()}`,
          token,
        );
        if (requestId !== monthRequestId.current) return;
        setEvents(list);
      } catch (err) {
        if (requestId !== monthRequestId.current) return;
        setError(getUserFacingErrorMessage(err, t("calendar.loadError")));
      } finally {
        if (requestId === monthRequestId.current) setMonthLoading(false);
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

  async function onConnect(accessToken: string, schedulingUrl?: string) {
    if (!token) return;
    setError(null);
    setInfo(null);
    const conn = await api.post<CalendlyConnection>(
      "/calendly/connection",
      {
        access_token: accessToken,
        scheduling_url: schedulingUrl || undefined,
      },
      token,
    );
    setConnection(conn);
    setSettingsOpen(false);
    await load({ silent: true });
  }

  async function onDisconnect() {
    if (!token) return;
    setDisconnecting(true);
    setError(null);
    try {
      await api.delete("/calendly/connection", token);
      setSettingsOpen(false);
      setConnection({
        connected: false,
        user_id: null,
        calendly_user_name: null,
        scheduling_url: null,
        last_synced_at: null,
      });
      setEvents([]);
      setEventTypes([]);
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("calendly.connectError")));
    } finally {
      setDisconnecting(false);
    }
  }

  if (authLoading || scope.loading) {
    return <ScreenState loading message={`${t("calendar.title")}…`} />;
  }

  if (scope.showSedePicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <Text style={styles.title}>{t("calendar.title")}</Text>
        {tools.showToggle ? (
          <SalesToolsScopeToggle
            value={tools.scope}
            onChange={(next) => {
              tools.setScope(next);
              scope.clearRep();
              scope.clearSede();
            }}
          />
        ) : null}
        <Text style={styles.subtitle}>{t("scope.adminSedesHint")}</Text>
        <SedeBranchList branches={scope.branches} onSelect={scope.selectSede} />
      </ScrollView>
    );
  }

  if (scope.showRepPicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <ScopePageHeader
          title={t("calendar.title")}
          backLabel={scope.isGlobal ? t("scope.backToSedes") : undefined}
          onBack={scope.isGlobal ? scope.clearSede : undefined}
        />
        {tools.showToggle ? (
          <SalesToolsScopeToggle
            value={tools.scope}
            onChange={(next) => {
              tools.setScope(next);
              scope.clearRep();
            }}
          />
        ) : null}
        <Text style={styles.subtitle}>
          {sedeName
            ? t("scope.selectedSede", { name: sedeName })
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
      keyboardShouldPersistTaps="handled"
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
        backLabel={scope.needsRepPicker ? t("scope.backToReps") : undefined}
        onBack={scope.needsRepPicker ? scope.clearRep : undefined}
      />
      {tools.showToggle ? (
        <SalesToolsScopeToggle
          value={tools.scope}
          onChange={(next) => {
            tools.setScope(next);
            scope.clearRep();
          }}
        />
      ) : null}

      <View style={styles.ownerBlock}>
        <Text style={styles.ownerName} numberOfLines={2}>
          {ownerLabel}
        </Text>
        {sedeName ? (
          <Text style={styles.meta}>
            {t("scope.selectedSede", { name: sedeName })}
          </Text>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      {!connection?.connected ? (
        canConfigure ? (
          <CalendlyConnectPanel onConnect={onConnect} />
        ) : (
          <Card>
            <Text style={styles.body}>{t("calendly.adminNotConnected")}</Text>
          </Card>
        )
      ) : (
        <>
          <View style={styles.syncRow}>
            <Text style={styles.syncLabel} numberOfLines={2}>
              {lastSyncedLabel}
            </Text>
            {canConfigure ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("calendly.settingsTitle")}
                activeOpacity={0.7}
                onPress={() => setSettingsOpen(true)}
                style={styles.syncBtn}
              >
                <Ionicons name="settings-outline" size={20} color={colors.brand} />
              </TouchableOpacity>
            ) : null}
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
          <CalendlyMonthCalendar
            events={events}
            locale={locale}
            loadingMonth={monthLoading}
            onMonthChange={(range) => void loadMonthEvents(range)}
          />
          {canConfigure ? (
            <CalendlyShareLinks eventTypes={eventTypes} loading={eventTypesLoading} />
          ) : null}
        </>
      )}

      {canConfigure && settingsOpen ? (
        <CalendlySettingsModal
          visible
          schedulingUrl={connection?.scheduling_url}
          disconnecting={disconnecting}
          onClose={() => setSettingsOpen(false)}
          onUpdateToken={onConnect}
          onDisconnect={onDisconnect}
        />
      ) : null}
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
