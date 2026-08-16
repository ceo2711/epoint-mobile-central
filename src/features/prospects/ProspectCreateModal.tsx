import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { useTranslation } from "@/contexts/LanguageContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { canSuperviseSalesReps, isSalesAreaLeader, isSalesStaff } from "@/lib/roles";
import { colors, radii, spacing } from "@/theme/tokens";
import type {
  CalendlySalesRep,
  InfluencerBrief,
  MerchantBrief,
  ProspectAvailability,
  ProspectContactConflict,
  Source,
  User,
} from "@/types/api";

type ProspectCreateModalProps = {
  visible: boolean;
  token: string | null;
  user: User;
  salesReps: CalendlySalesRep[];
  onClose: () => void;
  onCreated: () => void;
};

function formatConflict(
  t: (key: string, params?: Record<string, string | number>) => string,
  kind: "email" | "phone",
  conflict: ProspectContactConflict,
): string {
  const entity = t(
    conflict.kind === "client"
      ? "prospects.conflictClient"
      : "prospects.conflictProspect",
  );
  return t(
    kind === "email" ? "prospects.duplicateEmail" : "prospects.duplicatePhone",
    { name: conflict.client_name, entity },
  );
}

export function ProspectCreateModal({
  visible,
  token,
  user,
  salesReps,
  onClose,
  onCreated,
}: ProspectCreateModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const salesLeader = isSalesAreaLeader(user);
  const canPickTeam = canSuperviseSalesReps(user);
  const canLoadSubs =
    isSalesStaff(user.role.code) && user.is_sub_seller !== true;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("OTHER");
  const [influencerId, setInfluencerId] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState(String(user.id));
  const [merchantId, setMerchantId] = useState("");
  const [isQualified, setIsQualified] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [sources, setSources] = useState<Source[]>([]);
  const [merchants, setMerchants] = useState<MerchantBrief[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerBrief[]>([]);
  const [teamSubs, setTeamSubs] = useState<CalendlySalesRep[]>([]);
  const [availability, setAvailability] = useState<ProspectAvailability | null>(
    null,
  );
  const [checking, setChecking] = useState(false);

  const resetForm = useCallback(() => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setSource("OTHER");
    setInfluencerId("");
    setAssignedToUserId(String(user.id));
    setMerchantId("");
    setIsQualified(true);
    setNotes("");
    setFormError(null);
    setAvailability(null);
  }, [user.id]);

  useEffect(() => {
    if (!visible) return;
    resetForm();
  }, [visible, resetForm]);

  useEffect(() => {
    if (!visible || !token) return;
    let cancelled = false;
    const fromUser = user.merchants ?? [];
    const merchantsPromise =
      fromUser.length > 0
        ? Promise.resolve(fromUser)
        : api.get<MerchantBrief[]>("/merchants/options", token);

    void Promise.all([
      api.get<Source[]>("/sources/options", token).catch(() => [] as Source[]),
      merchantsPromise.catch(() => [] as MerchantBrief[]),
      api
        .get<InfluencerBrief[]>("/influencers/options", token)
        .catch(() => [] as InfluencerBrief[]),
      canLoadSubs
        ? api.get<User[]>("/sub-sellers", token).catch(() => [] as User[])
        : Promise.resolve([] as User[]),
    ]).then(([nextSources, nextMerchants, nextInfluencers, subs]) => {
      if (cancelled) return;
      setSources(nextSources);
      setMerchants(nextMerchants);
      setInfluencers(nextInfluencers);
      setTeamSubs(
        subs.map((sub) => ({
          id: sub.id,
          first_name: sub.first_name,
          last_name: sub.last_name,
          email: sub.email,
          connected: false,
          scheduling_url: null,
          last_synced_at: null,
          parent_user_id: sub.parent_user_id ?? user.id,
          parent_name: `${user.first_name} ${user.last_name}`.trim(),
        })),
      );
      if (nextMerchants.length === 1) {
        setMerchantId(String(nextMerchants[0].id));
      }
      if (
        nextSources.length > 0 &&
        !nextSources.some((item) => item.code === "OTHER")
      ) {
        setSource(nextSources[0].code);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    visible,
    token,
    canLoadSubs,
    user.id,
    user.first_name,
    user.last_name,
    user.merchants,
  ]);

  const extraReps = canPickTeam ? salesReps : teamSubs;
  const salesRepOptions = useMemo(() => {
    const options: SelectOption[] = [
      { value: String(user.id), label: t("common.assignToMe") },
    ];
    for (const rep of extraReps) {
      if (rep.id === user.id) continue;
      const name = `${rep.first_name} ${rep.last_name}`.trim() || rep.email;
      options.push({
        value: String(rep.id),
        label: name,
        hint: rep.parent_name
          ? t("calendly.subSellerOf", { name: rep.parent_name })
          : undefined,
      });
    }
    return options;
  }, [extraReps, t, user.id]);

  const assignedId = assignedToUserId ? Number(assignedToUserId) : null;
  const needsInfluencer = source === "INFLUENCERS";
  const influencersForRep = useMemo(() => {
    if (!needsInfluencer) return [];
    if (assignedId == null) return influencers;
    if (salesLeader && assignedId === user.id) return influencers;
    return influencers.filter((item) => item.sales_rep_user_id === assignedId);
  }, [assignedId, influencers, needsInfluencer, salesLeader, user.id]);

  useEffect(() => {
    if (!needsInfluencer) {
      if (influencerId) setInfluencerId("");
      return;
    }
    if (
      influencerId &&
      !influencersForRep.some((item) => String(item.id) === influencerId)
    ) {
      setInfluencerId("");
    }
  }, [influencerId, influencersForRep, needsInfluencer]);

  useEffect(() => {
    if (!visible || !token || !merchantId) {
      setAvailability(null);
      setChecking(false);
      return;
    }
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const canCheckEmail =
      trimmedEmail.includes("@") && trimmedEmail.includes(".");
    const canCheckPhone = trimmedPhone.length >= 5;
    if (!canCheckEmail && !canCheckPhone) {
      setAvailability(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ merchant_id: merchantId });
      if (canCheckEmail) params.set("email", trimmedEmail);
      if (canCheckPhone) params.set("phone", trimmedPhone);
      void api
        .get<ProspectAvailability>(
          `/prospects/check-availability?${params.toString()}`,
          token,
        )
        .then(setAvailability)
        .catch(() => setAvailability(null))
        .finally(() => setChecking(false));
    }, 400);
    return () => clearTimeout(handle);
  }, [visible, token, merchantId, email, phone]);

  const emailError = availability?.email
    ? formatConflict(t, "email", availability.email)
    : undefined;
  const phoneError = availability?.phone
    ? formatConflict(t, "phone", availability.phone)
    : undefined;
  const hasConflict = Boolean(availability?.email || availability?.phone);
  const noRepInfluencers =
    needsInfluencer &&
    Boolean(assignedToUserId) &&
    influencersForRep.length === 0;

  const formComplete =
    Boolean(
      firstName.trim() &&
        lastName.trim() &&
        email.trim() &&
        phone.trim() &&
        merchantId &&
        assignedToUserId,
    ) &&
    (!needsInfluencer || (Boolean(influencerId) && influencersForRep.length > 0));

  async function handleCreate() {
    if (!token || !formComplete || hasConflict) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        source: source || "OTHER",
        merchant_id: Number(merchantId),
        assigned_to_user_id: Number(assignedToUserId),
        is_qualified: isQualified,
        notes: notes.trim() || undefined,
      };
      if (needsInfluencer && influencerId) {
        payload.influencer_id = Number(influencerId);
      }
      await api.post("/prospects", payload, token);
      onCreated();
      onClose();
    } catch (err) {
      setFormError(getUserFacingErrorMessage(err, t("prospects.createError")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.card,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <Text style={styles.title}>{t("prospects.createTitle")}</Text>

            <Input
              label={t("common.firstName")}
              value={firstName}
              onChangeText={setFirstName}
            />
            <Input
              label={t("common.lastName")}
              value={lastName}
              onChangeText={setLastName}
            />
            <Input
              label={t("common.email")}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              error={emailError}
            />
            <Input
              label={t("common.phone")}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              error={phoneError}
            />

            {sources.length > 0 ? (
              <Select
                label={t("prospects.source")}
                value={source}
                onChange={(next) => {
                  setSource(next);
                  setInfluencerId("");
                }}
                options={sources.map((item) => ({
                  value: item.code,
                  label: item.name,
                }))}
              />
            ) : null}

            {needsInfluencer ? (
              <>
                <Select
                  label={t("prospects.influencer")}
                  value={influencerId}
                  onChange={setInfluencerId}
                  placeholder={t("prospects.selectInfluencer")}
                  disabled={!assignedToUserId || noRepInfluencers}
                  options={influencersForRep.map((item) => ({
                    value: String(item.id),
                    label: item.handle
                      ? `${item.name} (${item.handle})`
                      : item.name,
                  }))}
                />
                {noRepInfluencers ? (
                  <Text style={styles.hintWarn}>
                    {t("prospects.noInfluencersForSalesRep")}
                  </Text>
                ) : null}
              </>
            ) : null}

            <Select
              label={t("prospects.salesRep")}
              value={assignedToUserId}
              onChange={(next) => {
                setAssignedToUserId(next);
                setInfluencerId("");
              }}
              options={salesRepOptions}
            />

            <Select
              label={t("prospects.merchant")}
              value={merchantId}
              onChange={setMerchantId}
              placeholder={t("prospects.selectMerchant")}
              options={merchants.map((item) => ({
                value: String(item.id),
                label: item.name,
              }))}
            />

            <Text style={styles.sectionLabel}>
              {t("prospects.qualification")}
            </Text>
            <View style={styles.radioRow}>
              <Pressable
                onPress={() => setIsQualified(true)}
                style={[styles.radio, isQualified ? styles.radioActive : null]}
              >
                <Text
                  style={[
                    styles.radioText,
                    isQualified ? styles.radioTextActive : null,
                  ]}
                >
                  {t("prospects.qualified")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setIsQualified(false)}
                style={[styles.radio, !isQualified ? styles.radioActive : null]}
              >
                <Text
                  style={[
                    styles.radioText,
                    !isQualified ? styles.radioTextActive : null,
                  ]}
                >
                  {t("prospects.unqualified")}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>{t("prospects.qualificationHint")}</Text>

            <Text style={styles.sectionLabel}>{t("prospects.notes")}</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
              placeholderTextColor={colors.brownMuted}
              style={styles.notes}
            />

            {formError ? <Text style={styles.error}>{formError}</Text> : null}

            <View style={styles.actions}>
              <Button
                title={t("common.cancel")}
                variant="secondary"
                onPress={onClose}
                style={styles.actionBtn}
              />
              <Button
                title={t("prospects.createAction")}
                loading={saving}
                disabled={
                  saving || checking || hasConflict || !formComplete
                }
                onPress={() => void handleCreate()}
                style={styles.actionBtn}
              />
            </View>
          </ScrollView>
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
  card: {
    maxHeight: "92%",
    backgroundColor: colors.cream,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brown,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brown,
  },
  radioRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  radio: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  radioActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  radioText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brown,
  },
  radioTextActive: {
    color: colors.brand,
  },
  hint: {
    fontSize: 12,
    color: colors.soft,
  },
  hintWarn: {
    fontSize: 12,
    color: "#9a6b12",
  },
  notes: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
