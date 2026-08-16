import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import {
  getConfiguredProviders,
  getDefaultProvider,
  getProviderLabel,
} from "@/features/payments/providers";
import { ProspectSearchSelect } from "@/features/prospects/ProspectSearchSelect";
import { searchProspects } from "@/features/prospects/searchProspects";
import { colors, radii } from "@/theme/tokens";
import type { PaymentConfig, Prospect } from "@/types/api";

const MIN_NAME_SEARCH_LENGTH = 3;
const MIN_EMAIL_SEARCH_LENGTH = 3;
const EMAIL_LOOKUP_DEBOUNCE_MS = 400;
const MIN_EMAIL_LOOKUP_LENGTH = 5;

export type PaymentLinkFormValues = {
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  amount: string;
  provider: string;
  description: string;
  send_email: boolean;
  prospect_id?: number;
};

function buildExternalProspectSearch(
  firstName: string,
  lastName: string,
  email: string,
): string {
  const normalizedEmail = email.trim();
  if (normalizedEmail.includes("@") && normalizedEmail.length >= MIN_EMAIL_SEARCH_LENGTH) {
    return normalizedEmail;
  }
  const fullName = `${firstName} ${lastName}`.trim().replace(/\s+/g, " ");
  return fullName.length >= MIN_NAME_SEARCH_LENGTH ? fullName : "";
}

type PaymentLinkFormProps = {
  config: PaymentConfig | null;
  submitting: boolean;
  initialData?: Partial<PaymentLinkFormValues>;
  initialProspect?: Prospect | null;
  hideProspectSearch?: boolean;
  resetKey?: string | number;
  onSubmit: (payload: {
    customer_first_name: string;
    customer_last_name: string;
    customer_email: string;
    customer_phone: string;
    amount: number;
    currency: "USD";
    provider: string;
    description?: string;
    prospect_id?: number;
    send_email: boolean;
  }) => Promise<void>;
};

function buildForm(
  config: PaymentConfig | null,
  initialData?: Partial<PaymentLinkFormValues>,
): PaymentLinkFormValues {
  return {
    customer_first_name: initialData?.customer_first_name ?? "",
    customer_last_name: initialData?.customer_last_name ?? "",
    customer_email: initialData?.customer_email ?? "",
    customer_phone: initialData?.customer_phone ?? "",
    amount: initialData?.amount ?? "",
    provider: initialData?.provider ?? getDefaultProvider(config),
    description: initialData?.description ?? "",
    send_email: initialData?.send_email ?? true,
    prospect_id: initialData?.prospect_id,
  };
}

