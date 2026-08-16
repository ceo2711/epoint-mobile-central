import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ScreenState } from "@/components/ui/ScreenState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { ClientSalesPipelineSection } from "@/features/clients/ClientSalesPipelineSection";
import {
  canContactClientAdvisor,
  canEditClientProfile,
  canManageClientAdvisor,
  canViewApprovedClientWorkspace,
  canViewClientOnboardingWorkspace,
} from "@/features/clients/client-access";
import { ClientBoardPanel } from "@/features/clients/components/ClientBoardPanel";
import { ClientDocumentsPanel } from "@/features/clients/components/ClientDocumentsPanel";
import { ClientPortalCredentialsCard } from "@/features/clients/components/ClientPortalCredentialsCard";
import {
  CLIENT_SOURCE_LABELS,
  CLIENT_SOURCE_VALUES,
  type ClientSourceValue,
} from "@/features/clients/constants";
import { formatDate, formatDateTime } from "@/features/clients/format";
import { savePortalTempPassword } from "@/features/clients/portal-credentials";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type {
  AdvisorBrief,
  Client,
  ClientAvailability,
  ClientSourceProspect,
  DocusignEnvelope,
  MerchantBrief,
} from "@/types/api";
import { colors, radii } from "@/theme/tokens";

type WorkspaceTab = "resumen" | "documentos" | "tablero";
type AdvisorPickerMode = "approve" | "reassign" | null;

interface EditForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  merchant_id: string;
  date_of_birth: string;
  ssn: string;
}

function emptyEditForm(client: Client): EditForm {
  return {
    first_name: client.first_name,
    last_name: client.last_name,
    email: client.email,
    phone: client.phone,
    source: client.source ?? "",
    merchant_id: client.merchant ? String(client.merchant.id) : "",
    date_of_birth: client.date_of_birth ?? "",
    ssn: "",
  };
}

function asProspect(value: Client["source_prospect"]): ClientSourceProspect | null {
  if (!value || typeof value !== "object") return null;
  return value;
}

