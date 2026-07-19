import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenState } from "@/components/ui/ScreenState";
import { Section } from "@/components/ui/Section";
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError, api, getUserFacingErrorMessage } from "@/lib/api";
import { TASK_STATUS_LABELS, type Board } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

const CARD_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDIENTE: { bg: "#fef3c7", text: "#92400e" },
  EN_PROGRESO: { bg: "#dbeafe", text: "#1e40af" },
  EN_REVISION: { bg: "#fef3c7", text: "#92400e" },
  COMPLETADA: { bg: colors.brandLight, text: colors.brand },
};

export default function PortalTableroScreen() {
  const { token, user, isLoading: authLoading } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const clientId = user?.client_id;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !clientId) {
        setLoading(false);
        setMissing(true);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setError(null);
      setMissing(false);
      try {
        const data = await api.get<Board>(`/boards/client/${clientId}`, token);
        setBoard(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setBoard(null);
          setMissing(true);
        } else {
          setError(getUserFacingErrorMessage(err, "No se pudo cargar el tablero"));
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, clientId],
  );

  useEffect(() => {
    if (!authLoading && token) {
      void load();
    }
  }, [authLoading, token, load]);

  if (authLoading || loading) {
    return <ScreenState loading message="Cargando tablero…" />;
  }

  const lists = [...(board?.lists ?? [])].sort((a, b) => a.position - b.position);

  return (
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
      <Text style={styles.title}>Tablero</Text>
      <Text style={styles.subtitle}>
        Seguimiento de las tareas de tu onboarding.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!board || missing || lists.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title="Todavía no hay tablero"
          description="Cuando tu asesor active el onboarding, vas a ver las listas y tarjetas acá."
        />
      ) : (
        lists.map((list) => {
          const cards = [...list.cards].sort((a, b) => a.position - b.position);
          return (
            <Section key={list.id} title={list.title}>
              {cards.length === 0 ? (
                <Text style={styles.emptyList}>Sin tarjetas en esta lista</Text>
              ) : (
                cards.map((card) => {
                  const palette =
                    CARD_STATUS_COLORS[card.status] ?? {
                      bg: colors.creamWarm,
                      text: colors.soft,
                    };
                  return (
                    <View key={card.id} style={styles.card}>
                      <Text style={styles.cardTitle}>{card.title}</Text>
                      <View style={[styles.badge, { backgroundColor: palette.bg }]}>
                        <Text style={[styles.badgeText, { color: palette.text }]}>
                          {TASK_STATUS_LABELS[card.status] ?? card.status}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </Section>
          );
        })
      )}
    </ScrollView>
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
    paddingBottom: 40,
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
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
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
  emptyList: {
    fontSize: 13,
    color: colors.soft,
  },
  error: {
    color: colors.danger,
  },
});
