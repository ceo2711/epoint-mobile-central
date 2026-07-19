import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { useAuth } from "@/features/auth/AuthContext";
import { DocumentPreviewCard } from "@/features/documents/DocumentPreviewCard";
import { UploadSourceSheet } from "@/features/documents/UploadSourceSheet";
import { waitForModalDismiss, pickUploadFile, type UploadSource } from "@/features/documents/pickUploadSource";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import {
  DOCUMENT_TYPES,
  VERIFICATION_STATUS_LABELS,
  type DocumentBrief,
} from "@/types/api";
import { colors, radii } from "@/theme/tokens";

const DOC_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDIENTE: { bg: "#fef3c7", text: "#92400e" },
  EN_PROCESO: { bg: "#dbeafe", text: "#1e40af" },
  APROBADO: { bg: colors.brandLight, text: colors.brand },
  RECHAZADO: { bg: "#fee2e2", text: "#991b1b" },
  PROXIMO_A_VENCER: { bg: "#fef3c7", text: "#92400e" },
};

export default function PortalDocumentosScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<DocumentBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerDocType, setPickerDocType] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const data = await api.get<DocumentBrief[]>("/portal/documents", token);
        setDocuments(data);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, "No se pudieron cargar los documentos"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!authLoading && token) {
      void load();
    }
  }, [authLoading, token, load]);

  const isVerifying = documents.some(
    (d) => d.verification_status === "PENDIENTE" || d.verification_status === "EN_PROCESO",
  );

  useEffect(() => {
    if (!token || !isVerifying) return;
    const interval = setInterval(() => {
      void load({ silent: true });
    }, 5000);
    return () => clearInterval(interval);
  }, [token, isVerifying, load]);

  function docsForType(type: string) {
    return documents.filter((d) => d.type === type);
  }

  async function uploadWithSource(docType: string, source: UploadSource) {
    if (!token) return;
    setPickerDocType(null);
    setMessage("");
    setIsError(false);

    // Cerrar el sheet antes de abrir cámara/galería (si no, en iOS/Android no aparece)
    await waitForModalDismiss(450);

    try {
      const file = await pickUploadFile(docType, source);
      if (!file) return;

      const formData = new FormData();
      formData.append("document_type", docType);
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      } as unknown as Blob);

      setUploading(docType);
      await api.upload<DocumentBrief>("/documents/upload", formData, token);
      setMessage("Documento subido correctamente");
      setIsError(false);
      await load({ silent: true });
    } catch (err) {
      setMessage(getUserFacingErrorMessage(err, "No se pudo subir el documento"));
      setIsError(true);
    } finally {
      setUploading(null);
    }
  }

  if (authLoading || loading) {
    return <ScreenState loading message="Cargando documentos…" />;
  }

  return (
    <>
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.brand}
            onRefresh={() => {
              setRefreshing(true);
              void load({ silent: true });
            }}
          />
        }
      >
        <Text style={styles.title}>Documentos</Text>
        <Text style={styles.subtitle}>
          Podés tomar una foto, elegir de la galería o subir un archivo. Si están pendientes
          de verificación, el estado se actualiza solo.
        </Text>

        {message ? (
          <Text style={isError ? styles.error : styles.success}>{message}</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {isVerifying ? (
          <View style={styles.polling}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.pollingText}>Verificando documentos…</Text>
          </View>
        ) : null}

        {DOCUMENT_TYPES.map((docType) => {
          const docs = docsForType(docType.value);
          const latest = docs[0];
          const status = latest?.verification_status;
          const palette = status
            ? DOC_STATUS_COLORS[status] ?? { bg: colors.creamWarm, text: colors.soft }
            : null;
          const busy = uploading === docType.value;

          return (
            <Card key={docType.value} title={docType.label}>
              {latest && token ? (
                <View style={styles.docMeta}>
                  {palette && status ? (
                    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
                      <Text style={[styles.badgeText, { color: palette.text }]}>
                        {VERIFICATION_STATUS_LABELS[status] ?? status}
                      </Text>
                    </View>
                  ) : null}
                  <DocumentPreviewCard doc={latest} token={token} />
                </View>
              ) : (
                <Text style={styles.empty}>Sin archivo subido</Text>
              )}
              <Button
                title={busy ? "Subiendo…" : latest ? "Reemplazar archivo" : "Subir archivo"}
                loading={busy}
                variant="secondary"
                fullWidth
                disabled={busy}
                onPress={() => setPickerDocType(docType.value)}
              />
            </Card>
          );
        })}
      </ScrollView>

      <UploadSourceSheet
        visible={pickerDocType != null}
        onClose={() => setPickerDocType(null)}
        onSelect={(source) => {
          if (!pickerDocType) return;
          void uploadWithSource(pickerDocType, source);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 14,
    color: colors.soft,
    lineHeight: 20,
    marginBottom: 4,
  },
  docMeta: {
    gap: 10,
    marginBottom: 4,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  empty: {
    fontSize: 13,
    color: colors.soft,
    marginBottom: 4,
  },
  polling: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pollingText: {
    fontSize: 13,
    color: colors.brand,
  },
  success: {
    color: colors.brand,
    fontWeight: "600",
  },
  error: {
    color: colors.danger,
  },
});
