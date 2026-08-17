import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { ProspectSearchSelect } from "@/features/prospects/ProspectSearchSelect";
import { searchProspects } from "@/features/prospects/searchProspects";
import { getUserFacingErrorMessage } from "@/lib/api";
import { colors, radii } from "@/theme/tokens";
import type { Prospect } from "@/types/api";

const EMAIL_LOOKUP_DEBOUNCE_MS = 400;
const MIN_EMAIL_LOOKUP_LENGTH = 5;

export type DocusignTemplateOption = {
  template_id: string;
  name: string;
};

export type SendContractPayload = {
  signer_name: string;
  signer_email: string;
  subject?: string;
  template_id?: string;
  prospect_id?: number;
  client_id?: number;
};

type SendContractModalProps = {
  visible: boolean;
  templates: DocusignTemplateOption[];
  defaultTemplateId?: string | null;
  initialSigner?: { name: string; email: string } | null;
  prospectId?: number;
  initialProspect?: Pick<
    Prospect,
    "id" | "full_name" | "email" | "status" | "first_name" | "last_name" | "phone"
  > | null;
  hideProspectSearch?: boolean;
  onClose: () => void;
  onSubmit: (payload: SendContractPayload) => Promise<void>;
};

export function SendContractModal({
  visible,
  templates,
  defaultTemplateId,
  initialSigner,
  prospectId,
  initialProspect,
  hideProspectSearch = false,
  onClose,
  onSubmit,
}: SendContractModalProps) {
  const { t } = useTranslation();
  const { token, hasPermission } = useAuth();
  const insets = useSafeAreaInsets();
  const canSearchProspects =
    hasPermission("prospects:read") || hasPermission("prospects:update");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedProspect, setLinkedProspect] = useState<Prospect | null>(null);
  const skipEmailLinkRef = useRef(false);

  const onSearch = useCallback(
    async (query: string) => {
      if (!token || !canSearchProspects) return { items: [] as Prospect[], total: 0 };
      return searchProspects(token, query);
    },
    [token, canSearchProspects],
  );

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSending(false);
    setSignerName(initialSigner?.name ?? initialProspect?.full_name ?? "");
    setSignerEmail(initialSigner?.email ?? initialProspect?.email ?? "");
    setSubject(t("contracts.defaultSubject"));
    setTemplateId(defaultTemplateId || templates[0]?.template_id || "");
    setLinkedProspect(
      initialProspect
        ? ({
            ...initialProspect,
            first_name: initialProspect.first_name ?? "",
            last_name: initialProspect.last_name ?? "",
            phone: initialProspect.phone ?? "",
          } as Prospect)
        : null,
    );
    skipEmailLinkRef.current = Boolean(initialProspect || prospectId);
  }, [
    visible,
    initialSigner?.name,
    initialSigner?.email,
    initialProspect,
    prospectId,
    defaultTemplateId,
    templates,
    t,
  ]);

  useEffect(() => {
    if (!visible || hideProspectSearch || !canSearchProspects) return;

    const email = signerEmail.trim();
    if (!email.includes("@") || email.length < MIN_EMAIL_LOOKUP_LENGTH) return;
    if (skipEmailLinkRef.current) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void onSearch(email).then(({ items }) => {
        if (cancelled) return;
        const match = items.find(
          (item) => item.email.toLowerCase() === email.toLowerCase(),
        );
        if (match) {
          setLinkedProspect(match);
          setSignerName(match.full_name);
          return;
        }
        setLinkedProspect((current) => {
          if (current && current.email.toLowerCase() !== email.toLowerCase()) {
            return null;
          }
          return current;
        });
      });
    }, EMAIL_LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, signerEmail, onSearch, hideProspectSearch, canSearchProspects]);

  function handleProspectChange(prospect: Prospect | null) {
    if (!prospect) {
      skipEmailLinkRef.current = true;
      setLinkedProspect(null);
      return;
    }
    skipEmailLinkRef.current = false;
    setLinkedProspect(prospect);
    setSignerName(prospect.full_name);
    setSignerEmail(prospect.email);
  }

  function handleSignerEmailChange(email: string) {
    if (skipEmailLinkRef.current && email.trim() !== signerEmail.trim()) {
      skipEmailLinkRef.current = false;
    }
    setSignerEmail(email);
  }

  function handleClose() {
    if (sending) return;
    onClose();
  }

  async function handleSend() {
    if (!signerName.trim() || !signerEmail.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit({
        signer_name: signerName.trim(),
        signer_email: signerEmail.trim(),
        subject: subject.trim() || undefined,
        template_id: templateId || undefined,
        prospect_id: linkedProspect?.id ?? prospectId,
      });
      onClose();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("contracts.sendError")));
    } finally {
      setSending(false);
    }
  }

  const showProspectSearch =
    !hideProspectSearch && (canSearchProspects || Boolean(linkedProspect));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>{t("contracts.send")}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <Input
              label={t("contracts.signerName")}
              value={signerName}
              onChangeText={setSignerName}
            />
            <Input
              label={t("contracts.signerEmail")}
              value={signerEmail}
              onChangeText={handleSignerEmailChange}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {showProspectSearch ? (
              <ProspectSearchSelect
                label={t("contracts.searchProspect")}
                searchPlaceholder={t("contracts.searchProspectPlaceholder")}
                prospect={linkedProspect}
                externalSearch={signerEmail}
                onSearch={onSearch}
                onChange={handleProspectChange}
                disabled={!canSearchProspects || sending}
                linkedHint={t("contracts.prospectLinkedHint")}
                changeLabel={t("contracts.changeProspect")}
                clearLabel={t("contracts.clearProspect")}
              />
            ) : null}
            <Input
              label={t("contracts.subject")}
              value={subject}
              onChangeText={setSubject}
            />
            {templates.length > 0 ? (
              <Select
                label={t("contracts.template")}
                value={templateId}
                onChange={setTemplateId}
                options={templates.map((item) => ({
                  value: item.template_id,
                  label: item.name,
                }))}
                placeholder={t("contracts.selectTemplate")}
              />
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <Button
              title={t("common.cancel")}
              variant="secondary"
              disabled={sending}
              onPress={handleClose}
              style={styles.actionBtn}
            />
            <Button
              title={t("contracts.send")}
              loading={sending}
              disabled={!signerName.trim() || !signerEmail.trim()}
              onPress={() => void handleSend()}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: "88%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brown,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  body: {
    gap: 12,
    paddingBottom: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
  },
});
