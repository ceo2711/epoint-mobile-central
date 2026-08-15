import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SalesRepList } from "@/components/staff/SalesRepList";
import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { SedeBranchList } from "@/components/staff/SedeBranchList";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { useAdminSedeScope } from "@/hooks/useAdminSedeScope";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { DocusignConnection, DocusignEnvelope } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

const STATUS_LABELS: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregado",
  completed: "Completado",
  declined: "Rechazado",
  voided: "Anulado",
  created: "Creado",
};

export default function ContratosScreen() {
  const { t } = useTranslation();
  const { token, isLoading: authLoading } = useAuth();
  const scope = useAdminSedeScope({ loadReps: true });
  const [connection, setConnection] = useState<DocusignConnection | null>(null);
  const [items, setItems] = useState<DocusignEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailEnabled =
    !scope.isGlobal || (scope.selectedSedeId != null && scope.selectedRepId != null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !detailEnabled) {
        setConnection(null);
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
            ? `?sent_by_user_id=${scope.selectedRepId}`
            : "";
        const [conn, list] = await Promise.all([
          api.get<DocusignConnection>("/docusign/connection", token),
          api.get<DocusignEnvelope[]>(`/docusign/envelopes${qs}`, token),
        ]);
        setConnection(conn);
        setItems(list);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("contracts.loadError")));
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

  if (authLoading || scope.loading) {
    return <ScreenState loading message="Cargando contratos…" />;
  }

  if (scope.showSedePicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <Text style={styles.title}>{t("contracts.title")}</Text>
        <Text style={styles.subtitle}>{t("scope.adminSedesHint")}</Text>
        <SedeBranchList branches={scope.branches} onSelect={scope.selectSede} />
      </ScrollView>
    );
  }

  if (scope.isGlobal && scope.showRepPicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <ScopePageHeader
          title={t("contracts.title")}
          backLabel={t("scope.backToSedes")}
          onBack={scope.clearSede}
        />
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

  if (loading && items.length === 0 && !error && !connection) {
    return <ScreenState loading message="Cargando contratos…" />;
  }

  const repName = scope.selectedRep
    ? `${scope.selectedRep.first_name} ${scope.selectedRep.last_name}`.trim()
    : null;

  return (
    <View style={styles.wrap}>
      <ScopePageHeader
        title={t("contracts.title")}
        backLabel={scope.isGlobal ? t("scope.backToReps") : undefined}
        onBack={scope.isGlobal ? scope.clearRep : undefined}
      />
      <Text style={styles.subtitle}>
        DocuSign: {connection?.connected ? "Conectado" : "Sin conexión"}
        {scope.selectedSede ? ` · ${scope.selectedSede.name}` : ""}
        {repName ? ` · ${repName}` : ""}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!connection?.connected ? (
        <Card>
          <Text style={styles.body}>
            DocuSign no está configurado. Completá la conexión desde la versión web.
          </Text>
        </Card>
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
            <Text style={styles.empty}>{t("contracts.empty")}</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.item}>
            <Text style={styles.name}>{item.subject}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {STATUS_LABELS[item.status] ?? item.status}
              </Text>
            </View>
            <Text style={styles.meta}>
              {item.signer_name} · {item.signer_email}
            </Text>
            {item.client_name ? (
              <Text style={styles.meta}>Cliente: {item.client_name}</Text>
            ) : null}
            <Text style={styles.meta}>
              Enviado: {new Date(item.sent_at).toLocaleString("es")}
            </Text>
            {item.completed_at ? (
              <Text style={styles.meta}>
                Completado: {new Date(item.completed_at).toLocaleString("es")}
              </Text>
            ) : null}
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
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    marginBottom: 10,
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  item: {
    backgroundColor: colors.white,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  badge: {
    alignSelf: "flex-start",
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
