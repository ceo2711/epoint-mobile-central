import { useCallback, useEffect, useRef, useState } from "react";
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
import { Select } from "@/components/ui/Select";
import { useTranslation } from "@/contexts/LanguageContext";
import { formatDateTime } from "@/features/clients/format";
import { DocumentPreviewCard } from "@/features/documents/DocumentPreviewCard";
import {
  DOCUMENT_SECTIONS,
  getSectionGroups,
  groupLabel,
  inferActiveGroupId,
  type DocumentGroupDef,
  type DocumentSectionDef,
  type DocumentSlotDef,
  type DocumentTypeValue,
} from "@/features/documents/document-requirements";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { DocumentBrief } from "@/types/api";
import { colors } from "@/theme/tokens";

const PENDING_STATUSES = new Set(["PENDIENTE", "EN_PROCESO"]);
const STATUS_PRIORITY = [
  "RECHAZADO",
  "PROXIMO_A_VENCER",
  "PENDIENTE",
  "EN_PROCESO",
  "APROBADO",
];

const SSN_SECTION = DOCUMENT_SECTIONS.find((s) => s.id === "ssn")!;
const IDENTITY_SECTION = DOCUMENT_SECTIONS.find((s) => s.id === "identity")!;
const ADDRESS_SECTION = DOCUMENT_SECTIONS.find((s) => s.id === "address")!;

const DOC_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDIENTE: { bg: "#fef3c7", text: "#92400e" },
  EN_PROCESO: { bg: "#dbeafe", text: "#1e40af" },
  APROBADO: { bg: colors.brandLight, text: colors.brand },
  RECHAZADO: { bg: "#fee2e2", text: "#991b1b" },
  PROXIMO_A_VENCER: { bg: "#fef3c7", text: "#92400e" },
};

interface ClientDocumentsPanelProps {
  clientId: number;
  token: string;
  initialDocuments?: DocumentBrief[];
  onDocumentsChange?: (docs: DocumentBrief[]) => void;
}

function latestByType(
  docs: DocumentBrief[],
  type: string,
): DocumentBrief | undefined {
  return docs
    .filter((d) => d.type === type)
    .sort((a, b) => {
      const ta = new Date(a.uploaded_at ?? 0).getTime();
      const tb = new Date(b.uploaded_at ?? 0).getTime();
      return tb - ta;
    })[0];
}

function groupHint(
  group: DocumentGroupDef,
  documents: DocumentBrief[],
  t: (key: string) => string,
): string {
  const docs = group.slots.map((slot) => latestByType(documents, slot.type));
  if (docs.some((doc) => !doc)) return t("portalDocs.pendingUpload");
  const statuses = docs.map((doc) => doc!.verification_status);
  const status = STATUS_PRIORITY.find((candidate) => statuses.includes(candidate));
  return status ? t(`verificationStatus.${status}`) : t("portalDocs.pendingUpload");
}

function mergeUploadedAt(
  fetched: DocumentBrief[],
  fallback: DocumentBrief[],
): DocumentBrief[] {
  if (fallback.length === 0) return fetched;
  const byId = new Map(fallback.map((d) => [d.id, d]));
  return fetched.map((d) => ({
    ...d,
    uploaded_at: d.uploaded_at || byId.get(d.id)?.uploaded_at || d.uploaded_at,
  }));
}

function useActiveGroup(
  section: DocumentSectionDef,
  documents: DocumentBrief[],
  clientId: number,
  ready: boolean,
) {
  const [groupId, setGroupId] = useState(section.primary.id);
  const inferredFor = useRef<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (inferredFor.current === clientId) return;
    setGroupId(inferActiveGroupId(section, documents));
    inferredFor.current = clientId;
  }, [ready, documents, section, clientId]);

  return [groupId, setGroupId] as const;
}

function DocumentSlotCard({
  slot,
  doc,
  token,
  uploading,
  onUpload,
  t,
}: {
  slot: DocumentSlotDef;
  doc: DocumentBrief | undefined;
  token: string;
  uploading: string | null;
  onUpload: (docType: DocumentTypeValue) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const status = doc?.verification_status;
  const palette = status
    ? (DOC_STATUS_COLORS[status] ?? { bg: colors.creamWarm, text: colors.soft })
    : null;
  const busy = uploading === slot.type;
  const uploadedLabel = formatDateTime(doc?.uploaded_at);

  return (
    <View style={styles.slot}>
      <View style={styles.slotHeader}>
        <Text style={styles.slotTitle}>{t(`documentTypes.${slot.type}`)}</Text>
        {palette && status ? (
          <View style={[styles.badge, { backgroundColor: palette.bg }]}>
            <Text style={[styles.badgeText, { color: palette.text }]}>
              {t(`verificationStatus.${status}`)}
            </Text>
          </View>
        ) : (
          <Text style={styles.status}>{t("portalDocs.pendingUpload")}</Text>
        )}
      </View>
      {doc ? (
        <>
          <DocumentPreviewCard doc={doc} token={token} />
          <Text style={styles.muted}>
            {t("portalDocs.uploadedAt", { date: uploadedLabel })}
          </Text>
        </>
      ) : (
        <Text style={styles.muted}>{t("portalDocs.empty")}</Text>
      )}
      <Button
        title={
          busy
            ? t("common.uploading")
            : doc
              ? t("common.replace")
              : t("common.upload")
        }
        variant="secondary"
        fullWidth
        loading={busy}
        disabled={uploading !== null}
        onPress={() => onUpload(slot.type)}
      />
    </View>
  );
}

function SelectableSection({
  section,
  selectedGroupId,
  onSelectGroup,
  documents,
  token,
  uploading,
  onUpload,
  t,
}: {
  section: DocumentSectionDef;
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  documents: DocumentBrief[];
  token: string;
  uploading: string | null;
  onUpload: (docType: DocumentTypeValue) => void;
  t: (key: string) => string;
}) {
  const groups = getSectionGroups(section);
  const activeGroup =
    groups.find((group) => group.id === selectedGroupId) ?? section.primary;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>
      <Text style={styles.sectionDesc}>{t(section.descriptionKey)}</Text>
      <Select
        label={t("portalDocs.documentTypeSelect")}
        sheetTitle={t(section.titleKey)}
        value={activeGroup.id}
        options={groups.map((group) => ({
          value: group.id,
          label: groupLabel(group, t),
          hint: groupHint(group, documents, t),
        }))}
        onChange={onSelectGroup}
      />
      {activeGroup.slots.map((slot) => (
        <DocumentSlotCard
          key={slot.type}
          slot={slot}
          doc={latestByType(documents, slot.type)}
          token={token}
          uploading={uploading}
          onUpload={onUpload}
          t={t}
        />
      ))}
    </View>
  );
}

