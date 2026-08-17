import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  SendContractModal,
  type SendContractPayload,
} from "@/features/docusign/SendContractModal";
import { ProspectContractsModal } from "@/features/prospects/ProspectContractsModal";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { canAccessDocusign } from "@/lib/roles";
import { colors } from "@/theme/tokens";
import type {
  DocusignConnection,
  DocusignEnvelope,
  ProspectEnvelopeBrief,
  User,
} from "@/types/api";

type ClientContractsPanelProps = {
  clientId: number;
  clientName: string;
  clientEmail: string;
  locale: string;
  token: string;
  user: User | null;
};

function toBrief(envelope: DocusignEnvelope): ProspectEnvelopeBrief {
  return {
    id: envelope.id,
    subject: envelope.subject,
    status: envelope.status,
    signer_name: envelope.signer_name,
    signer_email: envelope.signer_email,
    sent_at: envelope.sent_at,
    completed_at: envelope.completed_at,
  };
}

export function ClientContractsPanel({
  clientId,
  clientName,
  clientEmail,
  locale,
  token,
  user,
}: ClientContractsPanelProps) {
  const { t } = useTranslation();
  const canOperate = canAccessDocusign(user);
  const [envelopes, setEnvelopes] = useState<DocusignEnvelope[]>([]);
  const [connection, setConnection] = useState<DocusignConnection | null>(null);
  const [templates, setTemplates] = useState<{ template_id: string; name: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await api.get<DocusignEnvelope[]>(
        `/docusign/clients/${clientId}/envelopes`,
        token,
      );
      setEnvelopes(list);
    } catch (err) {
      setEnvelopes([]);
      setError(getUserFacingErrorMessage(err, t("contracts.loadError")));
    }
  }, [clientId, token, t]);

  const loadConnection = useCallback(async () => {
    if (!canOperate) return;
    try {
      const conn = await api.get<DocusignConnection>("/docusign/connection", token);
      setConnection(conn);
      if (conn.connected) {
        const tpls = await api.get<{ template_id: string; name: string }[]>(
          "/docusign/templates",
          token,
        );
        setTemplates(tpls);
      } else {
        setTemplates([]);
      }
    } catch {
      setConnection(null);
      setTemplates([]);
    }
  }, [canOperate, token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      await Promise.all([load(), loadConnection()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load, loadConnection]);

  async function syncAll() {
    if (!canOperate) return;
    setSyncing(true);
    setError(null);
    try {
      await api.post("/docusign/envelopes/sync-pending", {}, token);
      await load();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("contracts.loadError")));
    } finally {
      setSyncing(false);
    }
  }

  async function handleSend(payload: SendContractPayload) {
    await api.post(
      "/docusign/envelopes",
      {
        ...payload,
        client_id: clientId,
        signer_name: clientName.trim(),
        signer_email: clientEmail.trim(),
      },
      token,
    );
    await load();
  }

  const canSend = Boolean(connection?.connected && templates.length > 0);
  const briefs = envelopes.map(toBrief);

  return (
    <Card title={t("clientDetail.contractsTitle")}>
      <Text style={styles.subtitle}>{t("clientDetail.contractsSubtitle")}</Text>
      {connection && !connection.connected ? (
        <Text style={styles.muted}>{t("contracts.notConfigured")}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <Text style={styles.muted}>{t("common.loading")}</Text>
      ) : envelopes.length === 0 ? (
        <Text style={styles.muted}>{t("clientDetail.noContracts")}</Text>
      ) : (
        envelopes.map((env) => (
          <View key={env.id} style={styles.block}>
            <Text style={styles.optionName}>{env.subject}</Text>
            <Text style={styles.muted}>{env.status}</Text>
          </View>
        ))
      )}

      {envelopes.length > 0 ? (
        <Button
          title={t("contracts.viewList")}
          variant="secondary"
          fullWidth
          onPress={() => setPreviewOpen(true)}
        />
      ) : null}

      {canOperate ? (
        <View style={styles.actions}>
          <Button
            title={t("contracts.send")}
            fullWidth
            disabled={!canSend}
            onPress={() => setSendOpen(true)}
          />
          <Button
            title={syncing ? t("contracts.syncing") : t("contracts.sync")}
            variant="secondary"
            fullWidth
            loading={syncing}
            onPress={() => void syncAll()}
          />
        </View>
      ) : null}

      <SendContractModal
        visible={sendOpen}
        templates={templates}
        defaultTemplateId={connection?.default_template_id}
        initialSigner={{ name: clientName, email: clientEmail }}
        hideProspectSearch
        onClose={() => setSendOpen(false)}
        onSubmit={handleSend}
      />
      <ProspectContractsModal
        visible={previewOpen}
        envelopes={briefs}
        locale={locale}
        token={token}
        onClose={() => setPreviewOpen(false)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.soft,
    marginBottom: 8,
  },
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    marginBottom: 8,
  },
  block: {
    paddingVertical: 8,
    gap: 2,
  },
  optionName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  actions: {
    marginTop: 8,
    gap: 8,
  },
});
