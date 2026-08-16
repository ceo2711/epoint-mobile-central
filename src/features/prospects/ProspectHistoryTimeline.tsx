import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/contexts/LanguageContext";
import { colors, radii } from "@/theme/tokens";
import type { ProspectHistoryEntry } from "@/types/api";

type ProspectHistoryTimelineProps = {
  history: ProspectHistoryEntry[];
  locale: string;
};

function formatDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale === "en" ? "en-US" : "es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function displayHistoryNote(note: string | null) {
  if (!note) return null;
  return note.replace(/\s*\(envelope_id=\d+\)$/, "");
}

export function ProspectHistoryTimeline({ history, locale }: ProspectHistoryTimelineProps) {
  const { t } = useTranslation();
  const chronological = [...history].reverse();

  if (history.length === 0) {
    return <Text style={styles.muted}>{t("prospects.history.empty")}</Text>;
  }

  return (
    <View style={styles.list}>
      {chronological.map((entry, index) => {
        const fromLabel = entry.from_status
          ? t(`prospects.statusLabels.${entry.from_status}`)
          : null;
        const toLabel = entry.to_status
          ? t(`prospects.statusLabels.${entry.to_status}`)
          : null;
        const showTransition =
          Boolean(fromLabel && toLabel && entry.from_status !== entry.to_status);
        const note = displayHistoryNote(entry.note);

        return (
          <View key={entry.id} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.line, index === 0 ? styles.lineHidden : null]} />
              <View style={styles.dot} />
              <View
                style={[
                  styles.line,
                  index === chronological.length - 1 ? styles.lineHidden : null,
                ]}
              />
            </View>
            <View style={styles.card}>
              <Text style={styles.event}>
                {t(`prospects.history.event.${entry.event_type}`)}
              </Text>
              <Text style={styles.muted}>{formatDateTime(entry.created_at, locale)}</Text>
              {showTransition ? (
                <Text style={styles.transition}>
                  {fromLabel} → {toLabel}
                </Text>
              ) : null}
              {note ? <Text style={styles.note}>{note}</Text> : null}
              {entry.changed_by_name ? (
                <Text style={styles.muted}>
                  {t("prospects.history.by", { name: entry.changed_by_name })}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 0,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rail: {
    width: 12,
    alignItems: "center",
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.line,
  },
  lineHidden: {
    backgroundColor: "transparent",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    padding: 12,
    gap: 4,
    marginBottom: 10,
  },
  event: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.brownMuted,
  },
  muted: {
    fontSize: 12,
    color: colors.soft,
  },
  transition: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
  },
  note: {
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },
});
