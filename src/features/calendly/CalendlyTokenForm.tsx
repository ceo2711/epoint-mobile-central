import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTranslation } from "@/contexts/LanguageContext";
import { getUserFacingErrorMessage } from "@/lib/api";
import { colors } from "@/theme/tokens";

type CalendlyTokenFormProps = {
  defaultSchedulingUrl?: string;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (accessToken: string, schedulingUrl?: string) => Promise<void>;
};

export function CalendlyTokenForm({
  defaultSchedulingUrl = "",
  submitLabel,
  submittingLabel,
  onSubmit,
}: CalendlyTokenFormProps) {
  const { t } = useTranslation();
  const [accessToken, setAccessToken] = useState("");
  const [schedulingUrl, setSchedulingUrl] = useState(defaultSchedulingUrl);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const tokenValue = accessToken.trim();
    if (!tokenValue) return;
    setError("");
    setSubmitting(true);
    try {
      await onSubmit(tokenValue, schedulingUrl.trim() || undefined);
      setAccessToken("");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("calendly.connectError")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.wrap}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Input
        label={t("calendly.tokenLabel")}
        value={accessToken}
        onChangeText={setAccessToken}
        placeholder={t("calendly.tokenPlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Input
        label={t("calendly.schedulingUrlLabel")}
        value={schedulingUrl}
        onChangeText={setSchedulingUrl}
        placeholder="https://calendly.com/tu-usuario"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Text style={styles.help}>{t("calendly.tokenHelp")}</Text>
      <Button
        title={submitting ? submittingLabel : submitLabel}
        loading={submitting}
        disabled={!accessToken.trim()}
        fullWidth
        onPress={() => void handleSubmit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  help: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.soft,
  },
});
