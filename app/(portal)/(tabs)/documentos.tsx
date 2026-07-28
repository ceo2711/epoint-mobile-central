import { useCallback, useEffect, useRef, useState } from "react";
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
import { Select } from "@/components/ui/Select";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { usePortalBoardUnlock } from "@/features/portal/PortalBoardUnlockContext";
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
import { UploadSourceSheet } from "@/features/documents/UploadSourceSheet";
import {
  waitForModalDismiss,
  pickUploadFile,
  type UploadSource,
} from "@/features/documents/pickUploadSource";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { DocumentBrief } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

const DOC_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDIENTE: { bg: "#fef3c7", text: "#92400e" },
  EN_PROCESO: { bg: "#dbeafe", text: "#1e40af" },
  APROBADO: { bg: colors.brandLight, text: colors.brand },
  RECHAZADO: { bg: "#fee2e2", text: "#991b1b" },
  PROXIMO_A_VENCER: { bg: "#fef3c7", text: "#92400e" },
};

const SSN_SECTION = DOCUMENT_SECTIONS.find((s) => s.id === "ssn")!;
const IDENTITY_SECTION = DOCUMENT_SECTIONS.find((s) => s.id === "identity")!;
const ADDRESS_SECTION = DOCUMENT_SECTIONS.find((s) => s.id === "address")!;

function useDocumentGroupSelection(
  section: DocumentSectionDef,
  documents: DocumentBrief[],
  ready: boolean,
) {
  const [groupId, setGroupId] = useState(section.primary.id);
  const initialized = useRef(false);

  useEffect(() => {
    // Inferir solo una vez cuando ya cargaron los docs; no pisar la elección manual.
    if (!ready || initialized.current) return;
    setGroupId(inferActiveGroupId(section, documents));
    initialized.current = true;
  }, [documents, section, ready]);

  return [groupId, setGroupId] as const;
}

// Prioridad de lo que el cliente necesita ver primero si la opción tiene varios archivos.
const STATUS_PRIORITY = [
  "RECHAZADO",
  "PROXIMO_A_VENCER",
  "PENDIENTE",
  "EN_PROCESO",
  "APROBADO",
];

function groupHint(
  group: DocumentGroupDef,
  documents: DocumentBrief[],
  t: (key: string) => string,
): string {
  const docs = group.slots.map((slot) => documents.find((d) => d.type === slot.type));
  if (docs.some((doc) => !doc)) return t("portalDocs.pendingUpload");

  const statuses = docs.map((doc) => doc!.verification_status);
  const status = STATUS_PRIORITY.find((candidate) => statuses.includes(candidate));
  return status ? t(`verificationStatus.${status}`) : t("portalDocs.pendingUpload");
}

function DocumentSlotCard({
  slot,
  doc,
  token,
  uploading,
  onUploadPress,
  t,
}: {
  slot: DocumentSlotDef;
  doc: DocumentBrief | undefined;
  token: string;
  uploading: string | null;
  onUploadPress: (docType: DocumentTypeValue) => void;
  t: (key: string) => string;
}) {
  const status = doc?.verification_status;
  const palette = status
    ? DOC_STATUS_COLORS[status] ?? { bg: colors.creamWarm, text: colors.soft }
    : null;
  const busy = uploading === slot.type;

  return (
    <Card title={t(`documentTypes.${slot.type}`)}>
      {doc ? (
        <View style={styles.docMeta}>
          {palette && status ? (
            <View style={[styles.badge, { backgroundColor: palette.bg }]}>
              <Text style={[styles.badgeText, { color: palette.text }]}>
                {t(`verificationStatus.${status}`)}
              </Text>
            </View>
          ) : null}
          <DocumentPreviewCard doc={doc} token={token} />
        </View>
      ) : (
        <Text style={styles.empty}>{t("portalDocs.pendingUpload")}</Text>
      )}
      <Button
        title={
          busy
            ? t("common.uploading")
            : doc
              ? t("common.replace")
              : t("common.upload")
        }
        loading={busy}
        variant="secondary"
        fullWidth
        disabled={busy || !!uploading}
        onPress={() => onUploadPress(slot.type)}
      />
    </Card>
  );
}

