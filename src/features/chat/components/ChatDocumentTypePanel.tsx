import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DOCUMENT_SECTIONS } from "@/features/documents/document-requirements";
import { colors, radii } from "@/theme/tokens";

interface ChatDocumentTypePanelProps {
  fileName: string;
  disabled?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onSelectDocumentType: (value: string) => void;
  onCancel: () => void;
}

export function ChatDocumentTypePanel({
  fileName,
  disabled = false,
  t,
  onSelectDocumentType,
  onCancel,
}: ChatDocumentTypePanelProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t("chat.stagedFileTitle")}</Text>
          <Text style={styles.fileName} numberOfLines={1}>
            📎 {fileName}
          </Text>
        </View>
        <Pressable disabled={disabled} onPress={onCancel} hitSlop={8}>
          <Text style={styles.cancel}>{t("chat.cancelUpload")}</Text>
        </Pressable>
      </View>

      <Text style={styles.prompt}>{t("chat.selectDocumentType")}</Text>

      <ScrollView style={styles.list} nestedScrollEnabled>
        {DOCUMENT_SECTIONS.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>
            <View style={styles.chips}>
              {[section.primary, ...(section.alternatives ?? [])].flatMap((group) =>
                group.slots.map((slot) => (
                  <Pressable
                    key={slot.type}
                    disabled={disabled}
                    onPress={() => onSelectDocumentType(slot.type)}
                    style={({ pressed }) => [
                      styles.chip,
                      pressed && styles.chipPressed,
                      disabled && styles.chipDisabled,
                    ]}
                  >
                    <Text style={styles.chipText}>{t(`documentTypes.${slot.type}`)}</Text>
                  </Pressable>
                )),
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    maxHeight: 220,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  fileName: {
    fontSize: 13,
    color: "#1e40af",
    marginTop: 2,
  },
  cancel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.soft,
  },
  prompt: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e40af",
  },
  list: {
    flexGrow: 0,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.soft,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  chipPressed: {
    backgroundColor: "#dbeafe",
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1d4ed8",
  },
});
