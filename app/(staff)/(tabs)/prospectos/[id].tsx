import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  AppState,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ScreenState } from "@/components/ui/ScreenState";
import { Select } from "@/components/ui/Select";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { PaymentLinkForm } from "@/features/payments/PaymentLinkForm";
import { fetchLinkablePaymentLinks } from "@/features/payments/linkablePayments";
import { SendContractModal } from "@/features/docusign/SendContractModal";
import { ProspectContractsModal } from "@/features/prospects/ProspectContractsModal";
import { ProspectLinkedResources } from "@/features/prospects/ProspectLinkedResources";
import { ProspectPaymentsModal } from "@/features/prospects/ProspectPaymentsModal";
import {
  findContactHistory,
  sellerMarkedContacted,
} from "@/features/prospects/utils/pipeline";
import { getAllowedNextStatuses } from "@/features/prospects/utils/transitions";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { colors, radii } from "@/theme/tokens";
import type {
  CalendlyConnection,
  CalendlyEvent,
  DocusignConnection,
  Paginated,
  PaymentConfig,
  PaymentLink,
  ProspectDetail,
  ProspectEnvelopeBrief,
  ProspectPaymentBrief,
  ProspectStatus,
  Source,
} from "@/types/api";
import { PAYMENT_STATUS_LABELS, PROSPECT_STATUS_LABELS } from "@/types/api";

type EditForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  notes: string;
  is_qualified: boolean;
};

function buildEditForm(prospect: ProspectDetail): EditForm {
  return {
    first_name: prospect.first_name,
    last_name: prospect.last_name,
    email: prospect.email,
    phone: prospect.phone,
    source: prospect.source ?? "",
    notes: prospect.notes ?? "",
    is_qualified: prospect.is_qualified,
  };
}

function envelopesOf(prospect: ProspectDetail): ProspectEnvelopeBrief[] {
  if (prospect.docusign_envelopes?.length) return prospect.docusign_envelopes;
  return prospect.docusign_envelope ? [prospect.docusign_envelope] : [];
}

const TERMINAL_ENVELOPE_STATUSES = new Set(["completed", "declined", "voided"]);
const PENDING_CONTRACT_SYNC_MS = 15_000;

function paymentsOf(prospect: ProspectDetail): ProspectPaymentBrief[] {
  if (prospect.payment_links?.length) return prospect.payment_links;
  return prospect.payment_link ? [prospect.payment_link] : [];
}

function asList<T>(data: T[] | Paginated<T> | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

function formatHistoryDate(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === "en" ? "en-US" : "es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "—"}</Text>
    </View>
  );
}

