import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";

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
import type { PaymentConfig, PaymentLink } from "@/types/api";
import { PAYMENT_STATUS_LABELS } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

export default function PagosScreen() {
  const { t } = useTranslation();
  const { token, isLoading: authLoading } = useAuth();
  const scope = useAdminSedeScope({ loadReps: true });
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [items, setItems] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailEnabled =
    !scope.isGlobal || (scope.selectedSedeId != null && scope.selectedRepId != null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !detailEnabled) {
        setConfig(null);
        setItems([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const qs =
          scope.isGlobal && scope.selectedRepId != null
            ? `?created_by_user_id=${scope.selectedRepId}`
            : "";
        const [cfg, list] = await Promise.all([
          api.get<PaymentConfig>("/payments/config", token),
          api.get<PaymentLink[]>(`/payments/links${qs}`, token),
        ]);
        setConfig(cfg);
        setItems(list);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("payments.loadError") || "No se pudieron cargar los pagos"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, detailEnabled, scope.isGlobal, scope.selectedRepId, t],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  async function openUrl(url: string) {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setError("No se pudo abrir el enlace de pago");
    }
  }

  if (authLoading || scope.loading) {
    return <ScreenState loading message="Cargando pagos…" />;
  }

  if (scope.showSedePicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <Text style={styles.title}>{t("payments.title")}</Text>
        <Text style={styles.subtitle}>{t("scope.adminSedesHint")}</Text>
        <SedeBranchList branches={scope.branches} onSelect={scope.selectSede} />
      </ScrollView>
    );
  }

  if (scope.isGlobal && scope.showRepPicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <ScopeBackButton label={t("scope.backToSedes")} onPress={scope.clearSede} />
        <Text style={styles.title}>{t("payments.title")}</Text>
        <Text style={styles.subtitle}>
          {scope.selectedSede
            ? t("scope.selectedSede", { name: scope.selectedSede.name })
            : t("scope.adminRepsHint")}
        </Text>
        <SalesRepList
          reps={scope.repsForSelectedSede}
          onSelect={scope.selectRep}
          showConnectionStatus={false}
        />
      </ScrollView>
    );
  }

  if (loading && items.length === 0 && !error && !config) {
    return <ScreenState loading message="Cargando pagos…" />;
  }

  const configMessage = !config
    ? null
    : !config.payments_enabled
      ? "Los pagos no están habilitados en este entorno."
      : config.stub_mode
        ? "Modo de prueba activo (stub)."
        : `Proveedor: ${config.default_provider}`;

  const repName = scope.selectedRep
    ? `${scope.selectedRep.first_name} ${scope.selectedRep.last_name}`.trim()
    : null;

  return (
    <View style={styles.wrap}>
      {scope.isGlobal ? (
        <ScopeBackButton label={t("scope.backToReps")} onPress={scope.clearRep} />
      ) : null}
      <Text style={styles.title}>{t("payments.title")}</Text>
      <Text style={styles.subtitle}>
        {[configMessage, scope.selectedSede?.name, repName].filter(Boolean).join(" · ")}
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
          !loading ? <Text style={styles.empty}>No hay links de pago.</Text> : null
        }
        renderItem={({ item }) => {
          const url = item.external_checkout_url || item.payment_url;
          return (
            <Card style={styles.item}>
              <View style={styles.row}>
                <Text style={styles.amount}>
                  {item.amount} {item.currency}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {PAYMENT_STATUS_LABELS[item.status] ?? item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.name}>
                {item.customer_first_name} {item.customer_last_name}
              </Text>
              <Text style={styles.meta}>{item.customer_email}</Text>
              {item.description ? (
                <Text style={styles.meta}>{item.description}</Text>
              ) : null}
              <Text style={styles.meta}>
                {new Date(item.created_at).toLocaleString("es")}
              </Text>
              {url ? (
                <Button
                  title="Abrir link"
                  variant="secondary"
                  fullWidth
                  onPress={() => void openUrl(url)}
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
  amount: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brand,
  },
  name: {
    fontSize: 15,
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
    fontWeight: "600",
    color: colors.brand,
  },
  meta: {
    fontSize: 13,
    color: colors.soft,
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
