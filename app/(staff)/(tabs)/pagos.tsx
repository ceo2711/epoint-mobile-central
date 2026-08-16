import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";

import { SalesRepList } from "@/components/staff/SalesRepList";
import { SalesToolsScopeToggle } from "@/components/staff/SalesToolsScopeToggle";
import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { SedeBranchList } from "@/components/staff/SedeBranchList";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { PaymentLinkForm } from "@/features/payments/PaymentLinkForm";
import {
  CancelPaymentIconButton,
  confirmCancelPaymentLink,
} from "@/features/payments/CancelPaymentIconButton";
import { useAdminSedeScope } from "@/hooks/useAdminSedeScope";
import { useSalesToolsScope } from "@/hooks/useSalesToolsScope";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { Paginated, PaymentConfig, PaymentLink } from "@/types/api";
import { PAYMENT_STATUS_LABELS } from "@/types/api";
import { colors, radii } from "@/theme/tokens";
import { asPaymentList, PAYMENTS_PAGE_SIZE } from "@/features/payments/linkablePayments";

export default function PagosScreen() {
  const { t } = useTranslation();
  const { token, isLoading: authLoading } = useAuth();
  const tools = useSalesToolsScope();
  const scope = useAdminSedeScope({
    loadReps: tools.viewingTeam,
    pickRep: tools.viewingTeam,
  });
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [items, setItems] = useState<PaymentLink[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const detailEnabled = !scope.needsRepPicker || scope.selectedRepId != null;
  const sedeName = scope.selectedSede?.name ?? scope.ownSede?.name ?? null;

  const load = useCallback(
    async (opts?: { silent?: boolean; page?: number }) => {
      if (!token || !detailEnabled) {
        setConfig(null);
        setItems([]);
        setPages(1);
        setLoading(Boolean(token && !detailEnabled));
        setRefreshing(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      const pageToLoad = opts?.page ?? page;
      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          page_size: String(PAYMENTS_PAGE_SIZE),
        });
        if (scope.needsRepPicker && scope.selectedRepId != null) {
          params.set("created_by_user_id", String(scope.selectedRepId));
        }
        const [cfg, list] = await Promise.all([
          api.get<PaymentConfig>("/payments/config", token),
          api.get<Paginated<PaymentLink> | PaymentLink[]>(`/payments/links?${params}`, token),
        ]);
        setConfig(cfg);
        setItems(asPaymentList(list));
        setPages(Array.isArray(list) ? 1 : Math.max(1, list.pages || 1));
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("payments.loadError") || "No se pudieron cargar los pagos"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, detailEnabled, scope.needsRepPicker, scope.selectedRepId, page, t],
  );

  useEffect(() => {
    setPage(1);
  }, [scope.selectedRepId, scope.selectedSedeId]);

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

  async function handleCancel(linkId: number) {
    if (!token) return;
    confirmCancelPaymentLink(t, () => {
      void (async () => {
        setCancellingId(linkId);
        setError(null);
        try {
          await api.post(`/payments/links/${linkId}/cancel`, {}, token);
          await load({ silent: true });
        } catch (err) {
          setError(getUserFacingErrorMessage(err, t("payments.cancelError")));
        } finally {
          setCancellingId(null);
        }
      })();
    });
  }

  async function handleCreate(payload: {
    customer_first_name: string;
    customer_last_name: string;
    customer_email: string;
    customer_phone: string;
    amount: number;
    currency: "USD";
    provider: string;
    description?: string;
    prospect_id?: number;
    send_email: boolean;
  }) {
    if (!token) return;
    setSending(true);
    setError(null);
    try {
      await api.post("/payments/links", payload, token);
      setFormOpen(false);
      if (page !== 1) {
        setPage(1);
      } else {
        await load({ silent: true, page: 1 });
      }
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("payments.createError")));
    } finally {
      setSending(false);
    }
  }

  const toolsToggle = tools.showToggle ? (
    <SalesToolsScopeToggle
      value={tools.scope}
      onChange={(next) => {
        tools.setScope(next);
        scope.clearRep();
      }}
    />
  ) : null;

  if (authLoading || scope.loading) {
    return <ScreenState loading message="Cargando pagos…" />;
  }

  if (scope.showSedePicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <Text style={styles.title}>{t("payments.title")}</Text>
        {toolsToggle}
        <Text style={styles.subtitle}>{t("scope.adminSedesHint")}</Text>
        <SedeBranchList branches={scope.branches} onSelect={scope.selectSede} />
      </ScrollView>
    );
  }

  if (scope.showRepPicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <ScopePageHeader
          title={t("payments.title")}
          backLabel={scope.isGlobal ? t("scope.backToSedes") : undefined}
          onBack={scope.isGlobal ? scope.clearSede : undefined}
        />
        {toolsToggle}
        <Text style={styles.subtitle}>
          {sedeName
            ? t("scope.selectedSede", { name: sedeName })
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
      <ScopePageHeader
        title={t("payments.title")}
        backLabel={scope.needsRepPicker ? t("scope.backToReps") : undefined}
        onBack={scope.needsRepPicker ? scope.clearRep : undefined}
      />
      {toolsToggle}
      <Text style={styles.subtitle}>
        {[configMessage, sedeName, repName].filter(Boolean).join(" · ")}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tools.viewingOwn && config?.payments_enabled ? (
        <Button
          title={t("payments.create")}
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
          !loading ? <Text style={styles.empty}>{t("payments.empty")}</Text> : null
        }
        ListFooterComponent={
          items.length > 0 && pages > 1 ? (
            <View style={styles.pagination}>
              <Button
                title={t("common.previous")}
                variant="secondary"
                disabled={page <= 1 || loading}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                style={styles.pageBtn}
              />
              <Text style={styles.pageLabel}>{t("common.pageOf", { page, pages })}</Text>
              <Button
                title={t("common.next")}
                variant="secondary"
                disabled={page >= pages || loading}
                onPress={() => setPage((current) => Math.min(pages, current + 1))}
                style={styles.pageBtn}
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const url = item.external_checkout_url || item.payment_url;
          return (
            <Card style={styles.item}>
              <View style={styles.row}>
                <Text style={styles.amount}>
                  {item.amount} {item.currency}
                </Text>
                <View style={styles.rowEnd}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {PAYMENT_STATUS_LABELS[item.status] ?? item.status}
                    </Text>
                  </View>
                  {item.status === "pending" ? (
                    <CancelPaymentIconButton
                      loading={cancellingId === item.id}
                      onPress={() => handleCancel(item.id)}
                    />
                  ) : null}
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
      <Modal
        visible={formOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFormOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={styles.modalCard}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <Text style={styles.modalTitle}>{t("payments.create")}</Text>
            <PaymentLinkForm
              config={config}
              submitting={sending}
              resetKey={formOpen ? "open" : "closed"}
              onSubmit={handleCreate}
            />
            <Button
              title={t("common.cancel")}
              variant="secondary"
              onPress={() => setFormOpen(false)}
            />
          </ScrollView>
        </View>
      </Modal>
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
  rowEnd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 12,
    paddingTop: 8,
    paddingBottom: 16,
  },
  pageBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  pageLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: colors.brown,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "88%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalContent: {
    padding: 20,
    gap: 12,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brown,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
  },
});
