import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { ProspectDetail } from "@/types/api";
import { PROSPECT_STATUS_LABELS } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

export default function ProspectoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, hasPermission, isLoading: authLoading } = useAuth();
  const [prospect, setProspect] = useState<ProspectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpdate = hasPermission("prospects:update");

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !id) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const data = await api.get<ProspectDetail>(`/prospects/${id}`, token);
        setProspect(data);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, "No se pudo cargar el prospecto"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, id],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  async function onMarkContacted() {
    if (!token || !id) return;
    setActing(true);
    setError(null);
    try {
      await api.post(`/prospects/${id}/mark-contacted`, {}, token);
      Alert.alert("Listo", "Prospecto marcado como contactado.");
      await load({ silent: true });
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo marcar como contactado"));
    } finally {
      setActing(false);
    }
  }

  if (authLoading || (loading && !prospect && !error)) {
    return <ScreenState loading message="Cargando prospecto…" />;
  }

  if (error && !prospect) {
    return <ScreenState message={error} />;
  }

  if (!prospect) {
    return <ScreenState message="Prospecto no encontrado" />;
  }

  const canMarkContacted =
    canUpdate && prospect.status === "PENDIENTE_CONTACTAR";

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
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
      <Text style={styles.title}>{prospect.full_name}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {PROSPECT_STATUS_LABELS[prospect.status] ?? prospect.status}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card title="Contacto">
        <Text style={styles.row}>Email: {prospect.email}</Text>
        <Text style={styles.row}>Teléfono: {prospect.phone}</Text>
        {prospect.source ? <Text style={styles.row}>Origen: {prospect.source}</Text> : null}
        {prospect.merchant_name ? (
          <Text style={styles.row}>Comercio: {prospect.merchant_name}</Text>
        ) : null}
        {prospect.assigned_to ? (
          <Text style={styles.row}>
            Asignado: {prospect.assigned_to.first_name} {prospect.assigned_to.last_name}
          </Text>
        ) : null}
        <Text style={styles.row}>
          Calificado: {prospect.is_qualified ? "Sí" : "No"}
        </Text>
      </Card>

      {prospect.notes ? (
        <Card title="Notas">
          <Text style={styles.notes}>{prospect.notes}</Text>
        </Card>
      ) : null}

      {prospect.calendly_event ? (
        <Card title="Calendly">
          <Text style={styles.row}>{prospect.calendly_event.name}</Text>
          <Text style={styles.muted}>
            {new Date(prospect.calendly_event.start_time).toLocaleString("es")}
          </Text>
        </Card>
      ) : null}

      {prospect.payment_link ? (
        <Card title="Pago">
          <Text style={styles.row}>
            {prospect.payment_link.amount} {prospect.payment_link.currency} ·{" "}
            {prospect.payment_link.status}
          </Text>
        </Card>
      ) : null}

      {prospect.docusign_envelope ? (
        <Card title="Contrato">
          <Text style={styles.row}>{prospect.docusign_envelope.subject}</Text>
          <Text style={styles.muted}>{prospect.docusign_envelope.status}</Text>
        </Card>
      ) : null}

      {canMarkContacted ? (
        <Button
          title="Marcar contactado"
          fullWidth
          loading={acting}
          onPress={() => void onMarkContacted()}
        />
      ) : null}

      {prospect.history?.length ? (
        <Card title="Historial">
          {prospect.history.slice(0, 8).map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <Text style={styles.historyTitle}>
                {entry.event_type}
                {entry.to_status
                  ? ` → ${PROSPECT_STATUS_LABELS[entry.to_status] ?? entry.to_status}`
                  : ""}
              </Text>
              {entry.note ? <Text style={styles.muted}>{entry.note}</Text> : null}
              <Text style={styles.muted}>
                {entry.changed_by_name ?? "Sistema"} ·{" "}
                {new Date(entry.created_at).toLocaleString("es")}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
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
    paddingBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.brown,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.brand,
  },
  row: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  notes: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 21,
  },
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
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
});
