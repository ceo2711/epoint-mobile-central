import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  CancelPaymentIconButton,
  confirmCancelPaymentLink,
} from "@/features/payments/CancelPaymentIconButton";
import { colors, radii } from "@/theme/tokens";
import type { ProspectPaymentBrief } from "@/types/api";
import { PAYMENT_STATUS_LABELS } from "@/types/api";

type ProspectPaymentsModalProps = {
  visible: boolean;
  payments: ProspectPaymentBrief[];
  locale: string;
  cancellingId?: number | null;
  onCancel?: (paymentId: number) => void;
  onClose: () => void;
};

function formatDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === "en" ? "en-US" : "es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ProspectPaymentsModal({
  visible,
  payments,
  locale,
  cancellingId = null,
  onCancel,
  onClose,
}: ProspectPaymentsModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t("prospects.paymentsListTitle")}</Text>
              <Text style={styles.subtitle}>
                {t("prospects.paymentsListSubtitle", { count: payments.length })}
              </Text>
            </View>
            <Button title={t("common.close")} variant="ghost" onPress={onClose} />
          </View>

          {payments.length === 0 ? (
            <Text style={styles.muted}>{t("prospects.linked.paymentEmpty")}</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {payments.map((payment) => (
                <View key={payment.id} style={styles.item}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.amount}>
                      {payment.currency} {Number(payment.amount).toFixed(2)}
                    </Text>
                    {payment.status.toLowerCase() === "pending" && onCancel ? (
                      <CancelPaymentIconButton
                        loading={cancellingId === payment.id}
                        onPress={() =>
                          confirmCancelPaymentLink(t, () => onCancel(payment.id))
                        }
                      />
                    ) : null}
                  </View>
                  <Text style={styles.status}>
                    {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                  </Text>
                  <Text style={styles.muted}>
                    {payment.paid_at
                      ? t("prospects.linked.paidAt", {
                          date: formatDateTime(payment.paid_at, locale),
                        })
                      : payment.created_at
                        ? t("prospects.linked.paymentCreatedAt", {
                            date: formatDateTime(payment.created_at, locale),
                          })
                        : null}
                  </Text>
                  {payment.status.toLowerCase() === "pending" && payment.payment_url ? (
                    <Button
                      title={t("payments.open")}
                      variant="secondary"
                      onPress={() => void WebBrowser.openBrowserAsync(payment.payment_url)}
                    />
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 13,
    color: colors.soft,
  },
  list: {
    gap: 10,
    paddingBottom: 8,
  },
  item: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    padding: 12,
    gap: 4,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  status: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand,
  },
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
});
