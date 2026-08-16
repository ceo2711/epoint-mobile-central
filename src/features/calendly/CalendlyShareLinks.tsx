import { Share, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useTranslation } from "@/contexts/LanguageContext";
import { colors } from "@/theme/tokens";
import type { CalendlyEventType } from "@/types/api";

type CalendlyShareLinksProps = {
  eventTypes: CalendlyEventType[];
  loading?: boolean;
};

export function CalendlyShareLinks({ eventTypes, loading = false }: CalendlyShareLinksProps) {
  const { t } = useTranslation();
  const shareable = eventTypes.filter((item) => item.scheduling_url);

  return (
    <Card>
      <Text style={styles.title}>{t("calendly.shareTitle")}</Text>
      <Text style={styles.subtitle}>{t("calendly.shareSubtitle")}</Text>
      {loading ? (
        <Text style={styles.muted}>{t("calendly.loadingEventTypes")}</Text>
      ) : shareable.length === 0 ? (
        <Text style={styles.muted}>{t("calendly.noShareLinks")}</Text>
      ) : (
        shareable.map((eventType) => (
          <View key={eventType.uri} style={styles.item}>
            <Text style={styles.name}>{eventType.name}</Text>
            <Text style={styles.muted}>
              {t("calendly.eventTypeDuration", { minutes: String(eventType.duration) })}
            </Text>
            <Text style={styles.url}>{eventType.scheduling_url}</Text>
            <View style={styles.actions}>
              <Button
                title={t("calendly.copyLink")}
                variant="secondary"
                style={styles.actionBtn}
                onPress={() =>
                  void Share.share({ message: eventType.scheduling_url ?? "" })
                }
              />
              <Button
                title={t("calendly.openLink")}
                variant="ghost"
                style={styles.actionBtn}
                onPress={() =>
                  void WebBrowser.openBrowserAsync(eventType.scheduling_url!)
                }
              />
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.soft,
  },
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
  item: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  url: {
    fontSize: 12,
    color: colors.ink,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flexGrow: 1,
  },
});
