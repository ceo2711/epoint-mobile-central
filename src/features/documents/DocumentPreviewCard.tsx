import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";

import { useTranslation } from "@/contexts/LanguageContext";
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

function buildPdfViewerHtml(base64: string): string {
  // pdf.js en WebView: funciona en iOS y Android (el WebView de Android no renderiza PDF nativo).
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=4, user-scalable=yes" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #111; min-height: 100%; }
    #status { color: #f5f5f5; font: 14px -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; text-align: center; }
    #viewer { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 12px; }
    canvas { width: 100% !important; height: auto !important; background: #fff; border-radius: 4px; }
  </style>
</head>
<body>
  <div id="status">Cargando PDF…</div>
  <div id="viewer"></div>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const statusEl = document.getElementById("status");
    const viewer = document.getElementById("viewer");
    try {
      const raw = atob(${JSON.stringify(base64)});
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      pdfjsLib.getDocument({ data: bytes }).promise.then(async (pdf) => {
        statusEl.style.display = "none";
        const maxPages = Math.min(pdf.numPages, 40);
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const unscaled = page.getViewport({ scale: 1 });
          const scale = Math.min(2, (window.innerWidth - 24) / unscaled.width);
          const viewport = page.getViewport({ scale: Math.max(1.1, scale) });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          viewer.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      }).catch(function () {
        statusEl.textContent = "No se pudo mostrar el PDF.";
      });
    } catch (e) {
      statusEl.textContent = "No se pudo mostrar el PDF.";
    }
  </script>
</body>
</html>`;
}

interface DocumentPreviewCardProps {
  doc: DocumentBrief;
  token: string;
}

export function DocumentPreviewCard({ doc, token }: DocumentPreviewCardProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [loadingThumb, setLoadingThumb] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFileUri, setPdfFileUri] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

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
  const canPreview = showAsImage || showAsPdf;

  useEffect(() => {
    setPdfBase64(null);
    setPdfFileUri(null);
    setPreviewError(null);
  }, [doc.id]);

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

  const loadPdf = useCallback(async () => {
    if (pdfBase64 || loadingPdf) return;
    setLoadingPdf(true);
    setPreviewError(null);
    try {
      const blob = await api.getBlob(`/documents/${doc.id}/content`, token);
      const b64 = arrayBufferToBase64(blob.data);
      setPdfBase64(b64);

      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const path = `${cacheDir}doc-${doc.id}.pdf`;
        await FileSystem.writeAsStringAsync(path, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setPdfFileUri(path);
      }
    } catch {
      setPreviewError(t("portalDocs.pdfLoadError"));
    } finally {
      setLoadingPdf(false);
    }
  }, [doc.id, loadingPdf, pdfBase64, t, token]);

  function openPreview() {
    if (!canPreview) return;
    setPreviewOpen(true);
    if (showAsPdf) void loadPdf();
  }

  const pdfHtml = useMemo(
    () => (pdfBase64 ? buildPdfViewerHtml(pdfBase64) : null),
    [pdfBase64],
  );

  const modalHeight = Math.min(Dimensions.get("window").height * 0.82, 720);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.previewRow}
        onPress={openPreview}
        disabled={!canPreview}
        accessibilityRole="button"
        accessibilityLabel={
          showAsPdf ? t("portalDocs.tapToViewPdf") : t("portalDocs.tapToViewImage")
        }
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
          {canPreview ? (
            <Text style={styles.hint}>
              {showAsPdf ? t("portalDocs.tapToViewPdf") : t("portalDocs.tapToViewImage")}
            </Text>
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
        <View style={[styles.modalRoot, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPreviewOpen(false)} />
          <View style={[styles.modalContent, { maxHeight: modalHeight }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {doc.original_filename}
              </Text>
              <Pressable
                onPress={() => setPreviewOpen(false)}
                hitSlop={12}
                accessibilityLabel={t("common.close")}
              >
                <Ionicons name="close" size={24} color={colors.cream} />
              </Pressable>
            </View>

            {showAsImage && thumbUri ? (
              <Image source={{ uri: thumbUri }} style={styles.fullImage} resizeMode="contain" />
            ) : null}

            {showAsPdf ? (
              <View style={[styles.pdfWrap, { height: modalHeight - 110 }]}>
                {loadingPdf && !pdfHtml ? (
                  <View style={styles.pdfLoading}>
                    <ActivityIndicator color={colors.cream} size="large" />
                    <Text style={styles.pdfLoadingText}>{t("portalDocs.pdfLoading")}</Text>
                  </View>
                ) : null}
                {previewError ? (
                  <View style={styles.pdfLoading}>
                    <Text style={styles.pdfLoadingText}>{previewError}</Text>
                  </View>
                ) : null}
                {pdfHtml ? (
                  <WebView
                    originWhitelist={["*"]}
                    source={
                      // iOS WebView renderiza PDF local nativo; Android usa pdf.js en HTML.
                      Platform.OS === "ios" && pdfFileUri
                        ? { uri: pdfFileUri }
                        : { html: pdfHtml, baseUrl: "https://cdnjs.cloudflare.com" }
                    }
                    style={styles.webview}
                    startInLoadingState
                    renderLoading={() => (
                      <View style={styles.pdfLoading}>
                        <ActivityIndicator color={colors.cream} />
                      </View>
                    )}
                    allowFileAccess
                    allowUniversalAccessFromFileURLs
                    mixedContentMode="always"
                    javaScriptEnabled
                    scalesPageToFit
                    nestedScrollEnabled
                  />
                ) : null}
              </View>
            ) : null}

            <Pressable style={styles.closeBtn} onPress={() => setPreviewOpen(false)}>
              <Text style={styles.closeText}>{t("common.close")}</Text>
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
    paddingHorizontal: 12,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  modalContent: {
    zIndex: 2,
    borderRadius: radii.card,
    overflow: "hidden",
    backgroundColor: "#141414",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#0d0d0d",
  },
  modalTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.cream,
  },
  fullImage: {
    width: "100%",
    height: 420,
  },
  pdfWrap: {
    width: "100%",
    backgroundColor: "#111",
  },
  webview: {
    flex: 1,
    backgroundColor: "#111",
  },
  pdfLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#111",
    zIndex: 1,
  },
  pdfLoadingText: {
    color: colors.cream,
    fontSize: 14,
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
