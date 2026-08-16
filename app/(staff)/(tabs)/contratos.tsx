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
import { SalesToolsScopeToggle } from "@/components/staff/SalesToolsScopeToggle";
import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { SedeBranchList } from "@/components/staff/SedeBranchList";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { SendContractModal } from "@/features/docusign/SendContractModal";
import { useAdminSedeScope } from "@/hooks/useAdminSedeScope";
import { useSalesToolsScope } from "@/hooks/useSalesToolsScope";
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
  const tools = useSalesToolsScope();
  const scope = useAdminSedeScope({
    loadReps: tools.viewingTeam,
    pickRep: tools.viewingTeam,
  });
  const [connection, setConnection] = useState<DocusignConnection | null>(null);
  const [items, setItems] = useState<DocusignEnvelope[]>([]);
  const [templates, setTemplates] = useState<{ template_id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const detailEnabled = !scope.needsRepPicker || scope.selectedRepId != null;
  const sedeName = scope.selectedSede?.name ?? scope.ownSede?.name ?? null;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !detailEnabled) {
        setConnection(null);
        setItems([]);
        setLoading(Boolean(token && !detailEnabled));
        setRefreshing(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const qs =
          scope.needsRepPicker && scope.selectedRepId != null
            ? `?sent_by_user_id=${scope.selectedRepId}`
            : "";
        const [conn, list, tpls] = await Promise.all([
          api.get<DocusignConnection>("/docusign/connection", token),
          api.get<DocusignEnvelope[]>(`/docusign/envelopes${qs}`, token),
          tools.viewingOwn
            ? api.get<{ template_id: string; name: string }[]>("/docusign/templates", token)
            : Promise.resolve([]),
        ]);
        setConnection(conn);
        setItems(list);
        setTemplates(tpls);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("contracts.loadError")));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, detailEnabled, scope.needsRepPicker, scope.selectedRepId, t, tools.viewingOwn],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  async function handleSend(payload: {
    signer_name: string;
    signer_email: string;
    subject?: string;
    template_id?: string;
    prospect_id?: number;
  }) {
    if (!token) return;
    setError(null);
    await api.post("/docusign/envelopes", payload, token);
    await load({ silent: true });
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
    return <ScreenState loading message="Cargando contratos…" />;
  }

  if (scope.showSedePicker) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pickerContent}>
        <Text style={styles.title}>{t("contracts.title")}</Text>
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
          title={t("contracts.title")}
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
        backLabel={scope.needsRepPicker ? t("scope.backToReps") : undefined}
        onBack={scope.needsRepPicker ? scope.clearRep : undefined}
      />
      {toolsToggle}
      <Text style={styles.subtitle}>
        DocuSign: {connection?.connected ? "Conectado" : "Sin conexión"}
        {sedeName ? ` · ${sedeName}` : ""}
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

      {tools.viewingOwn && connection?.connected ? (
        <Button
          title={t("contracts.send")}
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
      <SendContractModal
        visible={formOpen}
        templates={templates}
        defaultTemplateId={connection?.default_template_id}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSend}
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
