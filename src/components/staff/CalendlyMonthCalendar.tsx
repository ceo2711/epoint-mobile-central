import { useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTranslation } from "@/contexts/LanguageContext";
import type { CalendlyEvent } from "@/types/api";
import { colors, radii, spacing } from "@/theme/tokens";

type CalendlyMonthCalendarProps = {
  events: CalendlyEvent[];
  locale?: "es" | "en";
};

const WEEKDAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale === "en" ? "en-US" : "es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendlyMonthCalendar({
  events,
  locale = "es",
}: CalendlyMonthCalendarProps) {
  const { t } = useTranslation();
  const weekdays = locale === "en" ? WEEKDAYS_EN : WEEKDAYS_ES;

  const activeEvents = useMemo(
    () => events.filter((e) => e.status !== "canceled"),
    [events],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendlyEvent[]>();
    for (const event of activeEvents) {
      const key = toDayKey(new Date(event.start_time));
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      );
    }
    return map;
  }, [activeEvents]);

  const initialDay = useMemo(() => {
    if (activeEvents.length === 0) return toDayKey(new Date());
    const sorted = [...activeEvents].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
    return toDayKey(new Date(sorted[0].start_time));
  }, [activeEvents]);

  const [cursor, setCursor] = useState(() => {
    const d = parseDayKey(initialDay);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [detail, setDetail] = useState<CalendlyEvent | null>(null);

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const monthLabel = useMemo(() => {
    const d = new Date(cursor.year, cursor.month, 1);
    return d.toLocaleDateString(locale === "en" ? "en-US" : "es", {
      month: "long",
      year: "numeric",
    });
  }, [cursor.year, cursor.month, locale]);

  const dayEvents = eventsByDay.get(selectedDay) ?? [];
  const today = toDayKey(new Date());

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable
            accessibilityRole="button"
            onPress={() => shiftMonth(-1)}
            style={styles.navBtn}
          >
            <Ionicons name="chevron-back" size={20} color={colors.brand} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => shiftMonth(1)}
            style={styles.navBtn}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.brand} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {weekdays.map((d) => (
            <Text key={d} style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((date, index) => {
            if (!date) {
              return <View key={`empty-${index}`} style={styles.dayCell} />;
            }
            const key = toDayKey(date);
            const selected = key === selectedDay;
            const isToday = key === today;
            const hasEvents = (eventsByDay.get(key)?.length ?? 0) > 0;

            return (
              <Pressable
                key={key}
                onPress={() => setSelectedDay(key)}
                style={[
                  styles.dayCell,
                  selected && styles.daySelected,
                  !selected && isToday && styles.dayToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayNum,
                    selected && styles.dayNumSelected,
                    !selected && isToday && styles.dayNumToday,
                  ]}
                >
                  {date.getDate()}
                </Text>
                {hasEvents ? (
                  <View
                    style={[styles.dot, selected && styles.dotSelected]}
                  />
                ) : (
                  <View style={styles.dotSpacer} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.agenda}>
        <Text style={styles.agendaTitle}>
          {t("calendar.dayAgenda", {
            date: parseDayKey(selectedDay).toLocaleDateString(
              locale === "en" ? "en-US" : "es",
              { weekday: "long", day: "numeric", month: "long" },
            ),
          })}
        </Text>

        {dayEvents.length === 0 ? (
          <Text style={styles.emptyDay}>{t("calendar.emptyDay")}</Text>
        ) : (
          <ScrollView style={styles.agendaList} nestedScrollEnabled>
            {dayEvents.map((event) => (
              <Pressable
                key={event.id}
                onPress={() => setDetail(event)}
                style={({ pressed }) => [
                  styles.eventHit,
                  pressed && styles.eventPressed,
                ]}
              >
                <View style={styles.eventRow}>
                  <View style={styles.eventTimeCol}>
                    <Text style={styles.eventTime}>
                      {formatTime(event.start_time, locale)}
                    </Text>
                    <Text style={styles.eventTimeEnd}>
                      {formatTime(event.end_time, locale)}
                    </Text>
                  </View>
                  <View style={styles.eventBody}>
                    <Text style={styles.eventName} numberOfLines={1}>
                      {event.invitee_name
                        ? `${event.invitee_name} · ${event.name}`
                        : event.name}
                    </Text>
                    {event.invitee_email ? (
                      <Text style={styles.eventMeta} numberOfLines={1}>
                        {event.invitee_email}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.eventChevron}>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={colors.brownMuted}
                    />
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <Modal
        visible={detail != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetail(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDetail(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {detail ? (
              <>
                <Text style={styles.modalTitle}>{detail.name}</Text>
                <Text style={styles.modalMeta}>
                  {new Date(detail.start_time).toLocaleString(
                    locale === "en" ? "en-US" : "es",
                  )}{" "}
                  – {formatTime(detail.end_time, locale)}
                </Text>
                {detail.invitee_name ? (
                  <Text style={styles.modalMeta}>
                    {detail.invitee_name}
                    {detail.invitee_email ? ` · ${detail.invitee_email}` : ""}
                  </Text>
                ) : null}
                {detail.location ? (
                  <Text style={styles.modalMeta}>{detail.location}</Text>
                ) : null}
                {detail.meeting_url ? (
                  <Pressable
                    onPress={() => void Linking.openURL(detail.meeting_url!)}
                    style={styles.linkBtn}
                  >
                    <Text style={styles.linkBtnText}>
                      {t("calendar.openMeeting")}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setDetail(null)}
                  style={styles.closeBtn}
                >
                  <Text style={styles.closeBtnText}>{t("common.close")}</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    flex: 1,
  },
  calendarCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.brownSoft,
    padding: spacing.md,
    shadowColor: "#5c4033",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  navBtn: {
    padding: spacing.sm,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.brown,
    textTransform: "capitalize",
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
  },
  weekday: {
    width: "14.2857%",
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: colors.soft,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 2,
  },
  daySelected: {
    backgroundColor: colors.brand,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  dayNumSelected: {
    color: colors.white,
  },
  dayNumToday: {
    color: colors.brand,
    fontWeight: "800",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.brand,
    marginTop: 2,
  },
  dotSelected: {
    backgroundColor: colors.white,
  },
  dotSpacer: {
    width: 5,
    height: 5,
    marginTop: 2,
  },
  agenda: {
    gap: spacing.sm,
    flex: 1,
    minHeight: 160,
  },
  agendaTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brown,
    textTransform: "capitalize",
  },
  emptyDay: {
    fontSize: 13,
    color: colors.soft,
    paddingVertical: spacing.md,
  },
  agendaList: {
    maxHeight: 280,
  },
  eventHit: {
    marginBottom: spacing.sm,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  eventPressed: {
    opacity: 0.92,
  },
  eventTimeCol: {
    width: 54,
    marginRight: spacing.md,
  },
  eventTime: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.brand,
  },
  eventTimeEnd: {
    fontSize: 11,
    color: colors.soft,
  },
  eventBody: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  eventName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  eventMeta: {
    fontSize: 12,
    color: colors.soft,
    marginTop: 2,
  },
  eventChevron: {
    width: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brown,
  },
  modalMeta: {
    fontSize: 14,
    color: colors.soft,
  },
  linkBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.brandLight,
    borderRadius: radii.control,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  linkBtnText: {
    color: colors.brand,
    fontWeight: "700",
  },
  closeBtn: {
    marginTop: spacing.sm,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  closeBtnText: {
    color: colors.soft,
    fontWeight: "600",
  },
});
