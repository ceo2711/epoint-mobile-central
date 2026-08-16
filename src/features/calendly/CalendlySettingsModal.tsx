import { Alert, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/contexts/LanguageContext";
import { CalendlyTokenForm } from "@/features/calendly/CalendlyTokenForm";
import { colors, radii } from "@/theme/tokens";

type CalendlySettingsModalProps = {
  visible: boolean;
  schedulingUrl?: string | null;
  disconnecting?: boolean;
  onClose: () => void;
  onUpdateToken: (accessToken: string, schedulingUrl?: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
};

export function CalendlySettingsModal({
  visible,
  schedulingUrl,
  disconnecting = false,
  onClose,
  onUpdateToken,
  onDisconnect,
}: CalendlySettingsModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  function confirmDisconnect() {
    Alert.alert(t("calendly.disconnect"), t("calendly.disconnectHint"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("calendly.disconnect"),
        style: "destructive",
        onPress: () => void onDisconnect(),
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t("calendly.settingsTitle")}</Text>
              <Text style={styles.subtitle}>{t("calendly.settingsSubtitle")}</Text>
            </View>
            <Button title={t("common.close")} variant="ghost" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <CalendlyTokenForm
              defaultSchedulingUrl={schedulingUrl ?? ""}
              submitLabel={t("calendly.updateTokenAction")}
              submittingLabel={t("calendly.updatingToken")}
              onSubmit={onUpdateToken}
            />
            <View style={styles.dangerBox}>
              <Text style={styles.hint}>{t("calendly.disconnectHint")}</Text>
              <Button
                title={t("calendly.disconnect")}
                variant="danger"
                loading={disconnecting}
                onPress={confirmDisconnect}
              />
            </View>
          </ScrollView>
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
    maxHeight: "90%",
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
    gap: 4,
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
  body: {
    gap: 16,
    paddingBottom: 8,
  },
  dangerBox: {
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.soft,
  },
});
