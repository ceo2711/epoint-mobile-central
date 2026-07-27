import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useTranslation } from "@/contexts/LanguageContext";
import { CardDetailModal } from "@/features/boards/components/CardDetailModal";
import { KanbanBoard } from "@/features/boards/components/KanbanBoard";
import type { UploadFileAsset } from "@/features/documents/pickUploadSource";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type {
  Board,
  BoardCard,
  BoardCardLabel,
  CardAttachment,
  CardComment,
} from "@/types/api";
import { colors } from "@/theme/tokens";

interface ClientBoardPanelProps {
  clientId: number;
  token: string;
  canManage: boolean;
  /** Portal del cliente: comentarios públicos, sin mover/etiqueta. */
  isClientPortal?: boolean;
  /** Envolver en ScrollView con pull-to-refresh (pantalla portal). */
  scrollable?: boolean;
  title?: string;
  subtitle?: string;
}

function hasVerifyingAttachments(card: BoardCard | null): boolean {
  if (!card) return false;
  return card.attachments.some(
    (att) =>
      att.verification_status === "PENDIENTE" ||
      att.verification_status === "EN_PROCESO",
  );
}

export function ClientBoardPanel({
  clientId,
  token,
  canManage,
  isClientPortal = false,
  scrollable = false,
  title,
  subtitle,
}: ClientBoardPanelProps) {
  const { t } = useTranslation();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachMessage, setAttachMessage] = useState<string | null>(null);
  const [attachError, setAttachError] = useState(false);

  const canCreateCards = canManage || isClientPortal;
  const canSetLabel = canManage;
  const canComment = canManage || isClientPortal;
  const canAttach = canManage || isClientPortal;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setError(null);
      try {
        const data = await api.get<Board>(`/boards/client/${clientId}`, token);
        setBoard(data);
      } catch (err) {
        setBoard(null);
        setError(getUserFacingErrorMessage(err, "No se pudo cargar el tablero"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [clientId, token],
  );

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

  const selectedCard = useMemo(() => {
    if (selectedCardId == null) return null;
    for (const list of lists) {
      const found = list.cards.find((c) => c.id === selectedCardId);
      if (found) return found;
    }
    return null;
  }, [lists, selectedCardId]);

  useEffect(() => {
    if (!hasVerifyingAttachments(selectedCard)) return;
    const interval = setInterval(() => {
      void load({ silent: true });
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedCard, load]);

  function openCard(card: BoardCard, listId: number) {
    setAttachMessage(null);
    setAttachError(false);
    setSelectedCardId(card.id);
    setSelectedListId(listId);
  }

  function closeCard() {
    setAttachMessage(null);
    setAttachError(false);
    setSelectedCardId(null);
    setSelectedListId(null);
  }

  async function createCard(listId: number, titleText: string): Promise<boolean> {
    setActing(true);
    setError(null);
    try {
      await api.post(`/boards/lists/${listId}/cards`, { title: titleText }, token);
      await load({ silent: true });
      return true;
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo crear la tarjeta"));
      return false;
    } finally {
      setActing(false);
    }
  }

  async function moveCard(cardId: number, listId: number) {
    setActing(true);
    setError(null);
    try {
      await api.patch(
        `/boards/cards/${cardId}/move`,
        { list_id: listId, position: 0 },
        token,
      );
      setSelectedListId(listId);
      await load({ silent: true });
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo mover la tarjeta"));
    } finally {
      setActing(false);
    }
  }

  async function updateLabel(cardId: number, label: BoardCardLabel) {
    setActing(true);
    setError(null);
    try {
      await api.patch(`/boards/cards/${cardId}/label`, { label }, token);
      await load({ silent: true });
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo actualizar la etiqueta"));
    } finally {
      setActing(false);
    }
  }

  async function addComment(
    cardId: number,
    body: string,
    isInternal: boolean,
    files?: UploadFileAsset[],
  ) {
    setActing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("body", body);
      formData.append("is_internal", isInternal ? "true" : "false");
      for (const file of files ?? []) {
        formData.append("files", {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        } as unknown as Blob);
      }
      await api.upload<CardComment>(
        `/boards/cards/${cardId}/comments`,
        formData,
        token,
      );
      await load({ silent: true });
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo agregar el comentario"));
      throw err;
    } finally {
      setActing(false);
    }
  }

  async function uploadAttachment(cardId: number, file: UploadFileAsset) {
    setAttachMessage(null);
    setAttachError(false);
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      } as unknown as Blob);
      await api.upload<CardAttachment>(
        `/boards/cards/${cardId}/attachments`,
        formData,
        token,
      );
      setAttachMessage(t("portalBoard.uploadSuccess"));
      setAttachError(false);
      await load({ silent: true });
    } catch (err) {
      setAttachMessage(
        getUserFacingErrorMessage(err, t("portalBoard.uploadError")),
      );
      setAttachError(true);
      throw err;
    } finally {
      setUploadingAttachment(false);
    }
  }

  const detail = (
    <CardDetailModal
      visible={selectedCardId != null}
      card={selectedCard}
      lists={lists}
      currentListId={selectedListId}
      clientId={clientId}
      token={token}
      canManage={canManage}
      canSetLabel={canSetLabel}
      canComment={canComment}
      canAttach={canAttach}
      hideInternalComments={isClientPortal}
      acting={acting}
      uploadingAttachment={uploadingAttachment}
      attachMessage={attachMessage}
      attachError={attachError}
      onClose={closeCard}
      onMove={canManage ? moveCard : undefined}
      onUpdateLabel={canSetLabel ? updateLabel : undefined}
      onAddComment={canComment ? addComment : undefined}
      onUploadAttachment={canAttach ? uploadAttachment : undefined}
    />
  );

  if (loading) {
    if (scrollable) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.muted}>{t("portalBoard.loading")}</Text>
        </View>
      );
    }
    return (
      <Card title={title ?? t("portalBoard.title")}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.muted}>{t("portalBoard.loading")}</Text>
      </Card>
    );
  }

  if (!board) {
    const empty = (
      <View style={styles.emptyBlock}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.muted}>
          {isClientPortal
            ? t("portalBoard.unavailableBody")
            : "El tablero aún no está disponible para este cliente."}
        </Text>
        <Button title="Reintentar" variant="secondary" fullWidth onPress={() => void load()} />
      </View>
    );
    if (scrollable) return <View style={styles.portalPad}>{empty}{detail}</View>;
    return (
      <Card title={title ?? t("portalBoard.title")}>
        {empty}
        {detail}
      </Card>
    );
  }

  const boardUi = (
    <View style={styles.boardWrap}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isClientPortal ? (
        <Text style={styles.hint}>
          Deslizá horizontalmente entre columnas. Tocá una tarjeta para ver detalle,
          adjuntar archivos, moverla o comentar.
        </Text>
      ) : (
        <Text style={styles.hint}>
          Deslizá entre columnas para seguir tu onboarding. Tocá una tarjeta para ver
          el detalle y adjuntar archivos.
        </Text>
      )}
      <KanbanBoard
        board={board}
        canCreateCards={canCreateCards}
        creating={acting}
        onSelectCard={openCard}
        onCreateCard={canCreateCards ? createCard : undefined}
      />
    </View>
  );

  if (scrollable) {
    return (
      <>
        <ScrollView
          style={styles.portalScroll}
          contentContainerStyle={styles.portalContent}
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
          {title ? <Text style={styles.portalTitle}>{title}</Text> : null}
          {subtitle ? <Text style={styles.portalSubtitle}>{subtitle}</Text> : null}
          {boardUi}
        </ScrollView>
        {detail}
      </>
    );
  }

  return (
    <View style={styles.staffWrap}>
      {boardUi}
      {detail}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.cream,
  },
  staffWrap: {
    gap: 8,
  },
  boardWrap: {
    gap: 10,
  },
  portalScroll: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  portalContent: {
    paddingTop: 20,
    paddingBottom: 32,
    gap: 12,
  },
  portalPad: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.cream,
    gap: 12,
  },
  portalTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.brown,
    paddingHorizontal: 20,
  },
  portalSubtitle: {
    fontSize: 14,
    color: colors.soft,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  hint: {
    fontSize: 13,
    color: colors.soft,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  emptyBlock: {
    gap: 12,
  },
  muted: {
    fontSize: 13,
    color: colors.soft,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
    paddingHorizontal: 16,
  },
});
