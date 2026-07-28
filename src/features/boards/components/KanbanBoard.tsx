import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";

import { useSuppressBackGesture } from "@/components/shell/BackGestureContext";
import {
  BOARD_CARD_LABEL_TEXT,
  cardLabelSurface,
  resolveCardLabel,
} from "@/features/boards/constants/cardLabels";
import type { Board, BoardCard, BoardList } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

const COLUMN_WIDTH = Math.min(280, Dimensions.get("window").width * 0.78);
const BOARD_HEIGHT = Math.max(420, Dimensions.get("window").height * 0.58);

interface KanbanBoardProps {
  board: Board;
  canCreateCards?: boolean;
  creating?: boolean;
  onSelectCard: (card: BoardCard, listId: number) => void;
  onCreateCard?: (listId: number, title: string) => Promise<boolean | void>;
}

function sortedLists(board: Board): BoardList[] {
  return board.lists
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((list) => ({
      ...list,
      cards: list.cards.slice().sort((a, b) => a.position - b.position),
    }));
}

function KanbanCardTile({
  card,
  onPress,
}: {
  card: BoardCard;
  onPress: () => void;
}) {
  const surface = cardLabelSurface(card.label);
  const label = resolveCardLabel(card.label);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: surface.bg,
            borderColor: surface.border,
          },
        ]}
      >
        <View style={[styles.cardAccent, { backgroundColor: surface.accent }]} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={3}>
            {card.title}
          </Text>
          <View style={[styles.labelBadge, { backgroundColor: surface.badgeBg }]}>
            <Text style={[styles.labelBadgeText, { color: surface.badgeText }]}>
              {BOARD_CARD_LABEL_TEXT[label]}
            </Text>
          </View>
          <View style={styles.cardMetaRow}>
            {card.comments.length > 0 ? (
              <View style={styles.metaChip}>
                <Ionicons name="chatbubble-outline" size={12} color={colors.soft} />
                <Text style={styles.cardMeta}>{card.comments.length}</Text>
              </View>
            ) : null}
            {card.attachments.length > 0 ? (
              <View style={styles.metaChip}>
                <Ionicons name="attach-outline" size={12} color={colors.soft} />
                <Text style={styles.cardMeta}>{card.attachments.length}</Text>
              </View>
            ) : null}
            {card.requires_credentials ? (
              <View style={styles.metaChip}>
                <Ionicons
                  name={card.has_credentials ? "key-outline" : "lock-closed-outline"}
                  size={12}
                  color={colors.soft}
                />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function AddCardForm({
  listId,
  disabled,
  onCreate,
}: {
  listId: number;
  disabled?: boolean;
  onCreate: (listId: number, title: string) => Promise<boolean | void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const ok = await onCreate(listId, trimmed);
      if (ok === false) return;
      setTitle("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Pressable
        style={styles.addTrigger}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <Ionicons name="add" size={18} color={colors.brand} />
        <Text style={styles.addTriggerText}>Nueva tarjeta</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.addForm}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Título de la tarjeta"
        placeholderTextColor={colors.brownMuted}
        style={styles.addInput}
        autoFocus
        editable={!saving && !disabled}
        onSubmitEditing={() => void submit()}
      />
      <View style={styles.addActions}>
        <Pressable
          style={[styles.addBtn, styles.addBtnPrimary]}
          disabled={saving || !title.trim()}
          onPress={() => void submit()}
        >
          <Text style={styles.addBtnPrimaryText}>{saving ? "…" : "Crear"}</Text>
        </Pressable>
        <Pressable
          style={styles.addBtn}
          disabled={saving}
          onPress={() => {
            setOpen(false);
            setTitle("");
          }}
        >
          <Text style={styles.addBtnText}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function KanbanColumn({
  list,
  canCreateCards,
  creating,
  onSelectCard,
  onCreateCard,
}: {
  list: BoardList;
  canCreateCards: boolean;
  creating?: boolean;
  onSelectCard: (card: BoardCard, listId: number) => void;
  onCreateCard?: (listId: number, title: string) => Promise<boolean | void>;
}) {
  return (
    <View style={styles.column}>
      <View style={styles.columnHeader}>
        <Text style={styles.columnTitle} numberOfLines={2}>
          {list.title}
        </Text>
        <View style={styles.columnCount}>
          <Text style={styles.columnCountText}>{list.cards.length}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.columnBody}
        contentContainerStyle={styles.columnBodyContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {list.cards.length === 0 ? (
          <Text style={styles.emptyColumn}>Sin tarjetas</Text>
        ) : (
          list.cards.map((card) => (
            <KanbanCardTile
              key={card.id}
              card={card}
              onPress={() => onSelectCard(card, list.id)}
            />
          ))
        )}

        {canCreateCards && onCreateCard ? (
          <AddCardForm
            listId={list.id}
            disabled={creating}
            onCreate={onCreateCard}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

export function KanbanBoard({
  board,
  canCreateCards = false,
  creating,
  onSelectCard,
  onCreateCard,
}: KanbanBoardProps) {
  const lists = useMemo(() => sortedLists(board), [board]);
  const navigation = useNavigation();

  // El scroll horizontal del tablero no debe pelearse con el gesto de atrás.
  useSuppressBackGesture(true);

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: false,
      fullScreenGestureEnabled: false,
    });
    return () => {
      navigation.setOptions({
        gestureEnabled: true,
        fullScreenGestureEnabled: false,
      });
    };
  }, [navigation]);

  return (
    <View style={styles.board}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={COLUMN_WIDTH + 12}
        snapToAlignment="start"
        contentContainerStyle={styles.boardContent}
        nestedScrollEnabled
      >
        {lists.map((list) => (
          <KanbanColumn
            key={list.id}
            list={list}
            canCreateCards={canCreateCards}
            creating={creating}
            onSelectCard={onSelectCard}
            onCreateCard={onCreateCard}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    height: BOARD_HEIGHT,
  },
  boardContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  column: {
    width: COLUMN_WIDTH,
    backgroundColor: "#e8e2d9",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    maxHeight: BOARD_HEIGHT,
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.creamSoft,
  },
  columnTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: colors.brown,
    lineHeight: 18,
  },
  columnCount: {
    minWidth: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  columnCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
  columnBody: {
    flexGrow: 1,
  },
  columnBodyContent: {
    padding: 10,
    gap: 12,
    paddingBottom: 16,
  },
  emptyColumn: {
    fontSize: 12,
    color: colors.soft,
    paddingVertical: 8,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 2,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.white,
    // Rectángulo claramente separado del fondo de la columna
    shadowColor: "#1a1008",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  cardAccent: {
    width: 5,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 18,
  },
  labelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  labelBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  cardMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  cardMeta: {
    fontSize: 11,
    color: colors.soft,
    fontWeight: "600",
  },
  addTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  addTriggerText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brand,
  },
  addForm: {
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
  },
  addInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    paddingHorizontal: 10,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.cream,
  },
  addActions: {
    flexDirection: "row",
    gap: 8,
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.control,
  },
  addBtnPrimary: {
    backgroundColor: colors.brand,
  },
  addBtnPrimaryText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 13,
  },
  addBtnText: {
    color: colors.brown,
    fontWeight: "600",
    fontSize: 13,
  },
});