function SelectableSection({
  section,
  selectedGroupId,
  onSelectGroup,
  documents,
  token,
  uploading,
  onUploadPress,
  t,
}: {
  section: DocumentSectionDef;
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  documents: DocumentBrief[];
  token: string;
  uploading: string | null;
  onUploadPress: (docType: DocumentTypeValue) => void;
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
          doc={documents.find((d) => d.type === slot.type)}
          token={token}
          uploading={uploading}
          onUploadPress={onUploadPress}
          t={t}
        />
      ))}
    </View>
  );
}

export default function PortalDocumentosScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const unlockCtx = usePortalBoardUnlock();
  const reloadUnlock = unlockCtx?.reload;
  const [documents, setDocuments] = useState<DocumentBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerDocType, setPickerDocType] = useState<string | null>(null);

  const docsReady = !authLoading && !loading;

  const [identityGroupId, setIdentityGroupId] = useDocumentGroupSelection(
    IDENTITY_SECTION,
    documents,
    docsReady,
  );
  const [addressGroupId, setAddressGroupId] = useDocumentGroupSelection(
    ADDRESS_SECTION,
    documents,
    docsReady,
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const data = await api.get<DocumentBrief[]>("/portal/documents", token);
        setDocuments(data);
        await reloadUnlock?.();
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("portalDocs.loadError")));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, t, reloadUnlock],
  );

  useEffect(() => {
    if (!authLoading && token) {
      void load();
    }
  }, [authLoading, token, load]);

  const isVerifying = documents.some(
    (d) =>
      d.verification_status === "PENDIENTE" || d.verification_status === "EN_PROCESO",
  );

  useEffect(() => {
    if (!token || !isVerifying) return;
    const interval = setInterval(() => {
      void load({ silent: true });
    }, 5000);
    return () => clearInterval(interval);
  }, [token, isVerifying, load]);

  async function uploadWithSource(docType: string, source: UploadSource) {
    if (!token) return;
    setPickerDocType(null);
    setMessage("");
    setIsError(false);

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
      setMessage(t("portalDocs.uploadSuccess"));
      setIsError(false);
      await load({ silent: true });
    } catch (err) {
      setMessage(getUserFacingErrorMessage(err, t("portalDocs.uploadError")));
      setIsError(true);
    } finally {
      setUploading(null);
    }
  }

  if (authLoading || loading || !token) {
    return <ScreenState loading message={t("portalDocs.loading")} />;
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
        <Text style={styles.title}>{t("portalDocs.title")}</Text>
        <Text style={styles.subtitle}>{t("portalDocs.subtitle")}</Text>

        {message ? (
          <Text style={isError ? styles.error : styles.success}>{message}</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {isVerifying ? (
          <View style={styles.polling}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.pollingText}>{t("portalDocs.verifying")}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t(SSN_SECTION.titleKey)}</Text>
          <Text style={styles.sectionDesc}>{t(SSN_SECTION.descriptionKey)}</Text>
          {SSN_SECTION.primary.slots.map((slot) => (
            <DocumentSlotCard
              key={slot.type}
              slot={slot}
              doc={documents.find((d) => d.type === slot.type)}
              token={token}
              uploading={uploading}
              onUploadPress={setPickerDocType}
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
          uploading={uploading}
          onUploadPress={setPickerDocType}
          t={t}
        />

        <SelectableSection
          section={ADDRESS_SECTION}
          selectedGroupId={addressGroupId}
          onSelectGroup={setAddressGroupId}
          documents={documents}
          token={token}
          uploading={uploading}
          onUploadPress={setPickerDocType}
          t={t}
        />
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
    gap: 18,
    // Deja libre la zona del botón flotante del chat.
    paddingBottom: 130,
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
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
  },
  sectionDesc: {
    fontSize: 13,
    color: colors.soft,
    lineHeight: 18,
    marginBottom: 2,
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
