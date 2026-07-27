import { useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  GestureHandlerRootView,
  TouchableOpacity,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNotifications } from "@/features/notifications/NotificationsContext";
import { SwipeToDeleteRow } from "@/features/notifications/SwipeToDeleteRow";
import { getUserFacingErrorMessage } from "@/lib/api";
import type { Notification } from "@/types/api";
import { colors, radii } from "@/theme/tokens";

function ModalNotificationRow({
  item,
  deleting,
  onPress,
  onDelete,
}: {
  item: Notification;
  deleting: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <SwipeToDeleteRow disabled={deleting} onDelete={onDelete}>
      <TouchableOpacity
        activeOpacity={0.75}
        disabled={deleting}
        onPress={onPress}
        style={[styles.item, !item.read_at && styles.itemUnread]}
      >
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.itemBody} numberOfLines={2}>
          {item.body}
        </Text>
      </TouchableOpacity>
    </SwipeToDeleteRow>
  );
}

export function NotificationBell() {
  const { unreadCount, recent, markRead, markAllRead, remove } = useNotifications();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Notification | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const panelTop = Math.max(insets.top + 56, 72);
  const panelMaxHeight = Math.min(420, windowHeight - panelTop - insets.bottom - 24);
  const listMaxHeight = Math.max(120, panelMaxHeight - 108);

  function closeAll() {
    setSelected(null);
    setOpen(false);
  }

  function closeDetail() {
    setSelected(null);
  }

  function onItemPress(item: Notification) {
    // Abrir al instante; marcar leída en background
    setSelected({
      ...item,
      read_at: item.read_at ?? new Date().toISOString(),
    });
    if (!item.read_at) {
      void markRead([item.id]);
    }
  }

  function onDelete(id: number) {
    if (deletingId != null) return;
    setDeletingId(id);
    if (selected?.id === id) closeDetail();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    void remove([id])
      .catch((err) => {
        Alert.alert(
          "No se pudo eliminar",
          getUserFacingErrorMessage(err, "Intentá de nuevo en unos momentos."),
        );
      })
      .finally(() => {
        setDeletingId(null);
      });
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notificaciones"
        onPress={() => setOpen(true)}
        style={styles.bellBtn}
        hitSlop={8}
      >
        <Ionicons name="notifications-outline" size={24} color={colors.cream} />
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* Un solo Modal: en iOS el segundo Modal apilado no abre / en Android tarda */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={selected ? closeDetail : closeAll}
      >
        <GestureHandlerRootView style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={selected ? closeDetail : closeAll} />

          <View style={[styles.panel, { top: panelTop, maxHeight: panelMaxHeight }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notificaciones</Text>
              {unreadCount > 0 ? (
                <Pressable onPress={() => void markAllRead()}>
                  <Text style={styles.markAll}>Marcar leídas</Text>
                </Pressable>
              ) : null}
            </View>

            {recent.length === 0 ? (
              <Text style={styles.empty}>No hay notificaciones</Text>
            ) : (
              <ScrollView
                style={{ maxHeight: listMaxHeight }}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator
                bounces
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
              >
                {recent.map((item) => (
                  <ModalNotificationRow
                    key={item.id}
                    item={item}
                    deleting={deletingId === item.id}
                    onPress={() => onItemPress(item)}
                    onDelete={() => onDelete(item.id)}
                  />
                ))}
              </ScrollView>
            )}
          </View>

          {selected ? (
            <View style={styles.detailRoot} pointerEvents="box-none">
              <Pressable style={styles.detailBackdrop} onPress={closeDetail} />
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>{selected.title}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar"
                    onPress={closeDetail}
                    hitSlop={8}
                    style={styles.detailCloseBtn}
                  >
                    <Ionicons name="close" size={22} color={colors.brown} />
                  </Pressable>
                </View>
                <Text style={styles.detailMeta}>
                  {new Date(selected.created_at).toLocaleString("es")}
                </Text>
                <ScrollView
                  style={styles.detailScroll}
                  contentContainerStyle={styles.detailScrollContent}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.detailBody}>{selected.body}</Text>
                </ScrollView>
                <View style={styles.detailActions}>
                  <Pressable
                    style={styles.detailDelete}
                    onPress={() => onDelete(selected.id)}
                    disabled={deletingId === selected.id}
                  >
                    <Text style={styles.detailDeleteText}>Eliminar</Text>
                  </Pressable>
                  <Pressable style={styles.detailDone} onPress={closeDetail}>
                    <Text style={styles.detailDoneText}>Cerrar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "800",
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panel: {
    position: "absolute",
    right: 12,
    left: 12,
    backgroundColor: colors.cream,
    borderRadius: radii.card,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    flexShrink: 0,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.brown,
  },
  markAll: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
  listContent: {
    paddingBottom: 4,
  },
  empty: {
    fontSize: 13,
    color: colors.soft,
    paddingVertical: 16,
    textAlign: "center",
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radii.control,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  itemUnread: {
    borderColor: colors.brandMuted,
    backgroundColor: colors.brandLight,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brown,
  },
  itemBody: {
    fontSize: 12,
    color: colors.soft,
    lineHeight: 16,
  },
  detailRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 20,
  },
  detailBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  detailCard: {
    backgroundColor: colors.cream,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 10,
    maxHeight: "70%",
    zIndex: 1,
    elevation: 8,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  detailTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: colors.brown,
    lineHeight: 24,
  },
  detailCloseBtn: {
    padding: 2,
  },
  detailMeta: {
    fontSize: 12,
    color: colors.soft,
  },
  detailScroll: {
    flexGrow: 0,
  },
  detailScrollContent: {
    paddingBottom: 4,
  },
  detailBody: {
    fontSize: 15,
    color: colors.ink,
    lineHeight: 22,
  },
  detailActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    paddingTop: 4,
  },
  detailDelete: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  detailDeleteText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.danger,
  },
  detailDone: {
    backgroundColor: colors.brand,
    borderRadius: radii.control,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  detailDoneText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
});