export default function ProspectoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useTranslation();
  const { token, hasPermission, isLoading: authLoading } = useAuth();

  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [docusign, setDocusign] = useState<DocusignConnection | null>(null);
  const [templates, setTemplates] = useState<{ template_id: string; name: string }[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [linkableLoading, setLinkableLoading] = useState(false);

  const [calendlyOpen, setCalendlyOpen] = useState(false);
  const [calendlyMarkOpen, setCalendlyMarkOpen] = useState(false);
  const [calendlyEvents, setCalendlyEvents] = useState<CalendlyEvent[]>([]);
  const [calendlyConnected, setCalendlyConnected] = useState(true);
  const [calendlyLoading, setCalendlyLoading] = useState(false);
  const [pickerId, setPickerId] = useState<number | null>(null);
  const [pickerSaving, setPickerSaving] = useState(false);

  const [contractOpen, setContractOpen] = useState(false);
  const [contractsListOpen, setContractsListOpen] = useState(false);
  const [paymentsListOpen, setPaymentsListOpen] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [cancellingPaymentId, setCancellingPaymentId] = useState<number | null>(null);

  const [linkPaymentOpen, setLinkPaymentOpen] = useState(false);
  const [contactNoteOpen, setContactNoteOpen] = useState(false);
  const [contactNote, setContactNote] = useState("");

  const canUpdate = hasPermission("prospects:update");
  const isConverted = Boolean(prospect?.converted_client_id);
  const canEditBasic = canUpdate && !isConverted;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !id) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const data = await api.get<ProspectDetail>(`/prospects/${id}`, token);
        setProspect(data);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("prospects.loadError")));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, id, t],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  useEffect(() => {
    if (prospect && !editing) setEditForm(buildEditForm(prospect));
  }, [prospect, editing]);

  useEffect(() => {
    if (!token || !canUpdate || !id) return;
    void api
      .get<Source[]>("/sources/options", token)
      .then(setSources)
      .catch(() => setSources([]));
    void api
      .get<DocusignConnection>("/docusign/connection", token)
      .then((conn) => {
        setDocusign(conn);
        if (conn.connected) {
          return api
            .get<{ template_id: string; name: string }[]>("/docusign/templates", token)
            .then((list) => {
              const templatesList = asList(list);
              setTemplates(templatesList);
            });
        }
        setTemplates([]);
      })
      .catch(() => setDocusign(null));
    void api
      .get<PaymentConfig>("/payments/config", token)
      .then(setPaymentConfig)
      .catch(() => setPaymentConfig(null));
  }, [token, canUpdate, id]);

  const allowedStatuses = prospect
    ? getAllowedNextStatuses(prospect.status as ProspectStatus)
    : [];
  const envelopes = prospect ? envelopesOf(prospect) : [];
  const payments = prospect ? paymentsOf(prospect) : [];
  const hasPendingContracts = envelopes.some(
    (envelope) => !TERMINAL_ENVELOPE_STATUSES.has(envelope.status.toLowerCase()),
  );

  useEffect(() => {
    if (!token || !prospect?.id || isConverted || !hasPendingContracts) return;
    let cancelled = false;

    const syncPipeline = async () => {
      try {
        await api.post("/docusign/envelopes/sync-pending", {}, token);
      } catch {
        /* El webhook o el próximo ciclo actualizarán el estado. */
      }
      if (!cancelled) void load({ silent: true });
    };

    void syncPipeline();
    const timer = setInterval(() => void syncPipeline(), PENDING_CONTRACT_SYNC_MS);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncPipeline();
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      appStateSub.remove();
    };
  }, [token, prospect?.id, isConverted, hasPendingContracts, load]);
  const contactHistory = findContactHistory(prospect?.history ?? []);
  const canMarkContacted =
    Boolean(prospect) &&
    canUpdate &&
    !isConverted &&
    (prospect!.status === "PENDIENTE_CONTACTAR" ||
      (prospect!.status === "PAGO_COMPLETADO" &&
        !sellerMarkedContacted(prospect!.status, prospect!.history ?? []))) &&
    (prospect!.status === "PENDIENTE_CONTACTAR"
      ? allowedStatuses.includes("LEAD_CONTACTADO")
      : true);

  const sourceLabel = useMemo(() => {
    if (!prospect?.source) return "—";
    return sources.find((item) => item.code === prospect.source)?.name ?? prospect.source;
  }, [prospect?.source, sources]);

  const salesRepName = prospect?.assigned_to
    ? `${prospect.assigned_to.first_name} ${prospect.assigned_to.last_name}`.trim()
    : "—";

  const unlinkedPayments = (Array.isArray(paymentLinks) ? paymentLinks : []).filter(
    (link) =>
      link.status === "pending" &&
      !link.prospect_id &&
      prospect &&
      link.customer_email.toLowerCase() === prospect.email.toLowerCase(),
  );

  async function loadCalendlyEvents() {
    if (!token || !prospect?.assigned_to_user_id) return;
    setCalendlyLoading(true);
    setPickerId(null);
    try {
      const qs = `?user_id=${prospect.assigned_to_user_id}`;
      const conn = await api.get<CalendlyConnection>(`/calendly/connection${qs}`, token);
      setCalendlyConnected(conn.connected);
      if (!conn.connected) {
        setCalendlyEvents([]);
        return;
      }
      const events = await api.get<CalendlyEvent[]>(`/calendly/events${qs}`, token);
      setCalendlyEvents(
        events.filter(
          (event) =>
            event.status !== "canceled" &&
            event.id !== prospect.calendly_event?.id &&
            event.prospect_id == null,
        ),
      );
    } catch {
      setCalendlyEvents([]);
      setCalendlyConnected(false);
    } finally {
      setCalendlyLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!token || !prospect || !editForm || !canEditBasic) return;
    setEditSaving(true);
    try {
      await api.patch(
        `/prospects/${prospect.id}`,
        {
          first_name: editForm.first_name.trim(),
          last_name: editForm.last_name.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          source: editForm.source || undefined,
          notes: editForm.notes.trim(),
          is_qualified: editForm.is_qualified,
        },
        token,
      );
      setEditing(false);
      await load({ silent: true });
    } catch (err) {
      Alert.alert(t("common.error"), getUserFacingErrorMessage(err, t("prospects.saveError")));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAddNote() {
    if (!token || !prospect || !noteText.trim() || !canUpdate) return;
    setNoteSaving(true);
    try {
      await api.post(`/prospects/${prospect.id}/notes`, { note: noteText.trim() }, token);
      setNoteText("");
      await load({ silent: true });
    } catch (err) {
      Alert.alert(t("common.error"), getUserFacingErrorMessage(err, t("prospects.noteError")));
    } finally {
      setNoteSaving(false);
    }
  }

  async function postMarkContacted(note?: string) {
    if (!token || !prospect) return;
    await api.post(
      `/prospects/${prospect.id}/mark-contacted`,
      note ? { note } : {},
      token,
    );
    await load({ silent: true });
    Alert.alert(t("prospects.markContactedTitle"), t("prospects.markContactedSuccess"));
  }

  async function handleMarkContacted() {
    if (!prospect || !canUpdate) return;
    if (prospect.calendly_event) {
      Alert.alert(
        t("prospects.markContactedTitle"),
        t("prospects.markContactedConfirm", { name: prospect.full_name }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("prospects.markContacted"),
            onPress: () => void postMarkContacted().catch((err) => {
              Alert.alert(
                t("common.error"),
                getUserFacingErrorMessage(err, t("prospects.statusUpdateError")),
              );
            }),
          },
        ],
      );
      return;
    }
    if (prospect.assigned_to_user_id) {
      Alert.alert(
        t("prospects.markContactedTitle"),
        t("prospects.markContactedNoMeetingHint", { name: prospect.full_name }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("prospects.markContactedOtherChannel"),
            onPress: openManualContactNote,
          },
          {
            text: t("prospects.markContactedLinkMeeting"),
            onPress: () => {
              setCalendlyMarkOpen(true);
              void loadCalendlyEvents();
            },
          },
        ],
      );
      return;
    }
    openManualContactNote();
  }

  function openManualContactNote() {
    setCalendlyMarkOpen(false);
    setContactNote("");
    setContactNoteOpen(true);
  }

  async function handleLinkCalendly(eventId: number, markContacted = false) {
    if (!token || !prospect) return;
    setPickerSaving(true);
    try {
      await api.post(
        `/prospects/${prospect.id}/link-calendly`,
        { calendly_event_id: eventId },
        token,
      );
      if (markContacted) {
        await api.post(`/prospects/${prospect.id}/mark-contacted`, {}, token);
      }
      setCalendlyOpen(false);
      setCalendlyMarkOpen(false);
      await load({ silent: true });
    } catch (err) {
      Alert.alert(
        t("common.error"),
        getUserFacingErrorMessage(err, t("prospects.statusUpdateError")),
      );
    } finally {
      setPickerSaving(false);
    }
  }

  async function handleSendContract(payload: {
    signer_name: string;
    signer_email: string;
    subject?: string;
    template_id?: string;
    prospect_id?: number;
  }) {
    if (!token || !prospect) return;
    await api.post(
      "/docusign/envelopes",
      {
        ...payload,
        prospect_id: prospect.id,
      },
      token,
    );
    await load({ silent: true });
  }

  async function handleCreatePayment(payload: {
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
    setPaymentSaving(true);
    try {
      await api.post("/payments/links", payload, token);
      setPaymentOpen(false);
      await load({ silent: true });
    } catch (err) {
      Alert.alert(t("common.error"), getUserFacingErrorMessage(err, t("payments.createError")));
    } finally {
      setPaymentSaving(false);
    }
  }

  async function openLinkPayment() {
    if (!token || !prospect) return;
    setPickerId(null);
    setLinkPaymentOpen(true);
    setLinkableLoading(true);
    try {
      const items = await fetchLinkablePaymentLinks(token, prospect.email);
      setPaymentLinks(items);
    } catch {
      setPaymentLinks([]);
    } finally {
      setLinkableLoading(false);
    }
  }

  async function handleCancelPayment(paymentId: number) {
    if (!token) return;
    setCancellingPaymentId(paymentId);
    try {
      await api.post(`/payments/links/${paymentId}/cancel`, {}, token);
      await load({ silent: true });
    } catch (err) {
      Alert.alert(t("common.error"), getUserFacingErrorMessage(err, t("payments.cancelError")));
    } finally {
      setCancellingPaymentId(null);
    }
  }

  async function handleLinkPayment(paymentLinkId: number) {
    if (!token || !prospect) return;
    setPickerSaving(true);
    try {
      await api.post(
        `/prospects/${prospect.id}/link-payment`,
        { payment_link_id: paymentLinkId },
        token,
      );
      setLinkPaymentOpen(false);
      await load({ silent: true });
    } catch (err) {
      Alert.alert(t("common.error"), getUserFacingErrorMessage(err, t("prospects.saveError")));
    } finally {
      setPickerSaving(false);
    }
  }

  if (authLoading || (loading && !prospect && !error)) {
    return <ScreenState loading message={t("common.loading")} />;
  }

  if (error && !prospect) {
    return <ScreenState message={error} />;
  }

  if (!prospect) {
    return <ScreenState message={t("prospects.empty")} />;
  }

  const statusLabel =
    t(`prospects.statusLabels.${prospect.status}`) === `prospects.statusLabels.${prospect.status}`
      ? (PROSPECT_STATUS_LABELS[prospect.status] ?? prospect.status)
      : t(`prospects.statusLabels.${prospect.status}`);

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}
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
        keyboardShouldPersistTaps="handled"
      >
        <ScopePageHeader
          title={prospect.full_name}
          backLabel={t("common.back")}
          onBack={() => router.back()}
        />
        <Text style={styles.email}>{prospect.email}</Text>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{statusLabel}</Text>
          </View>
          <View style={[styles.badge, prospect.is_qualified ? null : styles.badgeMuted]}>
            <Text style={styles.badgeText}>
              {prospect.is_qualified ? t("prospects.qualified") : t("prospects.unqualified")}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {canEditBasic && !editing ? (
            <Button
              title={t("common.edit")}
              variant="secondary"
              onPress={() => {
                setEditForm(buildEditForm(prospect));
                setEditing(true);
              }}
            />
          ) : null}
          {isConverted ? (
            <Button
              title={t("prospects.viewClient")}
              onPress={() =>
                router.push(`/(staff)/(tabs)/clientes/${prospect.converted_client_id}` as never)
              }
            />
          ) : null}
          {isConverted && envelopes.length > 0 ? (
            <Button
              title={t("prospects.viewSentContracts")}
              variant="secondary"
              onPress={() => setContractsListOpen(true)}
            />
          ) : null}
          {isConverted && payments.length > 0 ? (
            <Button
              title={t("prospects.viewSentPayments")}
              variant="secondary"
              onPress={() => setPaymentsListOpen(true)}
            />
          ) : null}
        </View>

        {isConverted ? (
          <Text style={styles.converted}>{t("prospects.convertedHint")}</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Card title={editing ? t("prospects.edit") : t("prospects.overview")}>
          {editing && editForm ? (
            <View style={styles.formGap}>
              <Input
                label={t("common.firstName")}
                value={editForm.first_name}
                onChangeText={(first_name) => setEditForm({ ...editForm, first_name })}
              />
              <Input
                label={t("common.lastName")}
                value={editForm.last_name}
                onChangeText={(last_name) => setEditForm({ ...editForm, last_name })}
              />
              <Input
                label={t("common.email")}
                value={editForm.email}
                onChangeText={(email) => setEditForm({ ...editForm, email })}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Input
                label={t("common.phone")}
                value={editForm.phone}
                onChangeText={(phone) => setEditForm({ ...editForm, phone })}
                keyboardType="phone-pad"
              />
              {sources.length > 0 ? (
                <Select
                  label={t("prospects.source")}
                  value={editForm.source}
                  onChange={(source) => setEditForm({ ...editForm, source })}
                  options={sources.map((item) => ({ value: item.code, label: item.name }))}
                />
              ) : null}
              <Select
                label={t("prospects.qualification")}
                value={editForm.is_qualified ? "1" : "0"}
                onChange={(value) =>
                  setEditForm({ ...editForm, is_qualified: value === "1" })
                }
                options={[
                  { value: "1", label: t("prospects.qualified") },
                  { value: "0", label: t("prospects.unqualified") },
                ]}
              />
              <Text style={styles.fieldLabel}>{t("prospects.notes")}</Text>
              <TextInput
                value={editForm.notes}
                onChangeText={(notes) => setEditForm({ ...editForm, notes })}
                multiline
                style={styles.textarea}
                textAlignVertical="top"
              />
              <View style={styles.rowBtns}>
                <Button
                  title={t("common.cancel")}
                  variant="secondary"
                  onPress={() => {
                    setEditForm(buildEditForm(prospect));
                    setEditing(false);
                  }}
                  style={styles.flexBtn}
                />
                <Button
                  title={t("common.saveChanges")}
                  loading={editSaving}
                  onPress={() => void handleSaveEdit()}
                  style={styles.flexBtn}
                />
              </View>
            </View>
          ) : (
            <View style={styles.infoGrid}>
              <InfoRow label={t("common.email")} value={prospect.email} />
              <InfoRow label={t("common.phone")} value={prospect.phone} />
              <InfoRow label={t("prospects.merchant")} value={prospect.merchant_name ?? "—"} />
              <InfoRow label={t("prospects.salesRep")} value={salesRepName} />
              <InfoRow label={t("prospects.source")} value={sourceLabel} />
              {prospect.source === "INFLUENCERS" ? (
                <InfoRow
                  label={t("prospects.influencer")}
                  value={prospect.influencer_name ?? "—"}
                />
              ) : null}
              <InfoRow
                label={t("prospects.qualification")}
                value={
                  prospect.is_qualified ? t("prospects.qualified") : t("prospects.unqualified")
                }
              />
              {prospect.notes ? (
                <InfoRow label={t("prospects.notes")} value={prospect.notes} />
              ) : null}
            </View>
          )}
        </Card>

        {!isConverted ? (
          <ProspectLinkedResources
            locale={locale}
            prospectStatus={prospect.status}
            calendly={prospect.calendly_event ?? null}
            envelopes={envelopes}
            payment={prospect.payment_link ?? null}
            payments={payments}
            history={prospect.history ?? []}
            canManage={canUpdate}
            canMarkContacted={canMarkContacted}
            contactNote={contactHistory?.note ?? null}
            contactNoteBy={contactHistory?.changed_by_name ?? null}
            contactNoteAt={contactHistory?.created_at ?? null}
            onMarkContacted={() => void handleMarkContacted()}
            onLinkCalendly={() => {
              setCalendlyOpen(true);
              void loadCalendlyEvents();
            }}
            onViewContracts={() => setContractsListOpen(true)}
            onViewPayments={() => setPaymentsListOpen(true)}
            onSendContract={
              docusign?.connected
                ? () => {
                    if (envelopes.length > 0) {
                      Alert.alert(
                        t("prospects.sendAnotherContract"),
                        t("prospects.sendAnotherContractConfirm", {
                          name: prospect.full_name,
                        }),
                        [
                          { text: t("common.cancel"), style: "cancel" },
                          {
                            text: t("prospects.sendContract"),
                            onPress: () => setContractOpen(true),
                          },
                        ],
                      );
                      return;
                    }
                    setContractOpen(true);
                  }
                : undefined
            }
            onCreatePayment={
              paymentConfig?.payments_enabled
                ? () => setPaymentOpen(true)
                : undefined
            }
            onLinkPayment={() => void openLinkPayment()}
            onCancelPayment={canUpdate ? (id) => void handleCancelPayment(id) : undefined}
            cancellingPaymentId={cancellingPaymentId}
          />
        ) : null}

        {canUpdate && !isConverted ? (
          <Card title={t("prospects.addNote")}>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder={t("prospects.notePlaceholder")}
              placeholderTextColor={colors.brownMuted}
              multiline
              style={styles.textareaTall}
              textAlignVertical="top"
            />
            <Button
              title={t("prospects.addNoteAction")}
              disabled={!noteText.trim() || noteSaving}
              loading={noteSaving}
              onPress={() => void handleAddNote()}
            />
          </Card>
        ) : null}

        <Card title={t("prospects.history.title")}>
          {prospect.history?.length ? (
            [...prospect.history].map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <Text style={styles.historyTitle}>
                  {t(`prospects.history.event.${entry.event_type}`)}
                </Text>
                <Text style={styles.muted}>
                  {formatHistoryDate(entry.created_at, locale)}
                </Text>
                {entry.note ? <Text style={styles.historyNote}>{entry.note}</Text> : null}
                {entry.changed_by_name ? (
                  <Text style={styles.muted}>
                    {t("prospects.history.by", { name: entry.changed_by_name })}
                  </Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.muted}>{t("prospects.history.empty")}</Text>
          )}
        </Card>
      </ScrollView>

      <PickerSheet
        visible={calendlyOpen || calendlyMarkOpen}
        title={
          calendlyMarkOpen
            ? t("prospects.markContactedPickMeetingTitle")
            : t("prospects.linkCalendlyTitle")
        }
        onClose={() => {
          setCalendlyOpen(false);
          setCalendlyMarkOpen(false);
        }}
      >
        {calendlyMarkOpen ? (
          <Text style={styles.muted}>{t("prospects.markContactedPickMeetingHint")}</Text>
        ) : null}
        {calendlyLoading ? (
          <Text style={styles.muted}>{t("common.loading")}</Text>
        ) : !calendlyConnected ? (
          <Text style={styles.muted}>{t("prospects.linkCalendlyNotConnected")}</Text>
        ) : calendlyEvents.length === 0 ? (
          <Text style={styles.muted}>
            {calendlyMarkOpen
              ? t("prospects.markContactedNoFreeMeetings")
              : t("prospects.linkCalendlyEmpty")}
          </Text>
        ) : (
          calendlyEvents.map((event) => (
            <Pressable
              key={event.id}
              onPress={() => setPickerId(event.id)}
              style={[styles.pickItem, pickerId === event.id ? styles.pickItemActive : null]}
            >
              <Text style={styles.strong}>{event.name}</Text>
              <Text style={styles.muted}>{formatHistoryDate(event.start_time, locale)}</Text>
            </Pressable>
          ))
        )}
        <Button
          title={
            calendlyMarkOpen
              ? t("prospects.markContactedPickMeetingAction")
              : t("prospects.linkPickerConfirm")
          }
          disabled={!pickerId || pickerSaving}
          loading={pickerSaving}
          onPress={() => pickerId && void handleLinkCalendly(pickerId, calendlyMarkOpen)}
        />
        {calendlyMarkOpen ? (
          <Button
            title={t("prospects.markContactedOtherChannel")}
            variant="secondary"
            disabled={pickerSaving}
            onPress={openManualContactNote}
          />
        ) : null}
      </PickerSheet>

      <ProspectContractsModal
        visible={contractsListOpen}
        envelopes={envelopes}
        locale={locale}
        token={token}
        onClose={() => setContractsListOpen(false)}
      />

      <ProspectPaymentsModal
        visible={paymentsListOpen}
        payments={payments}
        locale={locale}
        cancellingId={cancellingPaymentId}
        onCancel={canUpdate ? (id) => void handleCancelPayment(id) : undefined}
        onClose={() => setPaymentsListOpen(false)}
      />

      <SendContractModal
        visible={contractOpen}
        templates={templates}
        defaultTemplateId={docusign?.default_template_id}
        initialSigner={{ name: prospect.full_name, email: prospect.email }}
        prospectId={prospect.id}
        initialProspect={prospect}
        hideProspectSearch
        onClose={() => setContractOpen(false)}
        onSubmit={handleSendContract}
      />

      <PickerSheet
        visible={paymentOpen}
        title={t("prospects.createPaymentLink")}
        subtitle={prospect.full_name}
        onClose={() => setPaymentOpen(false)}
      >
        <PaymentLinkForm
          config={paymentConfig}
          submitting={paymentSaving}
          resetKey={paymentOpen ? `open-${prospect.id}` : "closed"}
          hideProspectSearch
          initialProspect={prospect}
          initialData={{
            customer_first_name: prospect.first_name,
            customer_last_name: prospect.last_name,
            customer_email: prospect.email,
            customer_phone: prospect.phone,
            prospect_id: prospect.id,
            send_email: true,
          }}
          onSubmit={handleCreatePayment}
        />
      </PickerSheet>

      <PickerSheet
        visible={linkPaymentOpen}
        title={t("prospects.linkExistingPayment")}
        onClose={() => setLinkPaymentOpen(false)}
      >
        {linkableLoading ? (
          <Text style={styles.muted}>{t("common.loading")}</Text>
        ) : unlinkedPayments.length === 0 ? (
          <Text style={styles.muted}>{t("prospects.linkExistingPaymentEmpty")}</Text>
        ) : (
          unlinkedPayments.map((link) => (
            <Pressable
              key={link.id}
              onPress={() => setPickerId(link.id)}
              style={[styles.pickItem, pickerId === link.id ? styles.pickItemActive : null]}
            >
              <Text style={styles.strong}>
                {link.currency} {Number(link.amount).toFixed(2)}
              </Text>
              <Text style={styles.muted}>{link.customer_email}</Text>
              <Text style={styles.muted}>
                {PAYMENT_STATUS_LABELS[link.status] ?? link.status}
              </Text>
            </Pressable>
          ))
        )}
        <Button
          title={t("prospects.linkPickerConfirm")}
          disabled={!pickerId || pickerSaving || linkableLoading}
          loading={pickerSaving}
          onPress={() => pickerId && void handleLinkPayment(pickerId)}
        />
      </PickerSheet>

      <PickerSheet
        visible={contactNoteOpen}
        title={t("prospects.markContactedTitle")}
        onClose={() => setContactNoteOpen(false)}
      >
        <Text style={styles.muted}>
          {t("prospects.markContactedConfirm", { name: prospect.full_name })}
        </Text>
        <TextInput
          value={contactNote}
          onChangeText={setContactNote}
          placeholder={t("prospects.markContactedChannelPlaceholder")}
          placeholderTextColor={colors.brownMuted}
          multiline
          style={styles.textareaTall}
          textAlignVertical="top"
        />
        <Button
          title={t("prospects.markContacted")}
          disabled={contactNote.trim().length < 5}
          onPress={() => {
            const note = contactNote.trim();
            setContactNoteOpen(false);
            void postMarkContacted(note).catch((err) => {
              Alert.alert(
                t("common.error"),
                getUserFacingErrorMessage(err, t("prospects.statusUpdateError")),
              );
            });
          }}
        />
      </PickerSheet>
    </KeyboardAvoidingView>
  );
}

function PickerSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.sheetBackdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <Button title={t("common.close")} variant="ghost" onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  email: {
    fontSize: 14,
    color: colors.soft,
    marginTop: -4,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    backgroundColor: colors.brandLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  badgeMuted: {
    backgroundColor: colors.creamWarm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  converted: {
    fontSize: 13,
    color: colors.brand,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  formGap: {
    gap: 10,
  },
  infoGrid: {
    gap: 8,
  },
  infoRow: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.brownMuted,
  },
  infoValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brown,
  },
  textarea: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 15,
  },
  textareaTall: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 15,
  },
  rowBtns: {
    flexDirection: "row",
    gap: 8,
  },
  flexBtn: {
    flex: 1,
  },
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
  strong: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  historyRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 2,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  historyNote: {
    fontSize: 13,
    color: colors.ink,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sheetHeaderText: {
    flex: 1,
    paddingRight: 8,
    gap: 2,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brown,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: colors.soft,
  },
  sheetBody: {
    padding: 16,
    gap: 10,
  },
  pickItem: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    padding: 12,
    gap: 2,
  },
  pickItemActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
});
