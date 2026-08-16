import { StyleSheet, Text } from "react-native";

import { Card } from "@/components/ui/Card";
import { useTranslation } from "@/contexts/LanguageContext";
import { CalendlyTokenForm } from "@/features/calendly/CalendlyTokenForm";
import { colors } from "@/theme/tokens";

type CalendlyConnectPanelProps = {
  onConnect: (accessToken: string, schedulingUrl?: string) => Promise<void>;
};

export function CalendlyConnectPanel({ onConnect }: CalendlyConnectPanelProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <Text style={styles.title}>{t("calendly.connectTitle")}</Text>
      <Text style={styles.subtitle}>{t("calendly.connectSubtitle")}</Text>
      <CalendlyTokenForm
        submitLabel={t("calendly.connectAction")}
        submittingLabel={t("calendly.connecting")}
        onSubmit={onConnect}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.soft,
    marginBottom: 4,
  },
});
