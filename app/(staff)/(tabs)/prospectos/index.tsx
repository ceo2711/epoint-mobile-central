import { useCallback, useEffect, useMemo, useState } from "react";
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

import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { SedeBranchList } from "@/components/staff/SedeBranchList";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { ProspectCreateModal } from "@/features/prospects/ProspectCreateModal";
import { useAdminSedeScope } from "@/hooks/useAdminSedeScope";
import { canSell, isSalesAreaLeader } from "@/lib/roles";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { CalendlySalesRep, Paginated, Prospect } from "@/types/api";
import { PROSPECT_STATUS_LABELS } from "@/types/api";
import { colors, radii, spacing } from "@/theme/tokens";

function salesRepName(rep: CalendlySalesRep): string {
  return `${rep.first_name} ${rep.last_name}`.trim() || rep.email;
}

function isSubSeller(rep: CalendlySalesRep): boolean {
  return rep.parent_user_id != null;
}

function salesRepChipLabel(
  rep: CalendlySalesRep,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const name = salesRepName(rep);
  if (rep.parent_name) {
    return `${name} (${t("calendly.subSellerOf", { name: rep.parent_name })})`;
  }
  if (rep.is_active === false) {
    return `${name} (${t("catalog.inactive")})`;
  }
  return name;
}

function prospectSellerLabel(
  item: Prospect,
  salesReps: CalendlySalesRep[],
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const person = item.assigned_to;
  if (!person) return "—";
  const name =
    `${person.first_name} ${person.last_name}`.trim() || person.email || "—";
  const rep = salesReps.find((row) => row.id === item.assigned_to_user_id);
  if (rep?.parent_name) {
    return `${name} (${t("calendly.subSellerOf", { name: rep.parent_name })})`;
  }
  return name;
}

export default function ProspectosScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { token, user, hasPermission, isLoading: authLoading } = useAuth();
  const scope = useAdminSedeScope({ loadReps: true });
  const [items, setItems] = useState<Prospect[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [salesRepId, setSalesRepId] = useState<number | null>(null);

  const canCreate = canSell(user) && hasPermission("prospects:create");
  const showSalesRepFilter = isSalesAreaLeader(user);
  const salesReps = scope.isGlobal ? scope.repsForSelectedSede : scope.salesReps;
  const titularReps = useMemo(
    () => salesReps.filter((rep) => !isSubSeller(rep)),
    [salesReps],
  );
  const subSellerReps = useMemo(
    () => salesReps.filter(isSubSeller),
    [salesReps],
  );

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
        if (showSalesRepFilter && salesRepId != null) {
          params.set("sales_rep_id", String(salesRepId));
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
    [token, query, listEnabled, scope.isGlobal, scope.selectedSedeId, showSalesRepFilter, salesRepId],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setSalesRepId(null);
  }, [scope.selectedSedeId]);

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
      <ScopePageHeader
        title="Prospectos"
        backLabel={scope.isGlobal ? t("scope.backToSedes") : undefined}
        onBack={scope.isGlobal ? scope.clearSede : undefined}
      />
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

      {showSalesRepFilter ? (
        <View style={styles.filtersBlock}>
          <Text style={styles.filterSectionLabel}>
            {t("calendly.salesRepsTitle")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <FilterChip
              label={t("scope.allReps")}
              active={salesRepId == null}
              onPress={() => setSalesRepId(null)}
            />
            {user ? (
              <FilterChip
                label={t("common.assignToMe")}
                active={salesRepId === user.id}
                onPress={() => setSalesRepId(user.id)}
              />
            ) : null}
            {titularReps.map((rep) => (
              <FilterChip
                key={rep.id}
                label={salesRepChipLabel(rep, t)}
                active={salesRepId === rep.id}
                onPress={() => setSalesRepId(rep.id)}
              />
            ))}
          </ScrollView>
          {subSellerReps.length > 0 ? (
            <>
              <Text style={styles.filterSectionLabel}>
                {t("calendly.subSellersTitle")}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {subSellerReps.map((rep) => (
                  <FilterChip
                    key={rep.id}
                    label={salesRepChipLabel(rep, t)}
                    active={salesRepId === rep.id}
                    onPress={() => setSalesRepId(rep.id)}
                  />
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {canCreate ? (
        <Button
          title={t("prospects.create")}
          onPress={() => setFormOpen(true)}
          style={{ marginBottom: 10 }}
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
              {showSalesRepFilter ? (
                <Text style={styles.metaMuted}>
                  {t("prospects.salesRep")}: {prospectSellerLabel(item, salesReps, t)}
                </Text>
              ) : null}
            </Card>
          </Pressable>
        )}
      />
      {canCreate && user ? (
        <ProspectCreateModal
          visible={formOpen}
          token={token}
          user={user}
          salesReps={scope.isGlobal ? scope.repsForSelectedSede : scope.salesReps}
          onClose={() => setFormOpen(false)}
          onCreated={() => {
            void load({ silent: true });
          }}
        />
      ) : null}
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : null]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
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
    fontSize: 22,
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
  metaMuted: {
    fontSize: 12,
    color: colors.brownMuted,
    marginTop: 4,
  },
  filtersBlock: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipsRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brownMuted,
    letterSpacing: 0.2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brownSoft,
  },
  chipTextActive: {
    color: colors.brand,
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
