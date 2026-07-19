import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    source: "camera",
    label: "Cámara",
    icon: "camera-outline",
  },
  {
    source: "gallery",
    label: "Galería",
    icon: "images-outline",
  },
  {
    source: "files",
    label: "Archivos",
    icon: "folder-outline",
  },
];

export function UploadSourceSheet({
  visible,
  title = "¿Cómo querés subir el documento?",
  onClose,
  onSelect,
}: UploadSourceSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.row}>
            {OPTIONS.map((option) => (
              <Pressable
                key={option.source}
                accessibilityLabel={option.label}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => {
                  // Cerrar primero; el caller abre cámara/galería después del dismiss
                  onClose();
                  requestAnimationFrame(() => onSelect(option.source));
                }}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={option.icon} size={28} color={colors.brand} />
                </View>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
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
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.brown,
    textAlign: "center",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
  },
  option: {
    alignItems: "center",
    justifyContent: "center",
  },
  optionPressed: {
    opacity: 0.72,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  cancel: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.brown,
  },
});
