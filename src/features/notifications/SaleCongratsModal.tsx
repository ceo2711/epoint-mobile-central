import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/contexts/LanguageContext";
import { colors, radii } from "@/theme/tokens";
import type { Notification } from "@/types/api";

const DEFAULT_COMMISSION_USD = 500;

export function isSaleCongratsNotification(notification: Notification): boolean {
  if (notification.event_type === "PROSPECT_CONVERTED") return true;
  if (notification.event_type !== "PAYMENT_LINK_COMPLETED") return false;
  const clientId = Number(notification.payload?.client_id);
  return Number.isFinite(clientId) && clientId > 0;
}

export function isSaleCongratsPayload(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const eventType = String(data.event_type ?? "");
  const clientId = Number(data.client_id);
  const hasClient = Number.isFinite(clientId) && clientId > 0;
  if (eventType === "PROSPECT_CONVERTED") return true;
  if (eventType === "PAYMENT_LINK_COMPLETED" && hasClient) return true;
  return hasClient && data.commission_usd != null;
}

function formatMoney(amount: string | number | undefined, currency = "USD"): string {
  const value = typeof amount === "number" ? amount : Number(amount ?? NaN);
  if (!Number.isFinite(value)) return `${currency} —`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

type SaleCongratsModalProps = {
  notification: Notification;
  onClose: () => void;
};

export function SaleCongratsModal({ notification, onClose }: SaleCongratsModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const payload = notification.payload ?? {};
  const customerName =
    typeof payload.customer_name === "string" && payload.customer_name.trim()
      ? payload.customer_name.trim()
      : t("notifications.saleCongrats.customerFallback");
  const currency =
    typeof payload.currency === "string" && payload.currency.trim()
      ? payload.currency.trim()
      : "USD";
  const paidAmount =
    payload.amount !== undefined ? formatMoney(payload.amount as string | number, currency) : null;
  const commissionRaw =
    payload.commission_usd !== undefined
      ? Number(payload.commission_usd)
      : DEFAULT_COMMISSION_USD;
  const commission = formatMoney(commissionRaw, "USD");
  const clientId = Number(payload.client_id);
  const canNavigate = Number.isFinite(clientId) && clientId > 0;

  function goToClient() {
    onClose();
    router.push(`/(staff)/(tabs)/clientes/${clientId}` as never);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={42} color={colors.brand} />
          </View>
          <Text style={styles.title}>{t("notifications.saleCongrats.title")}</Text>
          <Text style={styles.subtitle}>{t("notifications.saleCongrats.subtitle")}</Text>
          <Text style={styles.headline}>
            {t("notifications.saleCongrats.headline", { name: customerName })}
          </Text>
          <Text style={styles.body}>{t("notifications.saleCongrats.body")}</Text>

          <View style={styles.stats}>
            {paidAmount ? (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t("notifications.saleCongrats.paidLabel")}</Text>
                <Text style={styles.statValue}>{paidAmount}</Text>
              </View>
            ) : null}
            <View style={styles.stat}>
              <Text style={styles.statLabel}>
                {t("notifications.saleCongrats.commissionLabel")}
              </Text>
              <Text style={styles.statValue}>{commission}</Text>
            </View>
          </View>

          <Text style={styles.hint}>{t("notifications.saleCongrats.footerHint")}</Text>

          <View style={styles.actions}>
            <Button title={t("common.close")} variant="secondary" onPress={onClose} />
            {canNavigate ? (
              <Button title={t("notifications.saleCongrats.viewClient")} onPress={goToClient} />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  card: {
    backgroundColor: colors.cream,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    gap: 10,
    zIndex: 1,
  },
  iconWrap: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    color: colors.brown,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: colors.brand,
    marginTop: -4,
  },
  headline: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  body: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    color: colors.soft,
  },
  stats: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.brandLight,
    borderRadius: radii.control,
    padding: 14,
  },
  stat: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.brand,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
  },
  hint: {
    textAlign: "center",
    fontSize: 12,
    color: colors.soft,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
});
