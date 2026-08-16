import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { useTranslation } from "@/contexts/LanguageContext";
import { pipelineFromSourceProspect } from "@/features/clients/sourceProspect";
import { ProspectContractsModal } from "@/features/prospects/ProspectContractsModal";
import { ProspectHistoryTimeline } from "@/features/prospects/ProspectHistoryTimeline";
import { ProspectLinkedResources } from "@/features/prospects/ProspectLinkedResources";
import { ProspectPaymentsModal } from "@/features/prospects/ProspectPaymentsModal";
import { findContactHistory } from "@/features/prospects/utils/pipeline";
import type { ClientSourceProspect } from "@/types/api";

type ClientSalesPipelineSectionProps = {
  sourceProspect: ClientSourceProspect;
  locale: string;
  token: string | null;
};

export function ClientSalesPipelineSection({
  sourceProspect,
  locale,
  token,
}: ClientSalesPipelineSectionProps) {
  const { t } = useTranslation();
  const [contractsOpen, setContractsOpen] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const pipeline = pipelineFromSourceProspect(sourceProspect);
  const contactHistory = findContactHistory(pipeline.history);

  return (
    <View style={styles.wrap}>
      <ProspectLinkedResources
        locale={locale}
        prospectStatus={pipeline.status}
        calendly={pipeline.calendly}
        envelopes={pipeline.envelopes}
        payment={pipeline.payment}
        payments={pipeline.payments}
        history={pipeline.history}
        canManage={false}
        clientView
        contactNote={contactHistory?.note ?? null}
        contactNoteBy={contactHistory?.changed_by_name ?? null}
        contactNoteAt={contactHistory?.created_at ?? null}
        onViewContracts={
          pipeline.envelopes.length > 0 ? () => setContractsOpen(true) : undefined
        }
        onViewPayments={
          pipeline.payments.length > 0 ? () => setPaymentsOpen(true) : undefined
        }
      />

      {pipeline.history.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle}>{t("prospects.history.title")}</Text>
          <ProspectHistoryTimeline history={pipeline.history} locale={locale} />
        </Card>
      ) : null}

      <ProspectContractsModal
        visible={contractsOpen}
        envelopes={pipeline.envelopes}
        locale={locale}
        token={token}
        onClose={() => setContractsOpen(false)}
      />
      <ProspectPaymentsModal
        visible={paymentsOpen}
        payments={pipeline.payments}
        locale={locale}
        onClose={() => setPaymentsOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#a8a29c",
  },
});
