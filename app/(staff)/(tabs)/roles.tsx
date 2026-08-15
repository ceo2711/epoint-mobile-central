import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { Paginated, Role } from "@/types/api";
import { colors, radii, spacing } from "@/theme/tokens";

function unwrapList<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.items;
}

export default function RolesScreen() {
  const { t } = useTranslation();
  const { token, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const data = await api.get<Role[] | Paginated<Role>>("/roles", token);
        setItems(unwrapList(data));
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("catalog.loadError")));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, t],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  function toggleExpanded(roleId: number) {
    setExpanded((prev) => ({ ...prev, [roleId]: !prev[roleId] }));
  }

  if (authLoading || (loading && items.length === 0 && !error)) {
    return <ScreenState loading message={t("common.loading")} />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("catalog.rolesTitle")}</Text>
      <Text style={styles.subtitle}>
        {t("catalog.count", { count: items.length })}
      </Text>

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
          !loading ? <Text style={styles.empty}>{t("catalog.empty")}</Text> : null
        }
        renderItem={({ item }) => {
          const perms = item.permissions ?? [];
          const isOpen = Boolean(expanded[item.id]);
          return (
            <Card style={styles.item}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={[styles.badge, !item.is_active && styles.badgeInactive]}>
                  <Text
                    style={[
                      styles.badgeText,
                      !item.is_active && styles.badgeTextInactive,
                    ]}
                  >
                    {item.is_active ? t("catalog.active") : t("catalog.inactive")}
                  </Text>
                </View>
              </View>
              <Text style={styles.code}>{item.code}</Text>
              {item.description ? (
                <Text style={styles.meta}>{item.description}</Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={() => toggleExpanded(item.id)}
                style={styles.permToggle}
              >
                <Text style={styles.permToggleText}>
                  {isOpen
                    ? t("catalog.hidePermissions")
                    : `${t("catalog.showPermissions")} (${perms.length})`}
                </Text>
              </Pressable>

              {isOpen ? (
                perms.length === 0 ? (
                  <Text style={styles.meta}>{t("catalog.noPermissions")}</Text>
                ) : (
                  <View style={styles.chips}>
                    {perms.map((perm) => (
                      <View key={perm.id} style={styles.chip}>
                        <Text style={styles.chipText}>{perm.code}</Text>
                      </View>
                    ))}
                  </View>
                )
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: 22,
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
  code: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.gold,
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
  permToggle: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 4,
  },
  permToggleText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  chip: {
    backgroundColor: colors.brandLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipText: {
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
    marginBottom: 8,
  },
});
