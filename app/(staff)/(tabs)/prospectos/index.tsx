import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { ScopeBackButton } from "@/components/staff/ScopeBackButton";
import { SedeBranchList } from "@/components/staff/SedeBranchList";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { useAdminSedeScope } from "@/hooks/useAdminSedeScope";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { Paginated, Prospect } from "@/types/api";
import { PROSPECT_STATUS_LABELS } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

export default function ProspectosScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { token, isLoading: authLoading } = useAuth();
  const scope = useAdminSedeScope({ loadReps: true });
  const [items, setItems] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listEnabled = !scope.isGlobal || scope.selectedSedeId != null;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !listEnabled) {
        setItems([]);
        setTotal(0);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: "1",
          page_size: "30",
        });
        if (query.trim()) params.set("search", query.trim());
        if (scope.isGlobal && scope.selectedSedeId != null) {
          params.set("sede_id", String(scope.selectedSedeId));
        }
        const data = await api.get<Paginated<Prospect>>(
          `/prospects?${params.toString()}`,
          token,
        );
        setItems(data.items);
        setTotal(data.total);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, "No se pudieron cargar los prospectos"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, query, listEnabled, scope.isGlobal, scope.selectedSedeId],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(handle);
  }, [search]);

  if (authLoading || scope.loading) {
    return <ScreenState loading message="Cargando prospectos…" />;
  }

  if (scope.showSedePicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <Text style={styles.title}>Prospectos</Text>
        <Text style={styles.subtitle}>{t("scope.adminSedesHint")}</Text>
        <SedeBranchList branches={scope.branches} onSelect={scope.selectSede} />
      </ScrollView>
    );
  }

  if (loading && items.length === 0 && !error) {
    return <ScreenState loading message="Cargando prospectos…" />;
  }

  return (
    <View style={styles.wrap}>
      {scope.isGlobal ? (
        <ScopeBackButton label={t("scope.backToSedes")} onPress={scope.clearSede} />
      ) : null}
      <Text style={styles.title}>Prospectos</Text>
      <Text style={styles.subtitle}>
        {total} en total
        {scope.selectedSede ? ` · ${scope.selectedSede.name}` : ""}
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nombre o email"
        placeholderTextColor={colors.brownMuted}
        style={styles.search}
      />

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
          !loading ? (
            <Text style={styles.empty}>No hay prospectos para mostrar.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(`/(staff)/(tabs)/prospectos/${item.id}` as never)
            }
          >
            <Card style={styles.item}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.full_name}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {PROSPECT_STATUS_LABELS[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>{item.email}</Text>
              {item.phone ? <Text style={styles.meta}>{item.phone}</Text> : null}
            </Card>
          </Pressable>
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
  pickerContent: {
    paddingBottom: 32,
    gap: 12,
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
  search: {
    minHeight: 44,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    marginBottom: 12,
    color: colors.ink,
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
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand,
  },
  meta: {
    fontSize: 13,
    color: colors.soft,
    marginTop: 4,
  },
  empty: {
    textAlign: "center",
    color: colors.soft,
    marginTop: 24,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
});
