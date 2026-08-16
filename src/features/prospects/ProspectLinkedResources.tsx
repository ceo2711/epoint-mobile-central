import { useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  CancelPaymentIconButton,
  confirmCancelPaymentLink,
} from "@/features/payments/CancelPaymentIconButton";
import {
  isContractStepComplete,
  isMeetingStepComplete,
  isPaymentStepComplete,
  isReadyForClientConversion,
  pickPreferredPayment,
} from "@/features/prospects/utils/pipeline";
import { colors, radii } from "@/theme/tokens";
import type {
  ProspectCalendlyBrief,
  ProspectEnvelopeBrief,
  ProspectHistoryEntry,
  ProspectPaymentBrief,
} from "@/types/api";
import { PAYMENT_STATUS_LABELS } from "@/types/api";

const ENVELOPE_STATUS: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregado",
  signed: "Firmado",
  completed: "Firmado",
  declined: "Rechazado",
  voided: "Anulado",
};

type ProspectLinkedResourcesProps = {
  locale: string;
  prospectStatus: string;
  calendly: ProspectCalendlyBrief | null;
  envelopes: ProspectEnvelopeBrief[];
  payment: ProspectPaymentBrief | null;
  payments: ProspectPaymentBrief[];
  history: ProspectHistoryEntry[];
  canManage: boolean;
  clientView?: boolean;
  canMarkContacted?: boolean;
  contactNote?: string | null;
  contactNoteBy?: string | null;
  contactNoteAt?: string | null;
  onMarkContacted?: () => void;
  onLinkCalendly?: () => void;
  onSendContract?: () => void;
  onViewContracts?: () => void;
  onCreatePayment?: () => void;
  onLinkPayment?: () => void;
  onViewPayments?: () => void;
  onCancelPayment?: (paymentId: number) => void;
  cancellingPaymentId?: number | null;
};

function formatDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === "en" ? "en-US" : "es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StepHeader({ title, completed }: { title: string; completed: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={styles.stepHeader}>
      <Text style={styles.stepTitle}>{title}</Text>
      {completed ? (
        <Text style={styles.stepDone}>{t("prospects.linked.stepCompleted")}</Text>
      ) : null}
    </View>
  );
}