export function PaymentLinkForm({
  config,
  submitting,
  initialData,
  initialProspect,
  hideProspectSearch = false,
  resetKey,
  onSubmit,
}: PaymentLinkFormProps) {
  const { t } = useTranslation();
  const { token, hasPermission } = useAuth();
  const canSearchProspects =
    hasPermission("prospects:read") || hasPermission("prospects:update");
  const availableProviders = useMemo(() => getConfiguredProviders(config), [config]);
  const initialRef = useRef(initialData);
  initialRef.current = initialData;
  const [form, setForm] = useState<PaymentLinkFormValues>(() => buildForm(config, initialData));
  const [linkedProspect, setLinkedProspect] = useState<Prospect | null>(
    initialProspect ?? null,
  );

  const showProspectSearch = !hideProspectSearch && canSearchProspects;
  const externalProspectSearch = useMemo(
    () =>
      buildExternalProspectSearch(
        form.customer_first_name,
        form.customer_last_name,
        form.customer_email,
      ),
    [form.customer_first_name, form.customer_last_name, form.customer_email],
  );

  const onSearch = useCallback(
    async (query: string) => {
      if (!token || !canSearchProspects) return { items: [] as Prospect[], total: 0 };
      return searchProspects(token, query);
    },
    [token, canSearchProspects],
  );

  useEffect(() => {
    setForm(buildForm(config, initialRef.current));
    setLinkedProspect(initialProspect ?? null);
  }, [resetKey, config, initialProspect]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      provider: availableProviders.includes(current.provider)
        ? current.provider
        : getDefaultProvider(config),
    }));
  }, [config, availableProviders]);

  useEffect(() => {
    if (!linkedProspect) return;
    const email = form.customer_email.trim().toLowerCase();
    if (email && linkedProspect.email.toLowerCase() !== email) {
      setLinkedProspect(null);
    }
  }, [form.customer_email, linkedProspect]);

  useEffect(() => {
    if (!showProspectSearch) return;
    const email = form.customer_email.trim();
    if (!email.includes("@") || email.length < MIN_EMAIL_LOOKUP_LENGTH) return;
    if (linkedProspect?.email.toLowerCase() === email.toLowerCase()) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void onSearch(email).then(({ items }) => {
        if (cancelled) return;
        const match = items.find((item) => item.email.toLowerCase() === email.toLowerCase());
        if (!match) return;
        setLinkedProspect(match);
        setForm((current) => ({
          ...current,
          customer_first_name: match.first_name || current.customer_first_name,
          customer_last_name: match.last_name || current.customer_last_name,
          customer_email: match.email,
          customer_phone: match.phone || current.customer_phone,
          prospect_id: match.id,
        }));
      });
    }, EMAIL_LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.customer_email, showProspectSearch, onSearch, linkedProspect?.email]);

  function handleProspectChange(prospect: Prospect | null) {
    setLinkedProspect(prospect);
    if (!prospect) {
      setForm((current) => ({ ...current, prospect_id: undefined }));
      return;
    }
    setForm((current) => ({
      ...current,
      customer_first_name: prospect.first_name,
      customer_last_name: prospect.last_name,
      customer_email: prospect.email,
      customer_phone: prospect.phone,
      prospect_id: prospect.id,
    }));
  }

  const amount = Number(form.amount.replace(",", "."));
  const canSubmit =
    Boolean(config?.payments_enabled) &&
    !submitting &&
    form.customer_first_name.trim().length > 0 &&
    form.customer_last_name.trim().length > 0 &&
    form.customer_email.trim().length > 0 &&
    form.customer_phone.trim().length > 0 &&
    Number.isFinite(amount) &&
    amount > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    await onSubmit({
      customer_first_name: form.customer_first_name.trim(),
      customer_last_name: form.customer_last_name.trim(),
      customer_email: form.customer_email.trim(),
      customer_phone: form.customer_phone.trim(),
      amount,
      currency: "USD",
      provider: form.provider,
      description: form.description.trim() || undefined,
      prospect_id: linkedProspect?.id ?? form.prospect_id ?? initialData?.prospect_id,
      send_email: form.send_email,
    });
  }

  const submitLabel = form.send_email
    ? submitting
      ? t("payments.form.generatingAndSending")
      : t("payments.form.generateAndSend")
    : submitting
      ? t("payments.form.generating")
      : t("payments.form.generate");

  return (
    <View style={styles.wrap}>
      <Input
        label={t("payments.form.firstName")}
        value={form.customer_first_name}
        onChangeText={(customer_first_name) => setForm((current) => ({ ...current, customer_first_name }))}
        autoCapitalize="words"
      />
      <Input
        label={t("payments.form.lastName")}
        value={form.customer_last_name}
        onChangeText={(customer_last_name) => setForm((current) => ({ ...current, customer_last_name }))}
        autoCapitalize="words"
      />
      <Input
        label={t("payments.form.email")}
        value={form.customer_email}
        onChangeText={(customer_email) => setForm((current) => ({ ...current, customer_email }))}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Input
        label={t("payments.form.phone")}
        value={form.customer_phone}
        onChangeText={(customer_phone) => setForm((current) => ({ ...current, customer_phone }))}
        keyboardType="phone-pad"
      />
      {showProspectSearch ? (
        <ProspectSearchSelect
          label={t("payments.form.searchProspect")}
          searchPlaceholder={t("payments.form.searchProspectPlaceholder")}
          prospect={linkedProspect}
          externalSearch={externalProspectSearch}
          onSearch={onSearch}
          onChange={handleProspectChange}
          disabled={!config?.payments_enabled || submitting}
          linkedHint={t("payments.form.prospectLinkedHint")}
          changeLabel={t("payments.form.changeProspect")}
          clearLabel={t("payments.form.clearProspect")}
        />
      ) : null}
      <Input
        label={t("payments.form.amount")}
        value={form.amount}
        onChangeText={(next) => setForm((current) => ({ ...current, amount: next }))}
        keyboardType="decimal-pad"
      />
      {availableProviders.length > 0 ? (
        <Select
          label={t("payments.form.provider")}
          value={form.provider}
          onChange={(provider) => setForm((current) => ({ ...current, provider }))}
          options={availableProviders.map((provider) => ({
            value: provider,
            label: getProviderLabel(provider),
          }))}
        />
      ) : null}
      <Input
        label={t("payments.form.description")}
        value={form.description}
        onChangeText={(description) => setForm((current) => ({ ...current, description }))}
      />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: form.send_email }}
        onPress={() => setForm((current) => ({ ...current, send_email: !current.send_email }))}
        style={styles.checkRow}
      >
        <View style={[styles.checkbox, form.send_email ? styles.checkboxOn : null]}>
          {form.send_email ? (
            <Ionicons name="checkmark" size={16} color={colors.white} />
          ) : null}
        </View>
        <View style={styles.checkTexts}>
          <Text style={styles.checkTitle}>{t("payments.form.sendEmail")}</Text>
          <Text style={styles.checkHint}>{t("payments.form.sendEmailHint")}</Text>
        </View>
      </Pressable>

      {config?.stub_mode ? (
        <Text style={styles.testHint}>
          {config.payment_test ? t("payments.paymentTestHint") : t("payments.stubModeHint")}
        </Text>
      ) : null}

      <Button
        title={submitLabel}
        loading={submitting}
        disabled={!canSubmit}
        onPress={() => void handleSubmit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.creamSoft,
    borderRadius: radii.control,
    padding: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkTexts: {
    flex: 1,
    gap: 4,
  },
  checkTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  checkHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.soft,
  },
  testHint: {
    fontSize: 13,
    lineHeight: 18,
    color: "#9a6b12",
    backgroundColor: "#fff8e8",
    borderWidth: 1,
    borderColor: "#f1d9a0",
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
