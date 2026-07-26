import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MarkdownBody } from "@/features/boards/components/MarkdownBody";
import {
  BOARD_CARD_LABELS,
  BOARD_CARD_LABEL_TEXT,
  cardLabelSurface,
  resolveCardLabel,
} from "@/features/boards/constants/cardLabels";
import { formatDateTime } from "@/features/clients/format";
import type { BoardCard, BoardCardLabel, BoardList, CardComment } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

interface CardDetailModalProps {
  visible: boolean;
  card: BoardCard | null;
  lists: BoardList[];
  currentListId: number | null;
  canManage: boolean;
  canSetLabel: boolean;
  canComment: boolean;
  /** Si true, oculta comentarios internos (portal cliente). */
  hideInternalComments?: boolean;
  acting?: boolean;
  onClose: () => void;
  onMove?: (cardId: number, listId: number) => Promise<void>;
  onUpdateLabel?: (cardId: number, label: BoardCardLabel) => Promise<void>;
  onAddComment?: (cardId: number, body: string, isInternal: boolean) => Promise<void>;
}

export function CardDetailModal({
  visible,
  card,
  lists,
  currentListId,
  canManage,
  canSetLabel,
  canComment,
  hideInternalComments = false,
  acting = false,
  onClose,
  onMove,
  onUpdateLabel,
  onAddComment,
}: CardDetailModalProps) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [asInternal, setAsInternal] = useState(canManage);

  useEffect(() => {
    if (!visible) {
      setMoveOpen(false);
      setLabelOpen(false);
      setComment("");
      setAsInternal(canManage);
    }
  }, [visible, canManage]);

  const surface = cardLabelSurface(card?.label);
  const label = resolveCardLabel(card?.label);

  const comments = useMemo(() => {
    if (!card) return [];
    return hideInternalComments
      ? card.comments.filter((c) => !c.is_internal)
      : card.comments;
  }, [card, hideInternalComments]);

  const currentListTitle =
    lists.find((l) => l.id === currentListId)?.title ?? "Sin lista";

  async function handleComment() {
    if (!card || !onAddComment) return;
    const body = comment.trim();
    if (!body) return;
    await onAddComment(card.id, body, hideInternalComments ? false : asInternal);
    setComment("");
  }

  return (
    <Modal
      visible={visible && !!card}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {!card ? null : (
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.header, { borderBottomColor: surface.border }]}>
            <View style={[styles.accentBar, { backgroundColor: surface.accent }]} />
            <View style={styles.headerTop}>
              <View style={styles.headerMeta}>
                <View style={[styles.badge, { backgroundColor: surface.badgeBg }]}>
                  <Text style={[styles.badgeText, { color: surface.badgeText }]}>
                    {BOARD_CARD_LABEL_TEXT[label]}
                  </Text>
                </View>
                <Text style={styles.listHint}>{currentListTitle}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={26} color={colors.brown} />
              </Pressable>
            </View>
            <Text style={styles.title}>{card.title}</Text>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {card.instructions_md ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>Instrucciones</Text>
                <MarkdownBody content={card.instructions_md} />
              </View>
            ) : null}

            <View style={styles.block}>
              <Text style={styles.blockLabel}>Descripción</Text>
              {card.description_md ? (
                <MarkdownBody content={card.description_md} />
              ) : (
                <Text style={styles.muted}>Sin descripción</Text>
              )}
            </View>

            {card.requires_credentials || card.requires_file_upload ? (
              <View style={styles.flags}>
                {card.requires_credentials ? (
                  <View style={styles.flag}>
                    <Ionicons name="key-outline" size={14} color={colors.brown} />
                    <Text style={styles.flagText}>
                      {card.has_credentials ? "Credenciales cargadas" : "Requiere credenciales"}
                    </Text>
                  </View>
                ) : null}
                {card.requires_file_upload ? (
                  <View style={styles.flag}>
                    <Ionicons name="attach-outline" size={14} color={colors.brown} />
                    <Text style={styles.flagText}>Requiere archivo</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {card.attachments.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>
                  Adjuntos ({card.attachments.length})
                </Text>
                {card.attachments.map((att) => (
                  <View key={att.id} style={styles.attachment}>
                    <Ionicons name="document-outline" size={16} color={colors.brand} />
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {att.original_filename}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {canManage && onMove ? (
              <View style={styles.block}>
                <Pressable
                  style={styles.actionRow}
                  onPress={() => {
                    setLabelOpen(false);
                    setMoveOpen((v) => !v);
                  }}
                >
                  <Ionicons name="swap-horizontal-outline" size={18} color={colors.brand} />
                  <Text style={styles.actionText}>
                    {moveOpen ? "Cancelar mover" : "Mover a otra lista"}
                  </Text>
                </Pressable>
                {moveOpen ? (
                  <View style={styles.optionList}>
                    {lists
                      .filter((l) => l.id !== currentListId)
                      .map((target) => (
                        <Pressable
                          key={target.id}
                          style={styles.option}
                          disabled={acting}
                          onPress={() => void onMove(card.id, target.id)}
                        >
                          <Text style={styles.optionText}>{target.title}</Text>
                          <Text style={styles.optionCount}>{target.cards.length}</Text>
                        </Pressable>
                      ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {canSetLabel && onUpdateLabel ? (
              <View style={styles.block}>
                <Pressable
                  style={styles.actionRow}
                  onPress={() => {
                    setMoveOpen(false);
                    setLabelOpen((v) => !v);
                  }}
                >
                  <Ionicons name="pricetag-outline" size={18} color={colors.brand} />
                  <Text style={styles.actionText}>
                    {labelOpen ? "Cancelar etiqueta" : "Cambiar etiqueta"}
                  </Text>
                </Pressable>
                {labelOpen ? (
                  <View style={styles.labelGrid}>
                    {BOARD_CARD_LABELS.map((item) => {
                      const itemSurface = cardLabelSurface(item);
                      const selected = item === label;
                      return (
                        <Pressable
                          key={item}
                          style={[
                            styles.labelChip,
                            {
                              backgroundColor: itemSurface.badgeBg,
                              opacity: selected ? 1 : 0.75,
                              borderWidth: selected ? 2 : 0,
                              borderColor: colors.ink,
                            },
                          ]}
                          disabled={acting}
                          onPress={() => void onUpdateLabel(card.id, item)}
                        >
                          <Text style={styles.labelChipText}>
                            {BOARD_CARD_LABEL_TEXT[item]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.block}>
              <Text style={styles.blockLabel}>Comentarios ({comments.length})</Text>
              {comments.length === 0 ? (
                <Text style={styles.muted}>Sin comentarios</Text>
              ) : (
                comments.map((c: CardComment) => (
                  <View key={c.id} style={styles.comment}>
                    <Text style={styles.commentMeta}>
                      {c.author_name}
                      {c.is_internal ? " · interno" : ""} · {formatDateTime(c.created_at)}
                    </Text>
                    <MarkdownBody content={c.body} />
                  </View>
                ))
              )}
            </View>

            {canComment && onAddComment ? (
              <View style={styles.commentForm}>
                <Input
                  label={
                    hideInternalComments
                      ? "Nuevo comentario"
                      : asInternal
                        ? "Comentario interno"
                        : "Comentario visible al cliente"
                  }
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Escribí un comentario…"
                  multiline
                />
                {canManage && !hideInternalComments ? (
                  <Pressable
                    style={styles.toggleRow}
                    onPress={() => setAsInternal((v) => !v)}
                  >
                    <Ionicons
                      name={asInternal ? "checkbox" : "square-outline"}
                      size={20}
                      color={colors.brand}
                    />
                    <Text style={styles.toggleText}>Solo visible para el equipo</Text>
                  </Pressable>
                ) : null}
                <Button
                  title="Agregar comentario"
                  fullWidth
                  loading={acting}
                  disabled={!comment.trim()}
                  onPress={() => void handleComment()}
                />
              </View>
            ) : null}
          </ScrollView>

          {acting ? (
            <View style={styles.actingOverlay} pointerEvents="none">
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : null}
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    backgroundColor: colors.white,
    gap: 10,
  },
  accentBar: {
    height: 4,
    borderRadius: 2,
    alignSelf: "stretch",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerMeta: {
    flex: 1,
    gap: 6,
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
  listHint: {
    fontSize: 13,
    color: colors.soft,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.brown,
    lineHeight: 28,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    gap: 18,
    paddingBottom: 40,
  },
  block: {
    gap: 8,
  },
  blockLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brown,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  muted: {
    fontSize: 14,
    color: colors.soft,
  },
  flags: {
    gap: 8,
  },
  flag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.creamSoft,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  flagText: {
    fontSize: 13,
    color: colors.brown,
    fontWeight: "600",
  },
  attachment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  attachmentName: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.brand,
  },
  optionList: {
    gap: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.brown,
  },
  optionCount: {
    fontSize: 12,
    color: colors.soft,
    fontWeight: "700",
  },
  labelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  labelChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  labelChipText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  comment: {
    gap: 4,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  commentMeta: {
    fontSize: 12,
    color: colors.soft,
  },
  commentForm: {
    gap: 10,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleText: {
    fontSize: 14,
    color: colors.brown,
  },
  actingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250,248,245,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