export default function ClienteDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Number(idParam);
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { token, user, hasPermission, isLoading: authLoading } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [advisors, setAdvisors] = useState<AdvisorBrief[]>([]);
  const [merchants, setMerchants] = useState<MerchantBrief[]>([]);
  const [envelopes, setEnvelopes] = useState<DocusignEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [pickAdvisor, setPickAdvisor] = useState<AdvisorPickerMode>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [availability, setAvailability] = useState<ClientAvailability | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>("resumen");
  const [syncingDocusign, setSyncingDocusign] = useState(false);

  const canApprove = hasPermission("clients:approve");
  const canUpdate = hasPermission("clients:update");
  const canDelete = hasPermission("clients:delete");
  const showWorkspace = canViewApprovedClientWorkspace(user, client);
  const canEdit = canEditClientProfile(user, client, canUpdate);
  const canManageAdvisor = canManageClientAdvisor(user, client, canApprove);
  const canContactAdvisor = canContactClientAdvisor(user, client);
  const canManageBoard = canViewClientOnboardingWorkspace(user);

  const loadAdvisors = useCallback(async () => {
    if (!token) return;
    try {
      const list = await api.get<AdvisorBrief[]>("/advisors", token);
      setAdvisors(list);
    } catch {
      setAdvisors([]);
    }
  }, [token]);

  const loadEnvelopes = useCallback(async () => {
    if (!token || !id || Number.isNaN(id)) return;
    try {
      const list = await api.get<DocusignEnvelope[]>(
        `/docusign/clients/${id}/envelopes`,
        token,
      );
      setEnvelopes(list);
    } catch {
      setEnvelopes([]);
    }
  }, [token, id]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !id || Number.isNaN(id)) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const data = await api.get<Client>(`/clients/${id}`, token);
        setClient(data);

        const needsAdvisors =
          canApprove ||
          canManageClientAdvisor(user, data, canApprove);
        if (needsAdvisors) {
          await loadAdvisors();
        }

        if (canViewApprovedClientWorkspace(user, data)) {
          await loadEnvelopes();
        }
      } catch (err) {
        setError(getUserFacingErrorMessage(err, "No se pudo cargar el cliente"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, id, canApprove, user, loadAdvisors, loadEnvelopes],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  useEffect(() => {
    if (!editing || !token) return;
    let cancelled = false;
    void (async () => {
      try {
        const opts = await api.get<MerchantBrief[]>("/merchants/options", token);
        if (!cancelled) setMerchants(opts);
      } catch {
        if (!cancelled) setMerchants([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editing, token]);

  useEffect(() => {
    if (!editing || !editForm || !token || !id) {
      setAvailability(null);
      return;
    }
    const email = editForm.email.trim();
    const phone = editForm.phone.trim();
    const emailOk = email.includes("@") && email.includes(".");
    const phoneOk = phone.length >= 5;
    if (!emailOk && !phoneOk) {
      setAvailability(null);
      return;
    }

    const handle = setTimeout(() => {
      void (async () => {
        setCheckingAvailability(true);
        try {
          const params = new URLSearchParams({ exclude_client_id: String(id) });
          if (emailOk) params.set("email", email);
          if (phoneOk) params.set("phone", phone);
          const res = await api.get<ClientAvailability>(
            `/clients/check-availability?${params.toString()}`,
            token,
          );
          setAvailability(res);
        } catch {
          setAvailability(null);
        } finally {
          setCheckingAvailability(false);
        }
      })();
    }, 400);

    return () => clearTimeout(handle);
  }, [editing, editForm, token, id]);

  const hasConflict = Boolean(availability?.email || availability?.phone);

  const prospect = useMemo(() => asProspect(client?.source_prospect), [client]);

  async function doApprove(advisorUserId: number) {
    if (!token || !id) return;
    setActing(true);
    setError(null);
    try {
      const res = await api.post<{ client: Client; temp_password: string }>(
        `/clients/${id}/approve`,
        { advisor_user_id: advisorUserId },
        token,
      );
      if (res.temp_password) {
        await savePortalTempPassword(id, res.temp_password);
      }
      setPickAdvisor(null);
      Alert.alert(
        "Cliente aprobado",
        res.temp_password
          ? `Se asignó el asesor. Contraseña temporal del portal:\n${res.temp_password}`
          : "Se asignó el asesor y se habilitó el portal.",
      );
      await load({ silent: true });
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo aprobar el cliente"));
    } finally {
      setActing(false);
    }
  }

  async function doReassign(advisorUserId: number) {
    if (!token || !id) return;
    setActing(true);
    setError(null);
    try {
      await api.patch(`/clients/${id}/advisor`, { advisor_user_id: advisorUserId }, token);
      setPickAdvisor(null);
      Alert.alert("Asesor actualizado", "Se reasignó el asesor del cliente.");
      await load({ silent: true });
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo reasignar el asesor"));
    } finally {
      setActing(false);
    }
  }

  function onApprovePress() {
    if (advisors.length === 0) {
      void loadAdvisors().then(() => {
        setError("No hay asesores activos para asignar");
      });
      setError("No hay asesores activos para asignar");
      return;
    }
    if (advisors.length === 1) {
      void doApprove(advisors[0].id);
      return;
    }
    setPickAdvisor("approve");
    setRejectOpen(false);
  }

  async function onReject() {
    if (!token || !id) return;
    if (rejectReason.trim().length < 5) {
      setError("El motivo debe tener al menos 5 caracteres");
      return;
    }
    setActing(true);
    setError(null);
    try {
      await api.post(`/clients/${id}/reject`, { reason: rejectReason.trim() }, token);
      setRejectOpen(false);
      setRejectReason("");
      Alert.alert("Cliente rechazado", "Se registró el motivo de rechazo.");
      await load({ silent: true });
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo rechazar el cliente"));
    } finally {
      setActing(false);
    }
  }

  async function onResubmit() {
    if (!token || !id) return;
    setActing(true);
    setError(null);
    try {
      await api.post(`/clients/${id}/resubmit`, {}, token);
      Alert.alert("Reenviado", "El cliente volvió a pendiente de revisión.");
      await load({ silent: true });
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo reenviar el cliente"));
    } finally {
      setActing(false);
    }
  }

  function onDelete() {
    Alert.alert(
      "Eliminar cliente",
      "¿Seguro que querés eliminar este cliente? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => void doDelete(),
        },
      ],
    );
  }

  async function doDelete() {
    if (!token || !id) return;
    setActing(true);
    setError(null);
    try {
      await api.post(`/clients/${id}/delete`, {}, token);
      router.replace("/(staff)/(tabs)/clientes");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo eliminar el cliente"));
      setActing(false);
    }
  }

  function startEdit() {
    if (!client) return;
    setEditForm(emptyEditForm(client));
    setEditing(true);
    setError(null);
  }

  function cancelEdit() {
    setEditing(false);
    setEditForm(null);
    setAvailability(null);
  }

  async function saveEdit() {
    if (!token || !id || !editForm || !client) return;
    if (hasConflict || checkingAvailability) return;

    setActing(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        source: editForm.source.trim() || null,
        merchant_id: editForm.merchant_id ? Number(editForm.merchant_id) : null,
      };

      if (showWorkspace) {
        if (editForm.date_of_birth.trim()) {
          body.date_of_birth = editForm.date_of_birth.trim();
        }
        if (editForm.ssn.trim()) {
          body.ssn = editForm.ssn.trim();
        }
      }

      const updated = await api.patch<Client>(`/clients/${id}`, body, token);
      setClient(updated);
      setEditing(false);
      setEditForm(null);
      Alert.alert("Guardado", "Los datos del cliente se actualizaron.");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo guardar el cliente"));
    } finally {
      setActing(false);
    }
  }

  async function syncDocusign() {
    if (!token) return;
    setSyncingDocusign(true);
    setError(null);
    try {
      await api.post(`/docusign/envelopes/sync-pending`, {}, token);
      await loadEnvelopes();
      Alert.alert("DocuSign", "Sincronización de sobres pendientes iniciada.");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo sincronizar DocuSign"));
    } finally {
      setSyncingDocusign(false);
    }
  }

  if (authLoading || (loading && !client && !error)) {
    return <ScreenState loading message="Cargando cliente…" />;
  }

  if (error && !client) {
    return <ScreenState message={error} />;
  }

  if (!client || Number.isNaN(id)) {
    return <ScreenState message="Cliente no encontrado" />;
  }

  const pending = client.status === "PENDIENTE_DE_REVISION";
  const rejected = client.status === "RECHAZADO";
  const sourceLabel =
    client.source && client.source in CLIENT_SOURCE_LABELS
      ? CLIENT_SOURCE_LABELS[client.source as ClientSourceValue]
      : client.source;

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
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
    >
      <Text style={styles.eyebrow}>{t("clientDetail.title")}</Text>
      <ScopePageHeader
        title={`${client.first_name} ${client.last_name}`}
        backLabel={t("common.back")}
        onBack={() => router.back()}
      />
      <Text style={styles.email}>{client.email}</Text>
      <Card>
        <Text style={styles.sectionLabel}>{t("common.status")}</Text>
        <View style={styles.headerMeta}>
          <StatusBadge status={client.status} />
          <View
            style={[
              styles.qualifyBadge,
              (client.is_qualified ?? prospect?.is_qualified ?? true)
                ? styles.qualifyYes
                : styles.qualifyNo,
            ]}
          >
            <Text
              style={[
                styles.qualifyText,
                (client.is_qualified ?? prospect?.is_qualified ?? true)
                  ? styles.qualifyTextYes
                  : styles.qualifyTextNo,
              ]}
            >
              {(client.is_qualified ?? prospect?.is_qualified ?? true)
                ? t("prospects.qualified")
                : t("prospects.unqualified")}
            </Text>
          </View>
        </View>
        <Text style={styles.idLabel}>ID #{client.id}</Text>
        {client.rejection_reason ? (
          <Text style={styles.rejection}>
            Motivo: {client.rejection_reason}
          </Text>
        ) : null}
      </Card>

      {(!showWorkspace || tab === "resumen") ? (
        <Card>
          <Text style={styles.sectionLabel}>{t("clientDetail.overview")}</Text>
          <View style={styles.infoGrid}>
            <InfoRow label={t("common.firstName")} value={client.first_name} />
            <InfoRow label={t("common.lastName")} value={client.last_name} />
            <InfoRow label={t("common.email")} value={client.email} />
            <InfoRow label={t("clientDetail.phone")} value={client.phone} />
            <InfoRow label={t("clients.source")} value={sourceLabel || "—"} />
            <InfoRow
              label={t("clients.merchant")}
              value={client.merchant?.name ?? "—"}
            />
            {showWorkspace ? (
              <>
                <InfoRow
                  label={t("clientDetail.dateOfBirth")}
                  value={formatDate(client.date_of_birth)}
                />
                <InfoRow
                  label={t("clientDetail.hasSsn")}
                  value={client.has_ssn ? t("common.yes") : t("common.no")}
                />
              </>
            ) : null}
          </View>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Actions */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsRow}
      >
        {pending && canApprove ? (
          <Button title="Aprobar" loading={acting} onPress={onApprovePress} />
        ) : null}
        {pending && canApprove ? (
          <Button
            title="Rechazar"
            variant="danger"
            disabled={acting}
            onPress={() => {
              setRejectOpen(true);
              setPickAdvisor(null);
            }}
          />
        ) : null}
        {rejected && canUpdate ? (
          <Button
            title="Reenviar"
            variant="secondary"
            loading={acting}
            onPress={() => void onResubmit()}
          />
        ) : null}
        {canEdit ? (
          <Button
            title={editing ? "Cancelar edición" : "Editar"}
            variant="secondary"
            onPress={() => (editing ? cancelEdit() : startEdit())}
          />
        ) : null}
        {canDelete ? (
          <Button
            title="Eliminar"
            variant="danger"
            disabled={acting}
            onPress={onDelete}
          />
        ) : null}
      </ScrollView>

      {pickAdvisor === "approve" ? (
        <Card title="Elegí un asesor">
          {advisors.map((a) => (
            <Pressable
              key={a.id}
              style={styles.option}
              disabled={acting}
              onPress={() => void doApprove(a.id)}
            >
              <Text style={styles.optionName}>
                {a.first_name} {a.last_name}
              </Text>
              <Text style={styles.muted}>{a.email}</Text>
            </Pressable>
          ))}
          <Button title="Cancelar" variant="ghost" fullWidth onPress={() => setPickAdvisor(null)} />
        </Card>
      ) : null}

      {rejectOpen ? (
        <Card title="Rechazar cliente">
          <Input
            label="Motivo del rechazo"
            value={rejectReason}
            onChangeText={setRejectReason}
            placeholder="Mínimo 5 caracteres"
            multiline
          />
          <Button
            title="Confirmar rechazo"
            variant="danger"
            fullWidth
            loading={acting}
            onPress={() => void onReject()}
          />
          <Button
            title="Cancelar"
            variant="ghost"
            fullWidth
            onPress={() => {
              setRejectOpen(false);
              setRejectReason("");
            }}
          />
        </Card>
      ) : null}

      {/* Edit form */}
      {editing && editForm ? (
        <Card title="Editar perfil">
          <Input
            label="Nombre"
            value={editForm.first_name}
            onChangeText={(v) => setEditForm({ ...editForm, first_name: v })}
          />
          <Input
            label="Apellido"
            value={editForm.last_name}
            onChangeText={(v) => setEditForm({ ...editForm, last_name: v })}
          />
          <Input
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={editForm.email}
            onChangeText={(v) => setEditForm({ ...editForm, email: v })}
          />
          <Input
            label="Teléfono"
            keyboardType="phone-pad"
            value={editForm.phone}
            onChangeText={(v) => setEditForm({ ...editForm, phone: v })}
          />

          <Text style={styles.fieldLabel}>Fuente</Text>
          <View style={styles.chipWrap}>
            <Pressable
              style={[styles.chip, !editForm.source ? styles.chipActive : null]}
              onPress={() => setEditForm({ ...editForm, source: "" })}
            >
              <Text style={styles.chipText}>Sin fuente</Text>
            </Pressable>
            {CLIENT_SOURCE_VALUES.map((src) => (
              <Pressable
                key={src}
                style={[
                  styles.chip,
                  editForm.source === src ? styles.chipActive : null,
                ]}
                onPress={() => setEditForm({ ...editForm, source: src })}
              >
                <Text style={styles.chipText}>{CLIENT_SOURCE_LABELS[src]}</Text>
              </Pressable>
            ))}
          </View>

          {merchants.length > 0 ? (
            <>
              <Text style={styles.fieldLabel}>Comercio</Text>
              <View style={styles.chipWrap}>
                <Pressable
                  style={[
                    styles.chip,
                    !editForm.merchant_id ? styles.chipActive : null,
                  ]}
                  onPress={() => setEditForm({ ...editForm, merchant_id: "" })}
                >
                  <Text style={styles.chipText}>Sin comercio</Text>
                </Pressable>
                {merchants.map((m) => (
                  <Pressable
                    key={m.id}
                    style={[
                      styles.chip,
                      editForm.merchant_id === String(m.id)
                        ? styles.chipActive
                        : null,
                    ]}
                    onPress={() =>
                      setEditForm({ ...editForm, merchant_id: String(m.id) })
                    }
                  >
                    <Text style={styles.chipText}>{m.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {showWorkspace ? (
            <>
              <Input
                label="Fecha de nacimiento (YYYY-MM-DD)"
                value={editForm.date_of_birth}
                onChangeText={(v) =>
                  setEditForm({ ...editForm, date_of_birth: v })
                }
                placeholder="1990-01-15"
              />
              <Input
                label="SSN"
                value={editForm.ssn}
                onChangeText={(v) => setEditForm({ ...editForm, ssn: v })}
                placeholder={
                  client.has_ssn
                    ? "Dejá vacío para no cambiar"
                    : "Opcional"
                }
                secureTextEntry
              />
            </>
          ) : null}

          {checkingAvailability ? (
            <Text style={styles.muted}>Verificando disponibilidad…</Text>
          ) : null}
          {availability?.email ? (
            <Text style={styles.error}>
              Este email ya está registrado por {availability.email.client_name}{" "}
              (cliente #{availability.email.client_id})
            </Text>
          ) : null}
          {availability?.phone ? (
            <Text style={styles.error}>
              Este teléfono ya está registrado por {availability.phone.client_name}{" "}
              (cliente #{availability.phone.client_id})
            </Text>
          ) : null}

          <Button
            title="Guardar cambios"
            fullWidth
            loading={acting}
            disabled={hasConflict || checkingAvailability}
            onPress={() => void saveEdit()}
          />
        </Card>
      ) : null}

      {/* Workspace tabs */}
      {showWorkspace ? (
        <View style={styles.tabs}>
          {(
            [
              ["resumen", "Resumen"],
              ["documentos", "Documentos"],
              ["tablero", "Tablero"],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.tab, tab === key ? styles.tabActive : null]}
              onPress={() => setTab(key)}
            >
              <Text
                style={[styles.tabText, tab === key ? styles.tabTextActive : null]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Documents / Board tabs */}
      {showWorkspace && tab === "documentos" && token ? (
        <ClientDocumentsPanel
          key={client.id}
          clientId={client.id}
          token={token}
          initialDocuments={client.documents ?? []}
        />
      ) : null}

      {showWorkspace && tab === "tablero" && token ? (
        <ClientBoardPanel
          clientId={client.id}
          token={token}
          canManage={canManageBoard}
        />
      ) : null}

      {/* Overview (always, or when resumen tab) */}
      {(!showWorkspace || tab === "resumen") && (
        <>
          {prospect ? (
            <ClientSalesPipelineSection
              sourceProspect={prospect}
              locale={locale}
              token={token}
            />
          ) : null}

          {(client.addresses?.length ?? 0) > 0 ? (
            <Card title="Direcciones">
              {client.addresses!.map((addr) => (
                <View key={addr.id} style={styles.block}>
                  <Text style={styles.optionName}>{addr.type}</Text>
                  <Text style={styles.row}>
                    {addr.street}, {addr.city}, {addr.state} {addr.zip_code}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {(client.vehicles?.length ?? 0) > 0 ? (
            <Card title="Vehículos">
              {client.vehicles!.map((v) => (
                <Text key={v.id} style={styles.row}>
                  #{v.order}: {v.year} {v.model} ({v.color})
                </Text>
              ))}
            </Card>
          ) : null}

          {showWorkspace &&
          client.has_portal_access &&
          token ? (
            <ClientPortalCredentialsCard
              client={client}
              token={token}
              canReset={canApprove}
            />
          ) : null}

          {/* Advisor */}
          {canManageAdvisor ? (
            <Card title="Asesor">
              {client.advisor ? (
                <Text style={styles.row}>
                  Actual: {client.advisor.first_name} {client.advisor.last_name} (
                  {client.advisor.email})
                </Text>
              ) : (
                <Text style={styles.muted}>Sin asesor asignado</Text>
              )}
              {pickAdvisor === "reassign" ? (
                <View style={styles.gap}>
                  {advisors.map((a) => (
                    <Pressable
                      key={a.id}
                      style={styles.option}
                      disabled={acting}
                      onPress={() => void doReassign(a.id)}
                    >
                      <Text style={styles.optionName}>
                        {a.first_name} {a.last_name}
                      </Text>
                      <Text style={styles.muted}>{a.email}</Text>
                    </Pressable>
                  ))}
                  <Button
                    title="Cancelar"
                    variant="ghost"
                    fullWidth
                    onPress={() => setPickAdvisor(null)}
                  />
                </View>
              ) : (
                <Button
                  title="Reasignar asesor"
                  variant="secondary"
                  fullWidth
                  onPress={() => {
                    void loadAdvisors();
                    setPickAdvisor("reassign");
                  }}
                />
              )}
            </Card>
          ) : canContactAdvisor && client.advisor?.email ? (
            <Card title="Asesor">
              <Text style={styles.row}>
                {client.advisor.first_name} {client.advisor.last_name}
              </Text>
              <Button
                title="Contactar asesor"
                variant="secondary"
                fullWidth
                onPress={() =>
                  void Linking.openURL(`mailto:${client.advisor!.email}`)
                }
              />
            </Card>
          ) : null}

          {/* DocuSign */}
          {showWorkspace ? (
            <Card title="DocuSign">
              {envelopes.length === 0 ? (
                <Text style={styles.muted}>Sin sobres para este cliente.</Text>
              ) : (
                envelopes.map((env) => (
                  <View key={env.id} style={styles.block}>
                    <Text style={styles.optionName}>{env.subject}</Text>
                    <Text style={styles.muted}>{env.status}</Text>
                    <Text style={styles.muted}>
                      Enviado: {formatDateTime(env.sent_at)}
                    </Text>
                  </View>
                ))
              )}
              <Button
                title="Sincronizar pendientes"
                variant="secondary"
                fullWidth
                loading={syncingDocusign}
                onPress={() => void syncDocusign()}
              />
            </Card>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.brown,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.brownMuted,
  },
  email: {
    fontSize: 14,
    color: colors.soft,
    marginTop: -4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.brownMuted,
  },
  infoGrid: {
    gap: 8,
  },
  infoCell: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.brownMuted,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  idLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.soft,
    marginTop: 4,
  },
  qualifyBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  qualifyYes: {
    backgroundColor: colors.brandLight,
  },
  qualifyNo: {
    backgroundColor: colors.creamWarm,
  },
  qualifyText: {
    fontSize: 12,
    fontWeight: "700",
  },
  qualifyTextYes: {
    color: colors.brand,
  },
  qualifyTextNo: {
    color: colors.soft,
  },
  actionsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  row: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
  rejection: {
    fontSize: 13,
    color: colors.danger,
    marginTop: 4,
  },
  option: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    padding: 12,
    gap: 2,
  },
  optionName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brown,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brown,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.creamSoft,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.control - 2,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.white,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.soft,
  },
  tabTextActive: {
    color: colors.brand,
  },
  block: {
    gap: 2,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  gap: {
    gap: 8,
  },
});

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "—"}</Text>
    </View>
  );
}
