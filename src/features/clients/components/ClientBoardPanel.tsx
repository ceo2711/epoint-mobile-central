import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatDateTime } from "@/features/clients/format";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { Board, BoardCard, BoardList, CardComment } from "@/types/api";
import { TASK_STATUS_LABELS } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

interface ClientBoardPanelProps {
  clientId: number;
  token: string;
  canManage: boolean;
}

export function ClientBoardPanel({
  clientId,
  token,
  canManage,
}: ClientBoardPanelProps) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [newTitles, setNewTitles] = useState<Record<number, string>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [movePickerCardId, setMovePickerCardId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<Board>(`/boards/client/${clientId}`, token);
      setBoard(data);
    } catch (err) {
      setBoard(null);
      setError(getUserFacingErrorMessage(err, "No se pudo cargar el tablero"));
    } finally {
      setLoading(false);
    }
  }, [clientId, token]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const lists = useMemo(
    () =>
      (board?.lists ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((list) => ({
          ...list,
          cards: list.cards.slice().sort((a, b) => a.position - b.position),
        })),
    [board],
  );

  async function createCard(list: BoardList) {
    const title = (newTitles[list.id] ?? "").trim();
    if (!title) {
      setError("Escribí un título para la tarjeta");
      return;
    }
    setActing(true);
    setError(null);
    try {
      await api.post(`/boards/lists/${list.id}/cards`, { title }, token);
      setNewTitles((prev) => ({ ...prev, [list.id]: "" }));
      await load();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo crear la tarjeta"));
    } finally {
      setActing(false);
    }
  }

  async function moveCard(cardId: number, listId: number) {
    setActing(true);
    setError(null);
    try {
      await api.patch(`/boards/cards/${cardId}/move`, { list_id: listId, position: 0 }, token);
      setMovePickerCardId(null);
      await load();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo mover la tarjeta"));
    } finally {
      setActing(false);
    }
  }

  async function addComment(card: BoardCard) {
    const body = (commentDrafts[card.id] ?? "").trim();
    if (!body) {
      setError("Escribí un comentario");
      return;
    }
    setActing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("body", body);
      formData.append("is_internal", "true");
      await api.upload<CardComment>(
        `/boards/cards/${card.id}/comments`,
        formData,
        token,
      );
      setCommentDrafts((prev) => ({ ...prev, [card.id]: "" }));
      await load();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo agregar el comentario"));
    } finally {
      setActing(false);
    }
  }

  function findCard(cardId: number): BoardCard | undefined {
    for (const list of lists) {
      const found = list.cards.find((c) => c.id === cardId);
      if (found) return found;
    }
    return undefined;
  }

  if (loading) {
    return (
      <Card title="Tablero">
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.muted}>Cargando tablero…</Text>
      </Card>
    );
  }

  if (!board) {
    return (
      <Card title="Tablero">
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.muted}>
          El tablero aún no está disponible para este cliente.
        </Text>
        <Button title="Reintentar" variant="secondary" fullWidth onPress={() => void load()} />
      </Card>
    );
  }

  const expanded = expandedCardId != null ? findCard(expandedCardId) : undefined;

  return (
    <View style={styles.wrap}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {lists.map((list) => (
        <Card key={list.id} title={`${list.title} (${list.cards.length})`}>
          {list.cards.length === 0 ? (
            <Text style={styles.muted}>Sin tarjetas</Text>
          ) : (
            list.cards.map((card) => (
              <View key={card.id} style={styles.cardItem}>
                <Pressable
                  onPress={() =>
                    setExpandedCardId((prev) => (prev === card.id ? null : card.id))
                  }
                >
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.muted}>
                    {TASK_STATUS_LABELS[card.status] ?? card.status}
                  </Text>
                </Pressable>

                {canManage ? (
                  <View style={styles.cardActions}>
                    <Button
                      title={
                        movePickerCardId === card.id ? "Cancelar mover" : "Mover a…"
                      }
                      variant="ghost"
                      onPress={() =>
                        setMovePickerCardId((prev) =>
                          prev === card.id ? null : card.id,
                        )
                      }
                    />
                  </View>
                ) : null}

                {movePickerCardId === card.id ? (
                  <View style={styles.moveList}>
                    {lists
                      .filter((l) => l.id !== list.id)
                      .map((target) => (
                        <Pressable
                          key={target.id}
                          style={styles.moveOption}
                          disabled={acting}
                          onPress={() => void moveCard(card.id, target.id)}
                        >
                          <Text style={styles.moveOptionText}>{target.title}</Text>
                        </Pressable>
                      ))}
                  </View>
                ) : null}
              </View>
            ))
          )}

          {canManage ? (
            <View style={styles.createRow}>
              <TextInput
                value={newTitles[list.id] ?? ""}
                onChangeText={(text) =>
                  setNewTitles((prev) => ({ ...prev, [list.id]: text }))
                }
                placeholder="Nueva tarjeta…"
                placeholderTextColor={colors.brownMuted}
                style={styles.createInput}
              />
              <Button
                title="Crear"
                loading={acting}
                onPress={() => void createCard(list)}
              />
            </View>
          ) : null}
        </Card>
      ))}

      {expanded ? (
        <Card title={expanded.title}>
          {expanded.description_md ? (
            <Text style={styles.body}>{expanded.description_md}</Text>
          ) : (
            <Text style={styles.muted}>Sin descripción</Text>
          )}

          <Text style={styles.sectionLabel}>Comentarios</Text>
          {expanded.comments.length === 0 ? (
            <Text style={styles.muted}>Sin comentarios</Text>
          ) : (
            expanded.comments.map((c) => (
              <View key={c.id} style={styles.comment}>
                <Text style={styles.commentMeta}>
                  {c.author_name}
                  {c.is_internal ? " · interno" : ""} · {formatDateTime(c.created_at)}
                </Text>
                <Text style={styles.body}>{c.body}</Text>
              </View>
            ))
          )}

          {canManage ? (
            <View style={styles.commentForm}>
              <Input
                label="Nuevo comentario interno"
                value={commentDrafts[expanded.id] ?? ""}
                onChangeText={(text) =>
                  setCommentDrafts((prev) => ({ ...prev, [expanded.id]: text }))
                }
                placeholder="Escribí un comentario…"
                multiline
              />
              <Button
                title="Agregar comentario"
                fullWidth
                loading={acting}
                onPress={() => void addComment(expanded)}
              />
            </View>
          ) : null}

          <Button
            title="Cerrar detalle"
            variant="ghost"
            fullWidth
            onPress={() => setExpandedCardId(null)}
          />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  cardItem: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    padding: 10,
    gap: 6,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  moveList: {
    gap: 6,
  },
  moveOption: {
    backgroundColor: colors.creamSoft,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    padding: 10,
  },
  moveOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brown,
  },
  createRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 4,
  },
  createInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.ink,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brown,
    marginTop: 4,
  },
  body: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  comment: {
    gap: 2,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  commentMeta: {
    fontSize: 12,
    color: colors.soft,
  },
  commentForm: {
    gap: 8,
    marginTop: 8,
  },
});
