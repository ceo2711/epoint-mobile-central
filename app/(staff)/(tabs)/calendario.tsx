import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type {
  CalendlyConnection,
  CalendlyEvent,
  CalendlySyncResponse,
} from "@/types/api";
import { colors, radii } from "@/theme/tokens";

export default function CalendarioScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const [connection, setConnection] = useState<CalendlyConnection | null>(null);
  const [events, setEvents] = useState<CalendlyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const conn = await api.get<CalendlyConnection>("/calendly/connection", token);
        setConnection(conn);
        if (conn.connected) {
          const list = await api.get<CalendlyEvent[]>("/calendly/events", token);
          const upcoming = list
            .filter((e) => new Date(e.start_time).getTime() >= Date.now() - 60_000)
            .sort(
              (a, b) =>
                new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
            );
          setEvents(upcoming);
        } else {
          setEvents([]);
        }
      } catch (err) {
        setError(getUserFacingErrorMessage(err, "No se pudo cargar el calendario"));
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

  async function onSync() {
    if (!token) return;
    setSyncing(true);
    setInfo(null);
    setError(null);
    try {
      const result = await api.post<CalendlySyncResponse>("/calendly/sync", {}, token);
      setInfo(`Sincronizados ${result.synced_count} eventos`);
      await load({ silent: true });
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo sincronizar Calendly"));
    } finally {
      setSyncing(false);
    }
  }

  if (authLoading || (loading && !connection && !error)) {
    return <ScreenState loading message="Cargando calendario…" />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Calendario</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      {!connection?.connected ? (
        <Card>
          <Text style={styles.body}>
            No hay una cuenta de Calendly conectada. Vinculá Calendly desde la versión
            web para ver eventos aquí.
          </Text>
        </Card>
      ) : (
        <>
          <Text style={styles.subtitle}>
            {connection.calendly_user_name ?? "Conectado"}
            {connection.last_synced_at
              ? ` · Última sync ${new Date(connection.last_synced_at).toLocaleString("es")}`
              : ""}
          </Text>
          <Button
            title="Sincronizar"
            fullWidth
            loading={syncing}
            onPress={() => void onSync()}
          />
          <FlatList
            data={events}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
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
            ListEmptyComponent={
              <Text style={styles.empty}>No hay eventos próximos.</Text>
            }
            renderItem={({ item }) => (
              <Card style={styles.item}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {new Date(item.start_time).toLocaleString("es")}
                </Text>
                {item.invitee_name ? (
                  <Text style={styles.meta}>
                    {item.invitee_name}
                    {item.invitee_email ? ` · ${item.invitee_email}` : ""}
                  </Text>
                ) : null}
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.status}</Text>
                </View>
              </Card>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 16,
    paddingTop: 12,
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
  list: {
    gap: 10,
    paddingBottom: 24,
    paddingTop: 8,
  },
  item: {
    backgroundColor: colors.white,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  meta: {
    fontSize: 13,
    color: colors.soft,
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: colors.brandLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.brand,
  },
  empty: {
    textAlign: "center",
    color: colors.soft,
    marginTop: 40,
  },
  error: {
    color: colors.danger,
  },
  info: {
    color: colors.brand,
    fontWeight: "600",
  },
});
