import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { Paginated, User } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

export default function UsuariosScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const data = await api.get<Paginated<User>>(
          "/users?page=1&page_size=50",
          token,
        );
        setItems(data.items);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, "No se pudieron cargar los usuarios"));
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

  if (authLoading || (loading && items.length === 0 && !error)) {
    return <ScreenState loading message="Cargando usuarios…" />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Usuarios</Text>
      <Text style={styles.subtitle}>{items.length} usuarios</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

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
          !loading ? <Text style={styles.empty}>No hay usuarios.</Text> : null
        }
        renderItem={({ item }) => (
          <Card style={styles.item}>
            <View style={styles.row}>
              <Text style={styles.name}>
                {item.first_name} {item.last_name}
              </Text>
              <View style={[styles.badge, !item.is_active && styles.badgeInactive]}>
                <Text
                  style={[
                    styles.badgeText,
                    !item.is_active && styles.badgeTextInactive,
                  ]}
                >
                  {item.is_active ? "Activo" : "Inactivo"}
                </Text>
              </View>
            </View>
            <Text style={styles.meta}>{item.email}</Text>
            <Text style={styles.role}>{item.role.name}</Text>
          </Card>
        )}
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
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 13,
    color: colors.soft,
    marginBottom: 10,
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  item: {
    backgroundColor: colors.white,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  badge: {
    backgroundColor: colors.brandLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  badgeInactive: {
    backgroundColor: colors.creamWarm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.brand,
  },
  badgeTextInactive: {
    color: colors.soft,
  },
  meta: {
    fontSize: 13,
    color: colors.soft,
  },
  role: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brownSoft,
  },
  empty: {
    textAlign: "center",
    color: colors.soft,
    marginTop: 40,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
});
