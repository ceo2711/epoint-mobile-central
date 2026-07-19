import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/lib/api";
import type { DocumentBrief, LocalizedStringList } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

function pickLocalizedMessages(
  messages: LocalizedStringList | null | undefined,
  locale: "es" | "en" = "es",
): string[] {
  if (!messages) return [];
  const list = locale === "es" ? messages.es : messages.en;
  if (list?.length) return list;
  return messages.es?.length ? messages.es : messages.en ?? [];
}

function isImageMime(mime: string | null | undefined, filename: string): boolean {
  if (mime?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(filename);
}

function isPdf(mime: string | null | undefined, filename: string): boolean {
  if (mime?.includes("pdf")) return true;
  return /\.pdf$/i.test(filename);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

interface DocumentPreviewCardProps {
  doc: DocumentBrief;
  token: string;
}

export function DocumentPreviewCard({ doc, token }: DocumentPreviewCardProps) {
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [loadingThumb, setLoadingThumb] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const rejectionMessages = pickLocalizedMessages(doc.rejection_reasons);
  const approvalMessages = pickLocalizedMessages(doc.approval_reasons);
  const isRejected = doc.verification_status === "RECHAZADO";
  const isApproved =
    doc.verification_status === "APROBADO" ||
    doc.verification_status === "PROXIMO_A_VENCER";
  const reasonMessages = isRejected
    ? rejectionMessages
    : isApproved
      ? approvalMessages
      : [];
  const showAsImage = isImageMime(doc.mime_type, doc.original_filename);
  const showAsPdf = isPdf(doc.mime_type, doc.original_filename);

  useEffect(() => {
    let cancelled = false;
    async function loadThumb() {
      if (!showAsImage) {
        setThumbUri(null);
        return;
      }
      setLoadingThumb(true);
      try {
        if (doc.download_url?.startsWith("http")) {
          if (!cancelled) setThumbUri(doc.download_url);
          return;
        }
        const blob = await api.getBlob(`/documents/${doc.id}/content`, token);
        const mime = blob.mimeType || doc.mime_type || "image/jpeg";
        if (!mime.startsWith("image/")) {
          if (!cancelled) setThumbUri(null);
          return;
        }
        const dataUri = `data:${mime};base64,${arrayBufferToBase64(blob.data)}`;
        if (!cancelled) setThumbUri(dataUri);
      } catch {
        if (!cancelled) setThumbUri(null);
      } finally {
        if (!cancelled) setLoadingThumb(false);
      }
    }
    void loadThumb();
    return () => {
      cancelled = true;
    };
  }, [doc.id, doc.download_url, doc.mime_type, doc.original_filename, showAsImage, token]);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.previewRow}
        onPress={() => {
          if (thumbUri) setPreviewOpen(true);
        }}
      >
        <View style={styles.thumb}>
          {loadingThumb ? (
            <ActivityIndicator color={colors.brand} />
          ) : thumbUri ? (
            <Image source={{ uri: thumbUri }} style={styles.thumbImage} resizeMode="cover" />
          ) : (
            <View style={styles.thumbFallback}>
              <Ionicons
                name={showAsPdf ? "document-text-outline" : "document-outline"}
                size={28}
                color={colors.brand}
              />
              <Text style={styles.thumbFallbackText}>{showAsPdf ? "PDF" : "Archivo"}</Text>
            </View>
          )}
        </View>
        <View style={styles.meta}>
          <Text style={styles.filename} numberOfLines={2}>
            {doc.original_filename}
          </Text>
          {thumbUri ? (
            <Text style={styles.hint}>Tocá para ver en grande</Text>
          ) : null}
        </View>
      </Pressable>

      {reasonMessages.length > 0 ? (
        <View
          style={[
            styles.reasonsBox,
            isRejected ? styles.reasonsRejected : styles.reasonsApproved,
          ]}
        >
          <Text
            style={[
              styles.reasonsTitle,
              isRejected ? styles.reasonsTitleRejected : styles.reasonsTitleApproved,
            ]}
          >
            {isRejected ? "Motivo del rechazo (IA)" : "Detalle de la aprobación (IA)"}
          </Text>
          {reasonMessages.map((msg, index) => (
            <Text
              key={`${index}-${msg.slice(0, 24)}`}
              style={[
                styles.reasonItem,
                isRejected ? styles.reasonItemRejected : styles.reasonItemApproved,
              ]}
            >
              • {msg}
            </Text>
          ))}
        </View>
      ) : null}

      <Modal
        visible={previewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPreviewOpen(false)} />
          <View style={styles.modalContent}>
            {thumbUri ? (
              <Image source={{ uri: thumbUri }} style={styles.fullImage} resizeMode="contain" />
            ) : null}
            <Pressable style={styles.closeBtn} onPress={() => setPreviewOpen(false)}>
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  previewRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.control,
    backgroundColor: colors.creamWarm,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  thumbFallbackText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.brand,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
  filename: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  hint: {
    fontSize: 11,
    color: colors.soft,
  },
  reasonsBox: {
    borderRadius: radii.control,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  reasonsRejected: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  reasonsApproved: {
    backgroundColor: colors.brandLight,
    borderColor: "#b7d4bc",
  },
  reasonsTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  reasonsTitleRejected: {
    color: "#991b1b",
  },
  reasonsTitleApproved: {
    color: colors.brand,
  },
  reasonItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  reasonItemRejected: {
    color: "#7f1d1d",
  },
  reasonItemApproved: {
    color: colors.ink,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  modalContent: {
    zIndex: 2,
    maxHeight: "85%",
    borderRadius: radii.card,
    overflow: "hidden",
    backgroundColor: colors.ink,
  },
  fullImage: {
    width: "100%",
    height: 420,
  },
  closeBtn: {
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: colors.cream,
  },
  closeText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.brown,
  },
});