export function ClientDocumentsPanel({
  clientId,
  token,
  initialDocuments = [],
  onDocumentsChange,
}: ClientDocumentsPanelProps) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<DocumentBrief[]>(initialDocuments);
  const [loading, setLoading] = useState(initialDocuments.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fallbackDocsRef = useRef(initialDocuments);
  fallbackDocsRef.current = initialDocuments;

  const applyDocs = useCallback(
    (docs: DocumentBrief[]) => {
      const merged = mergeUploadedAt(docs, fallbackDocsRef.current);
      setDocuments(merged);
      onDocumentsChange?.(merged);
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
        return fallbackDocsRef.current;
      });
      if (fallbackDocsRef.current.length === 0) {
        setError(
          getUserFacingErrorMessage(err, t("portalDocs.loadError")),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [clientId, token, applyDocs, t]);

  useEffect(() => {
    setDocuments(fallbackDocsRef.current);
    setLoading(fallbackDocsRef.current.length === 0);
    void load();
  }, [clientId, load]);

  const hasPending = documents.some((d) =>
    PENDING_STATUSES.has(d.verification_status),
  );

  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(id);
  }, [hasPending, load]);

  const ready = !loading;
  const [identityGroupId, setIdentityGroupId] = useActiveGroup(
    IDENTITY_SECTION,
    documents,
    clientId,
    ready,
  );
  const [addressGroupId, setAddressGroupId] = useActiveGroup(
    ADDRESS_SECTION,
    documents,
    clientId,
    ready,
  );

  async function uploadForType(docType: DocumentTypeValue) {
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      setUploadingType(docType);

      const formData = new FormData();
      formData.append("document_type", docType);
      formData.append("file", {
        uri: asset.uri,
        name: asset.name ?? `${docType.toLowerCase()}.pdf`,
        type: asset.mimeType ?? "application/octet-stream",
      } as unknown as Blob);

      await api.upload<DocumentBrief>(
        `/documents/upload?client_id=${clientId}`,
        formData,
        token,
      );
      await load();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("portalDocs.uploadError")));
    } finally {
      setUploadingType(null);
    }
  }

  if (loading) {
    return (
      <Card title={t("portalDocs.title")}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.muted}>{t("portalDocs.loading")}</Text>
      </Card>
    );
  }

  return (
    <Card title={t("portalDocs.title")}>
      <Text style={styles.hintText}>{t("portalDocs.subtitle")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hasPending ? (
        <Text style={styles.hint}>{t("portalDocs.verifying")}</Text>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t(SSN_SECTION.titleKey)}</Text>
        <Text style={styles.sectionDesc}>{t(SSN_SECTION.descriptionKey)}</Text>
        {SSN_SECTION.primary.slots.map((slot) => (
          <DocumentSlotCard
            key={slot.type}
            slot={slot}
            doc={latestByType(documents, slot.type)}
            token={token}
            uploading={uploadingType}
            onUpload={uploadForType}
            t={t}
          />
        ))}
      </View>

      <SelectableSection
        section={IDENTITY_SECTION}
        selectedGroupId={identityGroupId}
        onSelectGroup={setIdentityGroupId}
        documents={documents}
        token={token}
        uploading={uploadingType}
        onUpload={uploadForType}
        t={t}
      />

      <SelectableSection
        section={ADDRESS_SECTION}
        selectedGroupId={addressGroupId}
        onSelectGroup={setAddressGroupId}
        documents={documents}
        token={token}
        uploading={uploadingType}
        onUpload={uploadForType}
        t={t}
      />

      <Pressable onPress={() => void load()} style={styles.refresh}>
        <Text style={styles.refreshText}>{t("portalDocs.refreshList")}</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.soft,
    marginBottom: 4,
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
  section: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.brown,
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.soft,
  },
  slot: {
    gap: 6,
    paddingVertical: 10,
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
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  status: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.soft,
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
