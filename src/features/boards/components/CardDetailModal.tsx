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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/contexts/LanguageContext";
import { CommentBody } from "@/features/boards/components/CommentBody";
import { MarkdownBody } from "@/features/boards/components/MarkdownBody";
import {
  BOARD_CARD_LABELS,
  BOARD_CARD_LABEL_TEXT,
  cardLabelSurface,
  resolveCardLabel,
} from "@/features/boards/constants/cardLabels";
import { UploadSourceSheet } from "@/features/documents/UploadSourceSheet";
import {
  pickUploadFile,
  waitForModalDismiss,
  type UploadFileAsset,
  type UploadSource,
} from "@/features/documents/pickUploadSource";
import { formatDateTime } from "@/features/clients/format";
import {
  encodeMentionsInBody,
  filterMentionableUsers,
  getActiveMentionQuery,
  insertMentionPlain,
  type MentionableUser,
} from "@/features/boards/utils/commentMentions";
import { api } from "@/lib/api";
import type {
  BoardCard,
  BoardCardLabel,
  BoardList,
  CardAttachment,
  CardComment,
} from "@/types/api";
import { colors, radii } from "@/theme/tokens";

type AttachTarget = "card" | "comment";

interface CardDetailModalProps {
  visible: boolean;
  card: BoardCard | null;
  lists: BoardList[];
  currentListId: number | null;
  clientId: number;
  canManage: boolean;
  canSetLabel: boolean;
  canComment: boolean;
  /** Permite adjuntar archivos (cámara / galería / archivos). */
  canAttach?: boolean;
  /** Si true, oculta comentarios internos (portal cliente). */
  hideInternalComments?: boolean;
  acting?: boolean;
  uploadingAttachment?: boolean;
  attachMessage?: string | null;
  attachError?: boolean;
  token: string;
  onClose: () => void;
  onMove?: (cardId: number, listId: number) => Promise<void>;
  onUpdateLabel?: (cardId: number, label: BoardCardLabel) => Promise<void>;
  onAddComment?: (
    cardId: number,
    body: string,
    isInternal: boolean,
    files?: UploadFileAsset[],
  ) => Promise<void>;
  onUploadAttachment?: (cardId: number, file: UploadFileAsset) => Promise<void>;
}

function statusColor(status: string | null | undefined): string {
  switch (status) {
    case "APROBADO":
      return colors.brand;
    case "RECHAZADO":
      return colors.danger;
    case "EN_PROCESO":
    case "PENDIENTE":
      return colors.gold;
    default:
      return colors.soft;
  }
}

