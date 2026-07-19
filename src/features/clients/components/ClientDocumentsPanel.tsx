import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DOCUMENT_UPLOAD_SLOTS } from "@/features/clients/constants";
import { formatDateTime } from "@/features/clients/format";
import { DocumentPreviewCard } from "@/features/documents/DocumentPreviewCard";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { DocumentBrief } from "@/types/api";
import {
  DOCUMENT_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
} from "@/types/api";
import { colors } from "@/theme/tokens";

const PENDING_STATUSES = new Set(["PENDIENTE", "EN_PROCESO"]);

type UploadSlot = (typeof DOCUMENT_UPLOAD_SLOTS)[number];

interface ClientDocumentsPanelProps {
  clientId: number;
  token: string;
  initialDocuments?: DocumentBrief[];
  onDocumentsChange?: (docs: DocumentBrief[]) => void;
}

function latestByType(docs: DocumentBrief[], type: string): DocumentBrief | undefined {
  return docs
    .filter((d) => d.type === type)
    .sort(
      (a, b) =>
        new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
    )[0];
}

export function ClientDocumentsPanel({
  clientId,
  token,
  initialDocuments = [],
  onDocumentsChange,
}: ClientDocumentsPanelProps) {
  const [documents, setDocuments] = useState<DocumentBrief[]>(initialDocuments);
  const [loading, setLoading] = useState(initialDocuments.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  const applyDocs = useCallback(
    (docs: DocumentBrief[]) => {
      setDocuments(docs);
      onDocumentsChange?.(docs);
    },
    [onDocumentsChange],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const docs = await api.get<DocumentBrief[]>(
        `/documents/client/${clientId}`,
        token,
      );
      applyDocs(docs);
    } catch (err) {
      setDocuments((prev) => {
        if (prev.length > 0) return prev;
        return initialDocuments;
      });
      if (initialDocuments.length === 0) {
        setError(getUserFacingErrorMessage(err, "No se pudieron cargar los documentos"));
      }
    } finally {
      setLoading(false);
    }
  }, [clientId, token, applyDocs]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPending = documents.some((d) => PENDING_STATUSES.has(d.verification_status));

  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(id);
  }, [hasPending, load]);

  async function uploadForSlot(slot: UploadSlot) {
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      setUploadingType(slot.value);

      const formData = new FormData();
      formData.append("document_type", slot.value);
      formData.append("file", {
        uri: asset.uri,
        name: asset.name ?? `${slot.value.toLowerCase()}.pdf`,
        type: asset.mimeType ?? "application/octet-stream",
      } as unknown as Blob);

      await api.upload<DocumentBrief>(
        `/documents/upload?client_id=${clientId}`,
        formData,
        token,
      );
      await load();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo subir el documento"));
    } finally {
      setUploadingType(null);
    }
  }

  if (loading) {
    return (
      <Card title="Documentos">
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.muted}>Cargando documentos…</Text>
      </Card>
    );
  }

  return (
    <Card title="Documentos">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hasPending ? (
        <Text style={styles.hint}>Verificando documentos… se actualiza cada 5 s.</Text>
      ) : null}

      {DOCUMENT_UPLOAD_SLOTS.map((slot) => {
        const doc = latestByType(documents, slot.value);
        const statusLabel = doc
          ? (VERIFICATION_STATUS_LABELS[doc.verification_status] ??
            doc.verification_status)
          : "Sin cargar";
        const typeLabel =
          DOCUMENT_TYPE_LABELS[slot.value] ?? slot.label;

        return (
          <View key={slot.value} style={styles.slot}>
            <View style={styles.slotHeader}>
              <Text style={styles.slotTitle}>{typeLabel}</Text>
              <Text
                style={[
                  styles.status,
                  doc?.verification_status === "APROBADO"
                    ? styles.statusOk
                    : doc?.verification_status === "RECHAZADO"
                      ? styles.statusBad
                      : null,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
            {doc ? (
              <>
                <DocumentPreviewCard doc={doc} token={token} />
                <Text style={styles.muted}>
                  Subido: {formatDateTime(doc.uploaded_at)}
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>Aún no hay archivo para este tipo.</Text>
            )}
            <Button
              title={doc ? "Reemplazar" : "Subir"}
              variant="secondary"
              fullWidth
              loading={uploadingType === slot.value}
              disabled={uploadingType !== null}
              onPress={() => void uploadForSlot(slot)}
            />
          </View>
        );
      })}

      <Pressable onPress={() => void load()} style={styles.refresh}>
        <Text style={styles.refreshText}>Actualizar lista</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
  hint: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: "600",
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  slot: {
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  slotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  slotTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  status: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.soft,
  },
  statusOk: {
    color: colors.brand,
  },
  statusBad: {
    color: colors.danger,
  },
  refresh: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand,
  },
});
