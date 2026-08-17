import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { SedeBranchList } from "@/components/staff/SedeBranchList";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenState } from "@/components/ui/ScreenState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { CLIENTS_PAGE_SIZE } from "@/features/clients/constants";
import { useAdminSedeScope } from "@/hooks/useAdminSedeScope";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import {
  canFilterClientsBySalesRep,
  canRunOnboardingReminders,
  isAdvisor,
  isSalesStaff,
  seesOnboardingDashboard,
} from "@/lib/roles";
import type {
  CalendlySalesRep,
  Client,
  ClientBulkDeleteResponse,
  MerchantBrief,
  OnboardingReminderRunResult,
  Paginated,
  SentEmailEntry,
} from "@/types/api";
import { colors, radii, spacing } from "@/theme/tokens";

type MerchantFilter = "all" | number;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function personLabel(person: {
  first_name: string;
  last_name: string;
  email?: string;
} | null | undefined): string {
  if (!person) return "—";
  const name = `${person.first_name} ${person.last_name}`.trim();
  return name || person.email || "—";
}

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

export default function ClientesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token, user, hasPermission, isLoading: authLoading } = useAuth();
  const scope = useAdminSedeScope({ loadReps: true });

  const roleCode = user?.role.code;
  const isAdmin = roleCode === "ADMIN";
  const isOnboardingStaff = seesOnboardingDashboard(user) && !isAdvisor(user);
  const lineAdvisor = isAdvisor(user);
  const canFilterBySalesRep = canFilterClientsBySalesRep(user);
  const showAdvisor = canFilterBySalesRep || isSalesStaff(roleCode);
  const canBulkDelete = isAdmin && hasPermission("clients:delete");
  const canRunReminders = canRunOnboardingReminders(user);
  const listEnabled = !scope.isGlobal || scope.selectedSedeId != null;
  const onboardingOnly = roleCode === "BRANCH_MANAGER" || isOnboardingStaff;

  const [items, setItems] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [merchantFilter, setMerchantFilter] = useState<MerchantFilter>("all");
  const [salesRepId, setSalesRepId] = useState<number | null>(null);
  const [merchants, setMerchants] = useState<MerchantBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [remindersRunning, setRemindersRunning] = useState(false);

  const [emailTarget, setEmailTarget] = useState<Client | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailHistory, setEmailHistory] = useState<SentEmailEntry[]>([]);
  const [emailHistoryLoading, setEmailHistoryLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  const showMerchantFilter = merchants.length > 1;
  const showSalesRepFilter = canFilterBySalesRep;
  const salesReps = scope.isGlobal ? scope.repsForSelectedSede : scope.salesReps;
  const titularReps = useMemo(
    () => salesReps.filter((rep) => !isSubSeller(rep)),
    [salesReps],
  );
  const subSellerReps = useMemo(
    () => salesReps.filter(isSubSeller),
    [salesReps],
  );

  useEffect(() => {
    const handle = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [query, merchantFilter, salesRepId, scope.selectedSedeId]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, query, merchantFilter, salesRepId, scope.selectedSedeId]);

  useEffect(() => {
    setSalesRepId(null);
  }, [scope.selectedSedeId]);

  useEffect(() => {
    if (!token) return;

    const fromUser = user?.merchants ?? [];
    if (fromUser.length > 0) {
      setMerchants(fromUser);
      return;
    }

    void api
      .get<MerchantBrief[]>("/merchants/options", token)
      .then(setMerchants)
      .catch(() => setMerchants([]));
  }, [token, user?.merchants]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !listEnabled) {
        setItems([]);
        setTotal(0);
        setPages(1);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          page_size: String(CLIENTS_PAGE_SIZE),
        });
        if (query) params.set("search", query);
        if (onboardingOnly) params.set("onboarding_only", "true");
        if (scope.isGlobal && scope.selectedSedeId != null) {
          params.set("sede_id", String(scope.selectedSedeId));
        }
        if (showMerchantFilter) {
          if (merchantFilter === "all") {
            params.set("all_merchants", "true");
          } else {
            params.set("merchant_id", String(merchantFilter));
          }
        }
        if (showSalesRepFilter && salesRepId != null) {
          params.set("sales_rep_id", String(salesRepId));
        }

        const data = await api.get<Paginated<Client>>(
          `/clients?${params.toString()}`,
          token,
        );
        setItems(data.items);
        setTotal(data.total);
        setPages(Math.max(1, data.pages));
      } catch (err) {
        setError(
          getUserFacingErrorMessage(err, t("clients.loadError")),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      token,
      t,
      page,
      query,
      onboardingOnly,
      showMerchantFilter,
      merchantFilter,
      showSalesRepFilter,
      salesRepId,
      listEnabled,
      scope.isGlobal,
      scope.selectedSedeId,
    ],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  const toggleSelect = useCallback((clientId: number) => {
    setSelectedIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId],
    );
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds([]);
  }, []);

  const confirmBulkDelete = useCallback(() => {
    if (!token || selectedIds.length === 0 || bulkDeleting) return;

    Alert.alert(
      "Eliminar clientes",
      `¿Eliminar ${selectedIds.length} cliente(s) seleccionado(s)? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBulkDeleting(true);
              try {
                const result = await api.post<ClientBulkDeleteResponse>(
                  "/clients/bulk-delete",
                  { client_ids: selectedIds },
                  token,
                );
                const deleted = result.deleted_ids.length;
                const failed = result.failures.length;
                if (failed === 0) {
                  Alert.alert(
                    "Eliminación completada",
                    `Se eliminaron ${deleted} cliente(s).`,
                  );
                } else {
                  const reasons = result.failures
                    .map((f) => `#${f.client_id}: ${f.reason}`)
                    .join("\n");
                  Alert.alert(
                    "Eliminación parcial",
                    `Eliminados: ${deleted}. Fallidos: ${failed}.\n${reasons}`,
                  );
                }
                exitSelectMode();
                await load({ silent: true });
              } catch (err) {
                Alert.alert(
                  "Error",
                  getUserFacingErrorMessage(
                    err,
                    "No se pudieron eliminar los clientes",
                  ),
                );
              } finally {
                setBulkDeleting(false);
              }
            })();
          },
        },
      ],
    );
  }, [token, selectedIds, bulkDeleting, exitSelectMode, load]);

  const runReminders = useCallback(() => {
    if (!token || remindersRunning) return;

    Alert.alert(
      t("clients.remindersRunTitle"),
      t("clients.remindersRunConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("clients.remindersRunAction"),
          onPress: () => {
            void (async () => {
              setRemindersRunning(true);
              try {
                const result = await api.post<OnboardingReminderRunResult>(
                  "/onboarding-reminders/run",
                  {},
                  token,
                );
                const dryNote = result.dry_run
                  ? `\n\n${t("clients.remindersRunDryRunNote")}`
                  : "";
                Alert.alert(
                  t("clients.remindersRunSuccessTitle"),
                  `${t("clients.remindersRunSuccessMessage", {
                    processed: result.processed,
                    sent: result.sent,
                    skipped: result.skipped,
                    failed: result.failed,
                  })}${dryNote}`,
                );
              } catch (err) {
                Alert.alert(
                  t("common.error"),
                  getUserFacingErrorMessage(
                    err,
                    t("clients.remindersRunError"),
                  ),
                );
              } finally {
                setRemindersRunning(false);
              }
            })();
          },
        },
      ],
    );
  }, [token, remindersRunning, t]);

  const openEmailModal = useCallback(
    (client: Client) => {
      setEmailTarget(client);
      setEmailSubject("");
      setEmailMessage("");
      setEmailHistory([]);
      setEmailHistoryLoading(true);
      if (!token) return;
      void api
        .get<SentEmailEntry[]>(`/clients/${client.id}/emails`, token)
        .then((entries) => setEmailHistory(entries.slice(0, 3)))
        .catch(() => setEmailHistory([]))
        .finally(() => setEmailHistoryLoading(false));
    },
    [token],
  );

  const closeEmailModal = useCallback(() => {
    if (emailSending) return;
    setEmailTarget(null);
    setEmailSubject("");
    setEmailMessage("");
    setEmailHistory([]);
  }, [emailSending]);

  const sendEmail = useCallback(() => {
    if (!token || !emailTarget) return;
    const subject = emailSubject.trim();
    const message = emailMessage.trim();
    if (!subject || !message) {
      Alert.alert("Campos requeridos", "Completá el asunto y el mensaje.");
      return;
    }

    void (async () => {
      setEmailSending(true);
      try {
        await api.post(
          `/clients/${emailTarget.id}/send-email`,
          {
            subject,
            message_html: `<p>${escapeHtml(message)}</p>`,
          },
          token,
        );
        Alert.alert("Email enviado", "El mensaje se envió correctamente.");
        setEmailTarget(null);
        setEmailSubject("");
        setEmailMessage("");
        setEmailHistory([]);
      } catch (err) {
        Alert.alert(
          "Error",
          getUserFacingErrorMessage(err, "No se pudo enviar el email"),
        );
      } finally {
        setEmailSending(false);
      }
    })();
  }, [token, emailTarget, emailSubject, emailMessage]);

  const subtitle = useMemo(() => {
    if (lineAdvisor) return t("clients.subtitleAdvisor");
    if (isOnboardingStaff) return t("clients.subtitleOnboarding");
    return `${t("clients.subtitle")} · ${total}`;
  }, [isOnboardingStaff, lineAdvisor, t, total]);

  if (authLoading || scope.loading) {
    return <ScreenState loading message={t("clients.loading")} />;
  }

  if (scope.showSedePicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <Text style={styles.title}>{t("clients.title")}</Text>
        <Text style={styles.subtitle}>{t("scope.adminSedesHint")}</Text>
        <SedeBranchList branches={scope.branches} onSelect={scope.selectSede} />
      </ScrollView>
    );
  }

  if (loading && items.length === 0 && !error) {
    return <ScreenState loading message={t("clients.loading")} />;
  }

  return (
    <View style={styles.wrap}>
      <ScopePageHeader
        title={t("clients.title")}
        backLabel={scope.isGlobal ? t("scope.backToSedes") : undefined}
        onBack={scope.isGlobal ? scope.clearSede : undefined}
      />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.subtitle}>
            {subtitle}
            {scope.selectedSede ? ` · ${scope.selectedSede.name}` : ""}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {canRunReminders ? (
            <Button
              title={
                remindersRunning
                  ? t("clients.remindersRunning")
                  : t("clients.remindersRunAction")
              }
              variant="secondary"
              disabled={remindersRunning}
              onPress={runReminders}
              style={styles.headerBtn}
            />
          ) : null}
          {canBulkDelete ? (
            <Button
              title={selectMode ? "Cancelar" : "Seleccionar"}
              variant="ghost"
              onPress={() => {
                if (selectMode) exitSelectMode();
                else setSelectMode(true);
              }}
              style={styles.headerBtn}
            />
          ) : null}
        </View>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t("clients.searchPlaceholder")}
        placeholderTextColor={colors.brownMuted}
        style={styles.search}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      {showMerchantFilter || showSalesRepFilter ? (
        <View style={styles.filtersBlock}>
          {showMerchantFilter ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              <FilterChip
                label="Todos"
                active={merchantFilter === "all"}
                onPress={() => setMerchantFilter("all")}
              />
              {merchants.map((m) => (
                <FilterChip
                  key={m.id}
                  label={m.name}
                  active={merchantFilter === m.id}
                  onPress={() => setMerchantFilter(m.id)}
                />
              ))}
            </ScrollView>
          ) : null}

          {showSalesRepFilter ? (
            <>
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
            </>
          ) : null}
        </View>
      ) : null}

      {selectMode && selectedIds.length > 0 ? (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkCount}>
            {selectedIds.length} seleccionado(s)
          </Text>
          <Button
            title="Eliminar"
            variant="danger"
            loading={bulkDeleting}
            onPress={confirmBulkDelete}
            style={styles.bulkDeleteBtn}
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Button
            title="Reintentar"
            variant="secondary"
            onPress={() => void load()}
          />
        </View>
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
          !loading && !error ? (
            <EmptyState
              title={t("clients.empty")}
              description={
                query ? t("clients.emptySearch") : t("clients.emptyHint")
              }
              icon="people-outline"
            />
          ) : null
        }
        ListFooterComponent={
          items.length > 0 ? (
            <View style={styles.pagination}>
              <Button
                title="Anterior"
                variant="secondary"
                disabled={page <= 1 || loading}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                style={styles.pageBtn}
              />
              <Text style={styles.pageLabel}>
                Página {page} de {pages}
              </Text>
              <Button
                title="Siguiente"
                variant="secondary"
                disabled={page >= pages || loading}
                onPress={() => setPage((p) => Math.min(pages, p + 1))}
                style={styles.pageBtn}
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const name = `${item.first_name} ${item.last_name}`.trim();
          const selected = selectedIds.includes(item.id);
          const showMerchant =
            merchantFilter === "all" || Boolean(item.merchant?.name);

          return (
            <Pressable
              onPress={() => {
                if (selectMode) {
                  toggleSelect(item.id);
                  return;
                }
                router.push(`/(staff)/(tabs)/clientes/${item.id}` as never);
              }}
              onLongPress={() => {
                if (!canBulkDelete) return;
                setSelectMode(true);
                toggleSelect(item.id);
              }}
              delayLongPress={350}
            >
              <Card style={[styles.item, selected ? styles.itemSelected : null]}>
                <View style={styles.row}>
                  {selectMode ? (
                    <View
                      style={[
                        styles.checkbox,
                        selected ? styles.checkboxOn : null,
                      ]}
                    >
                      {selected ? (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={colors.white}
                        />
                      ) : null}
                    </View>
                  ) : null}
                  <View style={styles.itemBody}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {name}
                      </Text>
                      <Pressable
                        hitSlop={8}
                        onPress={() => openEmailModal(item)}
                        style={styles.emailBtn}
                        accessibilityLabel="Email"
                      >
                        <Ionicons
                          name="mail-outline"
                          size={18}
                          color={colors.brand}
                        />
                        <Text style={styles.emailBtnText}>Email</Text>
                      </Pressable>
                    </View>

                    <View style={styles.badges}>
                      <StatusBadge status={item.status} />
                      {item.is_qualified ? (
                        <View style={styles.qualifiedBadge}>
                          <Text style={styles.qualifiedText}>
                            {t("clients.qualified")}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.meta}>{item.email}</Text>
                    {item.phone ? (
                      <Text style={styles.meta}>{item.phone}</Text>
                    ) : null}

                    {showMerchant && item.merchant?.name ? (
                      <Text style={styles.merchant}>{item.merchant.name}</Text>
                    ) : null}

                    {showAdvisor ? (
                      <Text style={styles.metaMuted}>
                        {t("clients.advisor")}: {personLabel(item.advisor)}
                      </Text>
                    ) : null}

                    {showSalesRepFilter ? (
                      <Text style={styles.metaMuted}>
                        {t("clients.registeredBy")}: {personLabel(item.registered_by)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />

      <Modal
        visible={emailTarget != null}
        animationType="slide"
        transparent
        onRequestClose={closeEmailModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={styles.modalScroll}
            >
              <Text style={styles.modalTitle}>Enviar email</Text>
              {emailTarget ? (
                <Text style={styles.modalSubtitle}>
                  {emailTarget.first_name} {emailTarget.last_name} ·{" "}
                  {emailTarget.email}
                </Text>
              ) : null}

              <Text style={styles.fieldLabel}>Asunto</Text>
              <TextInput
                value={emailSubject}
                onChangeText={setEmailSubject}
                placeholder="Asunto del mensaje"
                placeholderTextColor={colors.brownMuted}
                style={styles.modalInput}
                editable={!emailSending}
              />

              <Text style={styles.fieldLabel}>Mensaje</Text>
              <TextInput
                value={emailMessage}
                onChangeText={setEmailMessage}
                placeholder="Escribí el mensaje…"
                placeholderTextColor={colors.brownMuted}
                style={[styles.modalInput, styles.modalTextArea]}
                multiline
                textAlignVertical="top"
                editable={!emailSending}
              />

              <Text style={styles.historyTitle}>Últimos emails</Text>
              {emailHistoryLoading ? (
                <Text style={styles.metaMuted}>Cargando historial…</Text>
              ) : emailHistory.length === 0 ? (
                <Text style={styles.metaMuted}>Sin emails previos.</Text>
              ) : (
                emailHistory.map((entry) => (
                  <View key={entry.id} style={styles.historyItem}>
                    <Text style={styles.historySubject} numberOfLines={1}>
                      {entry.subject}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {new Date(entry.created_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {entry.sent_by_name}
                    </Text>
                  </View>
                ))
              )}

              <View style={styles.modalActions}>
                <Button
                  title="Cancelar"
                  variant="secondary"
                  disabled={emailSending}
                  onPress={closeEmailModal}
                  style={styles.modalActionBtn}
                />
                <Button
                  title={emailSending ? "Enviando…" : "Enviar"}
                  loading={emailSending}
                  onPress={sendEmail}
                  style={styles.modalActionBtn}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  pickerContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerText: {
    gap: 2,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  headerBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
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
  search: {
    minHeight: 44,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    marginBottom: spacing.sm,
    color: colors.ink,
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
  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: "#f0c4bc",
    backgroundColor: "#fdf2f0",
  },
  bulkCount: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.brown,
  },
  bulkDeleteBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
  errorBox: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  list: {
    gap: 10,
    paddingBottom: 32,
    flexGrow: 1,
  },
  item: {
    backgroundColor: colors.white,
  },
  itemSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  checkboxOn: {
    backgroundColor: colors.brand,
  },
  itemBody: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emailBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.brand,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginVertical: 2,
  },
  qualifiedBadge: {
    backgroundColor: colors.brandLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  qualifiedText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand,
  },
  meta: {
    fontSize: 13,
    color: colors.soft,
  },
  metaMuted: {
    fontSize: 12,
    color: colors.brownSoft,
  },
  merchant: {
    fontSize: 12,
    color: colors.gold,
    fontWeight: "600",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: "92%",
    flexShrink: 1,
  },
  modalScroll: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.brown,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.soft,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brown,
  },
  modalInput: {
    minHeight: 44,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.ink,
  },
  modalTextArea: {
    minHeight: 110,
  },
  historyTitle: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: "700",
    color: colors.brown,
  },
  historyItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 2,
  },
  historySubject: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  historyMeta: {
    fontSize: 11,
    color: colors.soft,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalActionBtn: {
    flex: 1,
  },
});