export function CardDetailModal({
  visible,
  card,
  lists,
  currentListId,
  clientId,
  canManage,
  canSetLabel,
  canComment,
  canAttach = false,
  hideInternalComments = false,
  acting = false,
  uploadingAttachment = false,
  attachMessage = null,
  attachError = false,
  token,
  onClose,
  onMove,
  onUpdateLabel,
  onAddComment,
  onUploadAttachment,
}: CardDetailModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [moveOpen, setMoveOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [asInternal, setAsInternal] = useState(canManage);
  const [attachPickerOpen, setAttachPickerOpen] = useState(false);
  const [attachTarget, setAttachTarget] = useState<AttachTarget>("card");
  const [pickingFile, setPickingFile] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<UploadFileAsset[]>([]);
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");

  useEffect(() => {
    if (!visible) {
      setMoveOpen(false);
      setLabelOpen(false);
      setComment("");
      setAsInternal(canManage);
      setAttachPickerOpen(false);
      setPickingFile(false);
      setStagedFiles([]);
      setAttachTarget("card");
      setMentionStart(null);
      setMentionQuery("");
    }
  }, [visible, canManage]);

  useEffect(() => {
    if (!visible || !token || !clientId) return;
    const includeClient = !(asInternal && canManage && !hideInternalComments);
    let cancelled = false;
    void (async () => {
      try {
        const users = await api.get<MentionableUser[]>(
          `/boards/client/${clientId}/mentionable-users?include_client=${includeClient ? "true" : "false"}`,
          token,
        );
        if (!cancelled) setMentionableUsers(users);
      } catch {
        if (!cancelled) setMentionableUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, token, clientId, asInternal, canManage, hideInternalComments]);

  const surface = cardLabelSurface(card?.label);
  const label = resolveCardLabel(card?.label);

  const comments = useMemo(() => {
    if (!card) return [];
    return hideInternalComments
      ? card.comments.filter((c) => !c.is_internal)
      : card.comments;
  }, [card, hideInternalComments]);

  const cardAttachments = useMemo(() => {
    if (!card) return [];
    return [...card.attachments]
      .filter((a) => !a.comment_id)
      .sort((a, b) => {
        const aTime = a.created_at ? Date.parse(a.created_at) : 0;
        const bTime = b.created_at ? Date.parse(b.created_at) : 0;
        return bTime - aTime;
      });
  }, [card]);

  const attachmentsByComment = useMemo(() => {
    const map = new Map<number, CardAttachment[]>();
    if (!card) return map;
    for (const attachment of card.attachments) {
      if (!attachment.comment_id) continue;
      const list = map.get(attachment.comment_id) ?? [];
      list.push(attachment);
      map.set(attachment.comment_id, list);
    }
    return map;
  }, [card]);

  const currentListTitle =
    lists.find((l) => l.id === currentListId)?.title ?? "Sin lista";

  const busy = acting || uploadingAttachment || pickingFile;
  const showComposer = Boolean(canComment && onAddComment);
  const canSend = Boolean(comment.trim() || stagedFiles.length > 0);
  const mentionSuggestions =
    mentionStart === null
      ? []
      : filterMentionableUsers(mentionableUsers, mentionQuery);

  function syncMentionState(nextValue: string, cursor: number) {
    const active = getActiveMentionQuery(nextValue, cursor);
    if (!active) {
      setMentionStart(null);
      setMentionQuery("");
      return;
    }
    setMentionStart(active.start);
    setMentionQuery(active.query);
  }

  function applyMention(user: MentionableUser) {
    if (mentionStart === null) return;
    // Fin del query activo (@ + texto), no el final del comentario
    const cursor = mentionStart + 1 + mentionQuery.length;
    const nextValue = insertMentionPlain(comment, mentionStart, cursor, user.full_name);
    setComment(nextValue);
    setMentionStart(null);
    setMentionQuery("");
  }

  async function handleComment() {
    if (!card || !onAddComment || !canSend || busy) return;
    const body = encodeMentionsInBody(comment.trim(), mentionableUsers);
    const files = stagedFiles;
    await onAddComment(
      card.id,
      body,
      hideInternalComments ? false : asInternal,
      files.length > 0 ? files : undefined,
    );
    setComment("");
    setStagedFiles([]);
    setMentionStart(null);
    setMentionQuery("");
  }

  function openAttachPicker(target: AttachTarget) {
    setAttachTarget(target);
    setAttachPickerOpen(true);
  }

  async function handlePickSource(source: UploadSource) {
    if (!card) return;
    setAttachPickerOpen(false);
    setPickingFile(true);
    try {
      await waitForModalDismiss(Platform.OS === "android" ? 500 : 350);
      const file = await pickUploadFile(`card-${card.id}`, source);
      if (!file) return;

      if (attachTarget === "comment") {
        setStagedFiles((prev) => [...prev, file]);
        return;
      }

      if (!onUploadAttachment) return;
      await onUploadAttachment(card.id, file);
    } finally {
      setPickingFile(false);
    }
  }

  function renderAttachmentRow(att: CardAttachment) {
    const status = att.verification_status ?? null;
    return (
      <View key={att.id} style={styles.attachment}>
        <Ionicons
          name={
            att.mime_type?.startsWith("image/") ? "image-outline" : "document-outline"
          }
          size={16}
          color={colors.brand}
        />
        <View style={styles.attachmentBody}>
          <Text style={styles.attachmentName} numberOfLines={1}>
            {att.original_filename}
          </Text>
          {status ? (
            <Text style={[styles.attachmentStatus, { color: statusColor(status) }]}>
              {t(
                `verificationStatus.${status}` as
                  | "verificationStatus.PENDIENTE"
                  | "verificationStatus.EN_PROCESO"
                  | "verificationStatus.APROBADO"
                  | "verificationStatus.RECHAZADO"
                  | "verificationStatus.PROXIMO_A_VENCER",
              )}
            </Text>
          ) : null}
        </View>
      </View>
    );
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
          keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
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
            keyboardDismissMode="interactive"
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
                    <Text style={styles.flagText}>
                      {cardAttachments.length > 0 || card.attachments.length > 0
                        ? t("portalBoard.fileLoaded")
                        : t("portalBoard.requiresFile")}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.block}>
              <Text style={styles.blockLabel}>
                {t("portalBoard.attachments")} ({cardAttachments.length})
              </Text>
              {cardAttachments.length === 0 ? (
                <Text style={styles.muted}>{t("portalBoard.noAttachments")}</Text>
              ) : (
                cardAttachments.map(renderAttachmentRow)
              )}

              {canAttach && onUploadAttachment ? (
                <Button
                  title={
                    uploadingAttachment && attachTarget === "card"
                      ? t("portalBoard.uploading")
                      : t("portalBoard.attachFiles")
                  }
                  variant="secondary"
                  fullWidth
                  loading={uploadingAttachment}
                  disabled={busy}
                  onPress={() => openAttachPicker("card")}
                />
              ) : null}

              {attachMessage ? (
                <Text style={attachError ? styles.error : styles.success}>
                  {attachMessage}
                </Text>
              ) : null}
            </View>

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
                          disabled={busy}
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
                          disabled={busy}
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
                    {c.body.trim() ? <CommentBody body={c.body} /> : null}
                    {(attachmentsByComment.get(c.id) ?? []).map(renderAttachmentRow)}
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          {showComposer ? (
            <View
              style={[
                styles.composer,
                { paddingBottom: Math.max(insets.bottom, 10) + 10 },
              ]}
            >
              {stagedFiles.length > 0 ? (
                <View style={styles.stagedList}>
                  {stagedFiles.map((file, index) => (
                    <View key={`${file.uri}-${index}`} style={styles.stagedChip}>
                      <Ionicons name="document-attach-outline" size={14} color={colors.brand} />
                      <Text style={styles.stagedName} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <Pressable
                        accessibilityLabel={t("portalBoard.removeStagedFile")}
                        hitSlop={8}
                        disabled={busy}
                        onPress={() =>
                          setStagedFiles((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        <Ionicons name="close-circle" size={18} color={colors.soft} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              {canManage && !hideInternalComments ? (
                <Pressable
                  style={styles.toggleRow}
                  onPress={() => setAsInternal((v) => !v)}
                >
                  <Ionicons
                    name={asInternal ? "checkbox" : "square-outline"}
                    size={18}
                    color={colors.brand}
                  />
                  <Text style={styles.toggleText}>Solo visible para el equipo</Text>
                </Pressable>
              ) : null}

              {mentionSuggestions.length > 0 ? (
                <View style={styles.mentionMenu}>
                  {mentionSuggestions.slice(0, 6).map((user) => (
                    <Pressable
                      key={user.id}
                      style={styles.mentionItem}
                      onPress={() => applyMention(user)}
                    >
                      <Text style={styles.mentionName}>{user.full_name}</Text>
                      <Text style={styles.mentionRole}>{user.role_code}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={styles.composerRow}>
                {canAttach ? (
                  <Pressable
                    accessibilityLabel={t("portalBoard.attachToComment")}
                    disabled={busy}
                    onPress={() => openAttachPicker("comment")}
                    style={styles.attachBtn}
                  >
                    <Ionicons name="attach" size={22} color={colors.brand} />
                  </Pressable>
                ) : (
                  <View style={styles.attachBtnSpacer} />
                )}

                <TextInput
                  value={comment}
                  onChangeText={(text) => {
                    setComment(text);
                    syncMentionState(text, text.length);
                  }}
                  onSelectionChange={(e) => {
                    syncMentionState(comment, e.nativeEvent.selection.start);
                  }}
                  placeholder={t("portalBoard.commentPlaceholder")}
                  placeholderTextColor={colors.brownMuted}
                  multiline
                  editable={!busy}
                  textAlignVertical="top"
                  style={styles.composerInput}
                />

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t("portalBoard.sendComment")}
                  activeOpacity={0.85}
                  disabled={!canSend || busy}
                  onPress={() => void handleComment()}
                  style={[styles.sendBtn, (!canSend || busy) && styles.sendBtnDisabled]}
                >
                  {acting ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Ionicons name="send" size={18} color={colors.white} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {busy ? (
            <View style={styles.actingOverlay} pointerEvents="none">
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : null}

          <UploadSourceSheet
            visible={attachPickerOpen}
            title={
              attachTarget === "comment"
                ? t("portalBoard.attachToComment")
                : t("portalBoard.uploadHow")
            }
            onClose={() => setAttachPickerOpen(false)}
            onSelect={(source) => {
              void handlePickSource(source);
            }}
          />
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
    paddingBottom: 28,
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  attachmentBody: {
    flex: 1,
    gap: 2,
  },
  attachmentName: {
    fontSize: 14,
    color: colors.ink,
  },
  attachmentStatus: {
    fontSize: 12,
    fontWeight: "600",
  },
  success: {
    fontSize: 13,
    color: colors.brand,
    fontWeight: "600",
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: "600",
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
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingTop: 10,
    gap: 8,
  },
  stagedList: {
    gap: 6,
  },
  stagedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
    backgroundColor: colors.creamSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 8,
  },
  stagedName: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    color: colors.brown,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  toggleText: {
    fontSize: 13,
    color: colors.brown,
  },
  mentionMenu: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    backgroundColor: colors.cream,
    overflow: "hidden",
  },
  mentionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 2,
  },
  mentionName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brown,
  },
  mentionRole: {
    fontSize: 11,
    color: colors.soft,
    textTransform: "uppercase",
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  attachBtn: {
    padding: 8,
    marginBottom: 2,
  },
  attachBtnSpacer: {
    width: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.cream,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  actingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250,248,245,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