export function ProspectLinkedResources({
  locale,
  prospectStatus,
  calendly,
  envelopes,
  payment,
  payments,
  history,
  canManage,
  clientView = false,
  canMarkContacted = false,
  contactNote,
  contactNoteBy,
  contactNoteAt,
  onMarkContacted,
  onLinkCalendly,
  onSendContract,
  onViewContracts,
  onCreatePayment,
  onLinkPayment,
  onViewPayments,
  onCancelPayment,
  cancellingPaymentId = null,
}: ProspectLinkedResourcesProps) {
  const { t } = useTranslation();
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);
  const latestEnvelope = envelopes[0] ?? null;
  const paymentLinks = payments.length > 0 ? payments : payment ? [payment] : [];
  const displayPayment = pickPreferredPayment(payment, paymentLinks);
  const meetingComplete = isMeetingStepComplete(calendly, prospectStatus, history);
  const contractComplete = isContractStepComplete(envelopes);
  const paymentComplete = isPaymentStepComplete(displayPayment, paymentLinks);
  const ready = isReadyForClientConversion(
    calendly,
    prospectStatus,
    envelopes,
    displayPayment,
    paymentLinks,
    history,
  );
  const showViewContracts =
    envelopes.length > 0 && onViewContracts && (canManage || clientView);
  const showViewPayments =
    paymentLinks.length > 0 && onViewPayments && (canManage || clientView);

  async function handleCopyPaymentLink() {
    if (!displayPayment?.payment_url) return;
    try {
      await Share.share({ message: displayPayment.payment_url });
      setPaymentLinkCopied(true);
      setTimeout(() => setPaymentLinkCopied(false), 2000);
    } catch {
      // dismissed
    }
  }

  return (
    <View style={styles.wrap}>
      {ready && !clientView ? (
        <Text style={styles.ready}>{t("prospects.linked.allStepsComplete")}</Text>
      ) : null}

      <Card style={meetingComplete ? styles.doneCard : undefined}>
        <StepHeader title={t("prospects.linked.meeting")} completed={meetingComplete} />
        {calendly ? (
          <View style={styles.gap}>
            <Text style={styles.strong}>{calendly.name}</Text>
            <Text style={styles.muted}>
              {formatDateTime(calendly.start_time, locale)}
            </Text>
            {calendly.meeting_url && !clientView ? (
              <Button
                title={t("prospects.joinMeeting")}
                variant="secondary"
                onPress={() => void WebBrowser.openBrowserAsync(calendly.meeting_url!)}
              />
            ) : null}
            {!meetingComplete ? (
              <Text style={styles.warn}>
                {t("prospects.linked.meetingPendingContact")}
              </Text>
            ) : null}
          </View>
        ) : contactNote ? (
          <View style={styles.gap}>
            <Text style={styles.tiny}>
              {t("prospects.markContactedChannelTitle")}
            </Text>
            <Text style={styles.strong}>{contactNote}</Text>
            {contactNoteBy || contactNoteAt ? (
              <Text style={styles.muted}>
                {[
                  contactNoteBy
                    ? t("prospects.markContactedBy", { name: contactNoteBy })
                    : null,
                  contactNoteAt ? formatDateTime(contactNoteAt, locale) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.muted}>{t("prospects.linked.meetingEmpty")}</Text>
        )}
        {calendly && contactNote ? (
          <View style={styles.noteBox}>
            <Text style={styles.tiny}>{t("prospects.markContactedChannelTitle")}</Text>
            <Text style={styles.strong}>{contactNote}</Text>
            {contactNoteBy || contactNoteAt ? (
              <Text style={styles.muted}>
                {[
                  contactNoteBy
                    ? t("prospects.markContactedBy", { name: contactNoteBy })
                    : null,
                  contactNoteAt ? formatDateTime(contactNoteAt, locale) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </View>
        ) : null}
        {canManage && (canMarkContacted || !meetingComplete) ? (
          <View style={styles.actions}>
            {canMarkContacted && onMarkContacted ? (
              <Button
                title={t("prospects.markContacted")}
                onPress={onMarkContacted}
                style={styles.actionBtn}
              />
            ) : null}
            {!meetingComplete && onLinkCalendly ? (
              <Button
                title={t("prospects.linkCalendlyAction")}
                variant="secondary"
                onPress={onLinkCalendly}
                style={styles.actionBtn}
              />
            ) : null}
          </View>
        ) : null}
      </Card>

      <Card style={contractComplete ? styles.doneCard : undefined}>
        <StepHeader title={t("prospects.linked.contract")} completed={contractComplete} />
        {latestEnvelope ? (
          <View style={styles.gap}>
            <Text style={styles.strong}>{latestEnvelope.subject}</Text>
            <Text style={styles.badge}>
              {ENVELOPE_STATUS[latestEnvelope.status.toLowerCase()] ??
                latestEnvelope.status}
            </Text>
            <Text style={styles.muted}>
              {latestEnvelope.completed_at
                ? t("prospects.linked.signedAt", {
                    date: formatDateTime(latestEnvelope.completed_at, locale),
                  })
                : t("prospects.linked.sentAt", {
                    date: formatDateTime(latestEnvelope.sent_at, locale),
                  })}
            </Text>
            {latestEnvelope.signer_email ? (
              <Text style={styles.muted}>{latestEnvelope.signer_email}</Text>
            ) : null}
            {envelopes.length > 1 ? (
              <Text style={styles.muted}>
                {t("prospects.linked.moreContracts", { count: envelopes.length - 1 })}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.muted}>{t("prospects.linked.contractEmpty")}</Text>
        )}
        {showViewContracts || (canManage && onSendContract) ? (
          <View style={styles.actions}>
            {showViewContracts ? (
              <Button
                title={t("prospects.viewSentContracts")}
                variant="secondary"
                onPress={onViewContracts}
                style={styles.actionBtn}
              />
            ) : null}
            {canManage && onSendContract ? (
              <Button
                title={
                  envelopes.length > 0
                    ? t("prospects.sendAnotherContract")
                    : t("prospects.sendContract")
                }
                onPress={onSendContract}
                style={styles.actionBtn}
              />
            ) : null}
          </View>
        ) : null}
      </Card>

      <Card style={paymentComplete ? styles.doneCard : undefined}>
        <StepHeader title={t("prospects.linked.payment")} completed={paymentComplete} />
        {displayPayment ? (
          <View style={styles.gap}>
            <View style={styles.paymentHeader}>
              <Text style={styles.strong}>
                {displayPayment.currency} {Number(displayPayment.amount).toFixed(2)}
              </Text>
              {canManage &&
              !clientView &&
              displayPayment.status.toLowerCase() === "pending" &&
              onCancelPayment ? (
                <CancelPaymentIconButton
                  loading={cancellingPaymentId === displayPayment.id}
                  onPress={() =>
                    confirmCancelPaymentLink(t, () => onCancelPayment(displayPayment.id))
                  }
                />
              ) : null}
            </View>
            <Text style={styles.muted}>
              {PAYMENT_STATUS_LABELS[displayPayment.status] ?? displayPayment.status}
            </Text>
            {displayPayment.paid_at ? (
              <Text style={styles.muted}>
                {formatDateTime(displayPayment.paid_at, locale)}
              </Text>
            ) : null}
            {paymentLinks.length > 1 ? (
              <Text style={styles.muted}>
                {t("prospects.linked.morePayments", { count: paymentLinks.length - 1 })}
              </Text>
            ) : null}
            {clientView && displayPayment.payment_url ? (
              <Button
                title={
                  paymentLinkCopied ? t("common.copied") : t("payments.copyLink")
                }
                variant="secondary"
                onPress={() => void handleCopyPaymentLink()}
              />
            ) : displayPayment.status.toLowerCase() === "pending" ? (
              <Button
                title={t("payments.open")}
                variant="secondary"
                onPress={() =>
                  void WebBrowser.openBrowserAsync(displayPayment.payment_url)
                }
              />
            ) : null}
          </View>
        ) : (
          <Text style={styles.muted}>{t("prospects.linked.paymentEmpty")}</Text>
        )}
        {showViewPayments || canManage ? (
          <View style={styles.actions}>
            {showViewPayments ? (
              <Button
                title={t("prospects.viewSentPayments")}
                variant="secondary"
                onPress={onViewPayments}
                style={styles.actionBtn}
              />
            ) : null}
            {canManage && onCreatePayment ? (
              <Button
                title={
                  paymentLinks.length > 0
                    ? t("prospects.createAnotherPaymentLink")
                    : t("prospects.createPaymentLink")
                }
                onPress={onCreatePayment}
                style={styles.actionBtn}
              />
            ) : null}
            {canManage && onLinkPayment ? (
              <Button
                title={t("prospects.linkExistingPayment")}
                variant="secondary"
                onPress={onLinkPayment}
                style={styles.actionBtn}
              />
            ) : null}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  ready: {
    fontSize: 13,
    color: colors.brand,
    fontWeight: "600",
    backgroundColor: colors.brandLight,
    borderRadius: radii.control,
    padding: 12,
  },
  doneCard: {
    borderColor: colors.brandMuted,
    backgroundColor: colors.brandLight,
  },
  stepHeader: {
    gap: 2,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.brownMuted,
  },
  stepDone: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
  gap: {
    gap: 4,
  },
  paymentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  strong: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
  tiny: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.brownMuted,
  },
  warn: {
    fontSize: 12,
    color: "#9a6b12",
  },
  badge: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
  noteBox: {
    marginTop: 4,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.brandMuted,
    padding: 10,
    gap: 4,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexGrow: 1,
  },
});
