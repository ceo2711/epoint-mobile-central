import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/contexts/LanguageContext";
import type { UploadSource } from "@/features/documents/pickUploadSource";
import { colors } from "@/theme/tokens";

interface UploadSourceSheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (source: UploadSource) => void;
}

const OPTIONS: {
  source: UploadSource;
  labelKey: "portalDocs.camera" | "portalDocs.gallery" | "portalDocs.files";
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    source: "camera",
    labelKey: "portalDocs.camera",
    icon: "camera-outline",
  },
  {
    source: "gallery",
    labelKey: "portalDocs.gallery",
    icon: "images-outline",
  },
  {
    source: "files",
    labelKey: "portalDocs.files",
    icon: "folder-outline",
  },
];

export function UploadSourceSheet({
  visible,
  title,
  onClose,
  onSelect,
}: UploadSourceSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>{title ?? t("portalDocs.uploadHow")}</Text>
          <View style={styles.row}>
            {OPTIONS.map((option) => (
              <Pressable
                key={option.source}
                accessibilityLabel={t(option.labelKey)}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => {
                  onClose();
                  requestAnimationFrame(() => onSelect(option.source));
                }}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={option.icon} size={28} color={colors.brand} />
                </View>
                <Text style={styles.optionLabel}>{t(option.labelKey)}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 18,
    paddingHorizontal: 16,
    gap: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 8,
  },
  option: {
    alignItems: "center",
    gap: 8,
    flex: 1,
    paddingVertical: 8,
  },
  optionPressed: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
  },
  cancel: {
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.soft,
  },
});
