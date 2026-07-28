import { Modal, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/contexts/LanguageContext";
import { colors, radii } from "@/theme/tokens";

interface BoardUnlockedCongratsModalProps {
  advisorName?: string | null;
  onClose: () => void;
  onGoToBoard: () => void;
}

export function BoardUnlockedCongratsModal({
  advisorName,
  onClose,
  onGoToBoard,
}: BoardUnlockedCongratsModalProps) {
  const { t } = useTranslation();
  const body = advisorName
    ? t("portalBoardUnlock.bodyWithAdvisor", { name: advisorName })
    : t("portalBoardUnlock.body");

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("portalBoardUnlock.title")}</Text>
          <Text style={styles.subtitle}>{t("portalBoardUnlock.subtitle")}</Text>

          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={48} color={colors.brand} />
          </View>

          <Text style={styles.headline}>{t("portalBoardUnlock.headline")}</Text>
          <Text style={styles.body}>{body}</Text>

          <View style={styles.actions}>
            <Button title={t("common.close")} variant="secondary" onPress={onClose} fullWidth />
            <Button title={t("portalBoardUnlock.goToBoard")} onPress={onGoToBoard} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: 22,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.soft,
    textAlign: "center",
  },
  iconWrap: {
    alignItems: "center",
    marginVertical: 8,
  },
  headline: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.soft,
    textAlign: "center",
    marginBottom: 8,
  },
  actions: {
    gap: 10,
    marginTop: 6,
  },
});
