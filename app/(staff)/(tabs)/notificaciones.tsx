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
import type { Notification, Paginated } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

export default function NotificacionesScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const data = await api.get<Paginated<Notification>>(
          "/notifications?page=1&page_size=40",
          token,
        );
        setItems(data.items);
      } catch (err) {
        setError(
          getUserFacingErrorMessage(err, "No se pudieron cargar las notificaciones"),
        );
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

  const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);

  async function markRead(ids: number[]) {
    if (!token || ids.length === 0) return;
    setActing(true);
    setError(null);
    try {
      await api.post("/notifications/mark-read", { notification_ids: ids }, token);
      await load({ silent: true });
    } catch (err) {
      setError(
        getUserFacingErrorMessage(err, "No se pudieron marcar como leídas"),
      );
    } finally {
      setActing(false);
    }
  }

  if (authLoading || (loading && items.length === 0 && !error)) {
    return <ScreenState loading message="Cargando notificaciones…" />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Notificaciones</Text>
      <Text style={styles.subtitle}>
        {unreadIds.length} sin leer · {items.length} recientes
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {unreadIds.length > 0 ? (
        <Button
          title="Marcar todas como leídas"
          variant="secondary"
          fullWidth
          loading={acting}
          onPress={() => void markRead(unreadIds)}
        />
      ) : null}

      <FlatList
        data={items}
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
          !loading ? (
            <Text style={styles.empty}>No hay notificaciones.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const unread = !item.read_at;
          return (
            <Card style={[styles.item, unread && styles.itemUnread]}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.title}</Text>
                {unread ? (
                  <View style={styles.dot}>
                    <Text style={styles.dotText}>Nueva</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.meta}>
                {new Date(item.created_at).toLocaleString("es")}
              </Text>
              {unread ? (
                <Button
                  title="Marcar leída"
                  variant="ghost"
                  onPress={() => void markRead([item.id])}
                />
              ) : null}
            </Card>
          );
        }}
      />
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
  list: {
    gap: 10,
    paddingBottom: 24,
    paddingTop: 4,
  },
  item: {
    backgroundColor: colors.white,
  },
  itemUnread: {
    borderColor: colors.brandMuted,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  body: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    color: colors.soft,
  },
  dot: {
    backgroundColor: colors.brandLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  dotText: {
    fontSize: 11,
    fontWeight: "700",
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
});
