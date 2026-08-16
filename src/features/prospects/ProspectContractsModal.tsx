import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system/legacy";

import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/contexts/LanguageContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { colors, radii } from "@/theme/tokens";
import type { ProspectEnvelopeBrief } from "@/types/api";

type ProspectContractsModalProps = {
  visible: boolean;
  envelopes: ProspectEnvelopeBrief[];
  locale: string;
  token: string | null;
  onClose: () => void;
};

type PreviewKind = "signed" | "sent";

function formatDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === "en" ? "en-US" : "es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function envelopeStatusKey(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "contracts.statusCompleted";
  if (normalized === "declined") return "contracts.statusDeclined";
  if (normalized === "voided") return "contracts.statusVoided";
  if (normalized === "delivered") return "contracts.statusDelivered";
  if (normalized === "sent") return "contracts.statusSent";
  return "contracts.statusUnknown";
}

function canViewSigned(status: string) {
  return status.toLowerCase() === "completed";
}

function canViewSent(status: string) {
  const normalized = status.toLowerCase();
  return normalized === "sent" || normalized === "delivered" || normalized === "completed";
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

export function ProspectContractsModal({
  visible,
  envelopes,
  locale,
  token,
  onClose,
}: ProspectContractsModalProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFileUri, setPdfFileUri] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind | null>(null);

  const pdfHtml = useMemo(
    () => (pdfBase64 ? buildPdfViewerHtml(pdfBase64) : null),
    [pdfBase64],
  );

  function resetPreview() {
    setPdfBase64(null);
    setPdfFileUri(null);
    setPreviewKind(null);
    setLoadingId(null);
  }

  function handleClose() {
    resetPreview();
    onClose();
  }

  async function openDocument(envelopeId: number, kind: PreviewKind) {
    if (!token) return;
    setLoadingId(envelopeId);
    setPreviewKind(kind);
    setPdfBase64(null);
    setPdfFileUri(null);
    try {
      const path =
        kind === "signed"
          ? `/docusign/envelopes/${envelopeId}/document`
          : `/docusign/envelopes/${envelopeId}/document/sent`;
      const blob = await api.getBlob(path, token);
      const b64 = arrayBufferToBase64(blob.data);
      setPdfBase64(b64);

      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const pathOnDisk = `${cacheDir}envelope-${envelopeId}-${kind}.pdf`;
        await FileSystem.writeAsStringAsync(pathOnDisk, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setPdfFileUri(pathOnDisk);
      }
    } catch (err) {
      resetPreview();
      Alert.alert(
        t("common.error"),
        getUserFacingErrorMessage(
          err,
          kind === "signed" ? t("contracts.downloadError") : t("contracts.downloadSentError"),
        ),
      );
    } finally {
      setLoadingId(null);
    }
  }

  const showingPdf = Boolean(pdfHtml || loadingId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {showingPdf
                  ? previewKind === "signed"
                    ? t("contracts.viewSigned")
                    : t("contracts.viewSent")
                  : t("prospects.contractsListTitle")}
              </Text>
              {!showingPdf ? (
                <Text style={styles.subtitle}>
                  {t("prospects.contractsListSubtitle", { count: envelopes.length })}
                </Text>
              ) : null}
            </View>
            {showingPdf ? (
              <Button title={t("common.back")} variant="ghost" onPress={resetPreview} />
            ) : (
              <Button title={t("common.close")} variant="ghost" onPress={handleClose} />
            )}
          </View>

          {showingPdf ? (
            <View style={styles.pdfWrap}>
              {loadingId && !pdfHtml ? (
                <View style={styles.pdfLoading}>
                  <ActivityIndicator color={colors.brand} size="large" />
                  <Text style={styles.muted}>{t("contracts.downloading")}</Text>
                </View>
              ) : null}
              {pdfHtml ? (
                <WebView
                  originWhitelist={["*"]}
                  source={
                    Platform.OS === "ios" && pdfFileUri
                      ? { uri: pdfFileUri }
                      : { html: pdfHtml, baseUrl: "https://cdnjs.cloudflare.com" }
                  }
                  style={styles.webview}
                  startInLoadingState
                  renderLoading={() => (
                    <View style={styles.pdfLoading}>
                      <ActivityIndicator color={colors.brand} />
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
          ) : (
            <ScrollView contentContainerStyle={styles.body} style={styles.list}>
              {envelopes.length === 0 ? (
                <Text style={styles.muted}>{t("prospects.linked.contractEmpty")}</Text>
              ) : (
                envelopes.map((envelope) => (
                  <View key={envelope.id} style={styles.item}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.subject}>{envelope.subject}</Text>
                      <Text style={styles.badge}>
                        {t(envelopeStatusKey(envelope.status))}
                      </Text>
                    </View>
                    <Text style={styles.muted}>
                      {envelope.completed_at
                        ? t("prospects.linked.signedAt", {
                            date: formatDateTime(envelope.completed_at, locale),
                          })
                        : t("prospects.linked.sentAt", {
                            date: formatDateTime(envelope.sent_at, locale),
                          })}
                    </Text>
                    {envelope.signer_email ? (
                      <Text style={styles.muted}>{envelope.signer_email}</Text>
                    ) : null}
                    <View style={styles.itemActions}>
                      {canViewSigned(envelope.status) ? (
                        <Button
                          title={t("contracts.viewSigned")}
                          variant="secondary"
                          loading={loadingId === envelope.id}
                          onPress={() => void openDocument(envelope.id, "signed")}
                          style={styles.itemBtn}
                        />
                      ) : null}
                      {canViewSent(envelope.status) && !canViewSigned(envelope.status) ? (
                        <Button
                          title={t("contracts.viewSent")}
                          variant="secondary"
                          loading={loadingId === envelope.id}
                          onPress={() => void openDocument(envelope.id, "sent")}
                          style={styles.itemBtn}
                        />
                      ) : null}
                    </View>
                  </View>
                ))
              )}
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
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "88%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 13,
    color: colors.soft,
  },
  body: {
    padding: 16,
    gap: 10,
    paddingBottom: 24,
  },
  list: {
    flex: 1,
  },
  item: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    padding: 12,
    gap: 4,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  subject: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
  itemActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  itemBtn: {
    flexGrow: 1,
  },
  pdfWrap: {
    flex: 1,
    minHeight: 360,
    margin: 16,
    marginTop: 8,
    borderRadius: radii.control,
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  pdfLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.white,
  },
});
