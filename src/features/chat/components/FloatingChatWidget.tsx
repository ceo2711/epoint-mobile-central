import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { MarkdownBody } from "@/features/boards/components/MarkdownBody";
import { ChatDocumentTypePanel } from "./ChatDocumentTypePanel";
import { useChatbot } from "@/features/chat/hooks/useChatbot";
import { CHAT_MESSAGE_MAX_LENGTH, type ChatConversationSummary, type ChatMessage } from "@/features/chat/types";
import { UploadSourceSheet } from "@/features/documents/UploadSourceSheet";
import {
  pickUploadFile,
  waitForModalDismiss,
  type UploadSource,
} from "@/features/documents/pickUploadSource";
import { SwipeToDeleteRow } from "@/features/notifications/SwipeToDeleteRow";
import { getUserFacingErrorMessage } from "@/lib/api";
import { colors, radii } from "@/theme/tokens";

const SCREEN = Dimensions.get("window");
const PANEL_WIDTH = Math.min(SCREEN.width - 24, 380);
const PANEL_HEIGHT = Math.min(SCREEN.height * 0.72, 560);
/** Android: un poco más bajo para que no roce el borde superior. */
const ANDROID_PANEL_HEIGHT = Math.min(SCREEN.height * 0.56, 440);

const CLIENT_SUGGESTIONS = [
  "chat.suggestionClientData",
  "chat.suggestionClientDocs",
  "chat.suggestionClientBoard",
] as const;

function formatConversationDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale.startsWith("en") ? "en-US" : "es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FloatingChatWidget() {
  const { user, token } = useAuth();
  const { locale, t } = useTranslation();
  const insets = useSafeAreaInsets();

  const {
    messages,
    loading,
    fileUploading,
    error,
    sendMessage,
    stageFile,
    finishDocumentUpload,
    cancelStagedUpload,
    conversations,
    conversationsLoading,
    conversationsError,
    conversationLoading,
    loadConversations,
    startNewConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    stagedUpload,
  } = useChatbot(token, locale, {
    userId: user?.id ?? null,
    clientId: user?.client_id ?? null,
  });

  // Textos de la interfaz: siempre el idioma de la app.
  const uiT = t;

  const [open, setOpen] = useState(false);
  const [panelMounted, setPanelMounted] = useState(false);
  const [view, setView] = useState<"list" | "chat">("list");
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const [renaming, setRenaming] = useState<ChatConversationSummary | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  /** Android: teclado abierto — usamos screenY para limitar la altura del panel. */
  const [androidKeyboard, setAndroidKeyboard] = useState<{
    open: boolean;
    /** Y en pantalla del borde superior del teclado */
    topY: number;
  }>({ open: false, topY: 0 });
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const nearBottomRef = useRef(true);
  const stickToBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const contentHeightRef = useRef(0);

  // 0 = burbuja cerrada sobre el botón, 1 = panel abierto.
  const anim = useRef(new Animated.Value(0)).current;

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
    // Segundo pase: el markdown a veces cambia la altura después del primer layout.
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated });
    }, 80);
    nearBottomRef.current = true;
    stickToBottomRef.current = true;
    setUnseenCount(0);
  }, []);

  useEffect(() => {
    if (open) {
      setPanelMounted(true);
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 170,
        mass: 0.85,
      }).start();
      return;
    }

    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPanelMounted(false);
    });
  }, [open, anim]);

  useEffect(() => {
    if (!open || !token) return;
    setView("list");
    setUnseenCount(0);
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open is the intentional trigger
  }, [open]);

  // Android (resize): la ventana ya resta el teclado. Solo quitamos el offset del FAB
  // para acercar el composer; NUNCA sumar keyboardHeight (eso manda el panel fuera de pantalla).
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setAndroidKeyboard({
        open: true,
        topY: event.endCoordinates.screenY,
      });
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setAndroidKeyboard({ open: false, topY: 0 });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!open) setAndroidKeyboard({ open: false, topY: 0 });
  }, [open]);

  useEffect(() => {
    if (!open || view !== "chat") return;

    const prevCount = prevMessageCountRef.current;
    const nextCount = messages.length;
    const added = Math.max(0, nextCount - prevCount);
    prevMessageCountRef.current = nextCount;

    const shouldStick = stickToBottomRef.current || nearBottomRef.current;

    if (shouldStick) {
      scrollToBottom(true);
      return;
    }

    if (added > 0) {
      setUnseenCount((count) => count + added);
    }
  }, [messages, loading, fileUploading, open, view, stagedUpload, scrollToBottom]);

  if (!user || user.role.code !== "CLIENT" || !token) return null;

  const greeting = uiT("chat.greetingClient", { name: user.first_name });
  const showSuggestions = messages.length === 0 && !loading && !fileUploading && !stagedUpload;

  async function handleSend() {
    const text = draft;
    setDraft("");
    stickToBottomRef.current = true;
    setUnseenCount(0);
    await sendMessage(text, locale);
    scrollToBottom(true);
  }

  function handleStartNew() {
    startNewConversation();
    setDraft("");
    prevMessageCountRef.current = 0;
    stickToBottomRef.current = true;
    nearBottomRef.current = true;
    setUnseenCount(0);
    setView("chat");
  }

  async function handleSelectConversation(id: number) {
    const ok = await selectConversation(id);
    if (ok) {
      setDraft("");
      stickToBottomRef.current = true;
      nearBottomRef.current = true;
      setUnseenCount(0);
      setView("chat");
      // El conteo se sincroniza en el efecto de messages.
      setTimeout(() => scrollToBottom(false), 50);
    }
  }

  function handleBackToList() {
    setView("list");
    setUnseenCount(0);
    void loadConversations();
  }

  function openRename(item: ChatConversationSummary) {
    setRenaming(item);
    setRenameDraft(item.title);
  }

  function closeRename() {
    if (renameSaving) return;
    setRenaming(null);
    setRenameDraft("");
  }

  async function saveRename() {
    if (!renaming || renameSaving) return;
    const next = renameDraft.trim();
    if (!next) {
      Alert.alert(uiT("chat.renameConversation"), uiT("chat.renameEmpty"));
      return;
    }
    setRenameSaving(true);
    try {
      await renameConversation(renaming.id, next);
      setRenaming(null);
      setRenameDraft("");
    } catch (err) {
      Alert.alert(
        uiT("chat.renameConversation"),
        getUserFacingErrorMessage(err, uiT("chat.renameError")),
      );
    } finally {
      setRenameSaving(false);
    }
  }

  function handleDeleteConversation(id: number) {
    if (deletingId != null) return;
    setDeletingId(id);
    void deleteConversation(id)
      .catch((err) => {
        Alert.alert(
          uiT("chat.conversationsTitle"),
          getUserFacingErrorMessage(err, uiT("chat.deleteConversationError")),
        );
      })
      .finally(() => setDeletingId(null));
  }

  function handleMessagesScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;
    const atBottom = distanceFromBottom <= 96;
    nearBottomRef.current = atBottom;
    if (atBottom) {
      stickToBottomRef.current = true;
      if (unseenCount > 0) setUnseenCount(0);
    } else {
      stickToBottomRef.current = false;
    }
  }

  function handleContentSizeChange(_w: number, h: number) {
    const grew = h > contentHeightRef.current + 8;
    contentHeightRef.current = h;
    if (grew && (stickToBottomRef.current || nearBottomRef.current)) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }

  async function handlePickSource(source: UploadSource) {
    setPickerOpen(false);
    await waitForModalDismiss(450);
    try {
      const file = await pickUploadFile("chat-attach", source);
      if (!file) return;
      stageFile(file);
      setView("chat");
    } catch {
      // picker cancel / permission — ignore
    }
  }

  const fabBottom = Math.max(insets.bottom, 12) + 8;
  // iOS: KeyboardAvoidingView. Android: con teclado solo bajamos el panel (sin sumar kb height).
  const panelBottom =
    Platform.OS === "android" && androidKeyboard.open ? 8 : fabBottom + 80;
  const topSafe = Math.max(insets.top, 8);
  const basePanelHeight =
    Platform.OS === "android" ? ANDROID_PANEL_HEIGHT : PANEL_HEIGHT;
  // En Android el alto fijo del panel se come la zona visible sobre el teclado:
  // limitamos con screenY del teclado para que no se corte arriba.
  const panelMaxHeight =
    Platform.OS === "android" && androidKeyboard.open && androidKeyboard.topY > 0
      ? Math.max(
          220,
          Math.min(
            basePanelHeight,
            androidKeyboard.topY - topSafe - panelBottom - 48,
          ),
        )
      : Math.min(
          basePanelHeight,
          Dimensions.get("window").height - panelBottom - topSafe,
        );

  // La nube crece desde la esquina del botón flotante.
  const panelAnimStyle = {
    opacity: anim,
    transformOrigin: "bottom right",
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.25, 1],
        }),
      },
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  return (
    <>
      <View pointerEvents="box-none" style={[styles.fabAnchor, { bottom: fabBottom, right: 16 }]}>
        {!panelMounted || !open ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.hintBubble,
              {
                opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [
                  {
                    scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.hintText}>{uiT("chat.helpHint")}</Text>
          </Animated.View>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={open ? uiT("common.close") : uiT("chat.open")}
          activeOpacity={0.85}
          onPress={() => setOpen((prev) => !prev)}
          style={[styles.fab, { backgroundColor: colors.brand }]}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "90deg"],
                  }),
                },
              ],
            }}
          >
            <Ionicons
              name={open ? "close" : "chatbubble-ellipses"}
              size={28}
              color={colors.white}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <Modal
        visible={panelMounted}
        transparent
        animationType="none"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <GestureHandlerRootView style={styles.modalRoot}>
          <Animated.View style={[styles.backdrop, { opacity: anim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          </Animated.View>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[
              styles.panelWrap,
              {
                bottom: panelBottom,
                right: 12,
                height: panelMaxHeight,
                paddingBottom: 0,
              },
            ]}
          >
            <Animated.View style={[styles.panel, panelAnimStyle]}>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>{uiT("chat.title")}</Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {view === "list"
                      ? uiT("chat.conversationsSubtitle")
                      : uiT("chat.subtitleClient")}
                  </Text>
                </View>
                <View style={styles.headerActions}>
                  {view === "chat" ? (
                    <Pressable
                      onPress={handleBackToList}
                      hitSlop={8}
                      accessibilityLabel={uiT("chat.backToConversations")}
                      style={styles.headerBtn}
                    >
                      <Ionicons name="chevron-back" size={20} color={colors.cream} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => setOpen(false)}
                    hitSlop={8}
                    accessibilityLabel={uiT("common.close")}
                    style={styles.headerBtn}
                  >
                    <Ionicons name="close" size={20} color={colors.cream} />
                  </Pressable>
                </View>
              </View>

              {view === "list" ? (
                <View style={styles.listView}>
                  <View style={styles.listIntro}>
                    <Text style={styles.sectionLabel}>{uiT("chat.conversationsTitle")}</Text>
                    <Text style={styles.listIntroHint}>
                      {uiT("chat.conversationsSubtitle")}
                    </Text>
                  </View>

                  {conversationsLoading || conversationLoading ? (
                    <View style={styles.stateCard}>
                      <ActivityIndicator size="small" color={colors.brand} />
                      <Text style={styles.stateText}>{uiT("chat.conversationsLoading")}</Text>
                    </View>
                  ) : conversationsError ? (
                    <View style={[styles.stateCard, styles.errorCard]}>
                      <Text style={styles.errorText}>{conversationsError}</Text>
                    </View>
                  ) : conversations.length === 0 ? (
                    <View style={styles.emptyConv}>
                      <View style={styles.emptyIconWrap}>
                        <Ionicons name="chatbubbles-outline" size={32} color={colors.brand} />
                      </View>
                      <Text style={styles.emptyTitle}>{uiT("chat.conversationsEmpty")}</Text>
                      <Text style={styles.emptyHint}>{uiT("chat.startNewConversation")}</Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={uiT("chat.startNewConversation")}
                        activeOpacity={0.85}
                        onPress={handleStartNew}
                        style={[styles.newFabLarge, { backgroundColor: colors.brand }]}
                      >
                        <Ionicons name="add" size={30} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <FlatList
                      data={conversations}
                      keyExtractor={(item) => String(item.id)}
                      contentContainerStyle={styles.convList}
                      ListFooterComponent={
                        <View style={styles.newBelowList}>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={uiT("chat.startNewConversation")}
                            activeOpacity={0.85}
                            onPress={handleStartNew}
                            style={[styles.newFabLarge, { backgroundColor: colors.brand }]}
                          >
                            <Ionicons name="add" size={30} color={colors.white} />
                          </TouchableOpacity>
                          <Text style={styles.newBelowLabel}>
                            {uiT("chat.startNewConversation")}
                          </Text>
                        </View>
                      }
                      renderItem={({ item }) => (
                        <SwipeToDeleteRow
                          disabled={deletingId === item.id}
                          onDelete={() => handleDeleteConversation(item.id)}
                          onEdit={() => openRename(item)}
                          editLabel={uiT("chat.editConversation")}
                          deleteLabel={uiT("chat.deleteConversation")}
                        >
                          <View style={styles.convCard}>
                            <Pressable
                              onPress={() => void handleSelectConversation(item.id)}
                              style={({ pressed }) => [
                                styles.convItem,
                                pressed && styles.convItemPressed,
                              ]}
                            >
                              <View style={styles.convAccent} />
                              <View style={styles.convBody}>
                                <Text style={styles.convTitle} numberOfLines={2}>
                                  {item.title}
                                </Text>
                                <Text style={styles.convMeta}>
                                  {formatConversationDate(item.updated_at, locale)}
                                  {" · "}
                                  {uiT("chat.conversationMessages", {
                                    count: item.message_count,
                                  })}
                                </Text>
                              </View>
                            </Pressable>
                          </View>
                        </SwipeToDeleteRow>
                      )}
                    />
                  )}
                </View>
              ) : (
                <View style={styles.chatView}>
                  <View style={styles.chatListWrap}>
                    <FlatList
                      ref={listRef}
                      data={messages}
                      keyExtractor={(item) => item.id}
                      contentContainerStyle={styles.messagesContent}
                      onScroll={handleMessagesScroll}
                      scrollEventThrottle={16}
                      onContentSizeChange={handleContentSizeChange}
                      ListHeaderComponent={
                        <View style={styles.messagesHeader}>
                          <View style={[styles.bubble, styles.assistantBubble]}>
                            <Text style={styles.assistantText}>{greeting}</Text>
                          </View>

                          {showSuggestions ? (
                            <View style={styles.suggestions}>
                              <Text style={styles.sectionLabel}>
                                {uiT("chat.suggestionsTitle")}
                              </Text>
                              <View style={styles.suggestionChips}>
                                {CLIENT_SUGGESTIONS.map((key) => {
                                  const label = uiT(key);
                                  return (
                                    <Pressable
                                      key={key}
                                      disabled={loading || !!fileUploading}
                                      onPress={() => {
                                        stickToBottomRef.current = true;
                                        void sendMessage(label, locale);
                                      }}
                                      style={({ pressed }) => [
                                        styles.suggestionChip,
                                        pressed && styles.suggestionChipPressed,
                                      ]}
                                    >
                                      <Text style={styles.suggestionText}>{label}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </View>
                          ) : null}

                          {!stagedUpload ? (
                            <Text style={styles.attachHint}>
                              {uiT("chat.attachFileHintClient")}
                            </Text>
                          ) : null}
                        </View>
                      }
                      ListFooterComponent={
                        <View style={styles.messagesFooter}>
                          {loading && !fileUploading ? (
                            <View style={[styles.bubble, styles.assistantBubble, styles.row]}>
                              <ActivityIndicator size="small" color={colors.brand} />
                              <Text style={styles.stateText}>{uiT("chat.thinking")}</Text>
                            </View>
                          ) : null}
                          {fileUploading ? (
                            <View style={[styles.bubble, styles.assistantBubble, styles.row]}>
                              <ActivityIndicator size="small" color={colors.brand} />
                              <Text style={styles.stateText}>
                                {uiT("chat.uploadingFile", { file: fileUploading })}
                              </Text>
                            </View>
                          ) : null}
                          {error ? (
                            <View style={[styles.stateCard, styles.errorCard]}>
                              <Text style={styles.errorText}>{error}</Text>
                            </View>
                          ) : null}
                        </View>
                      }
                      renderItem={({ item }) =>
                        item.role === "user" ? (
                          <View style={[styles.bubble, styles.userBubble]}>
                            <Text style={styles.userText}>{item.content}</Text>
                          </View>
                        ) : (
                          <View style={[styles.bubble, styles.assistantBubble]}>
                            <MarkdownBody content={item.content} />
                          </View>
                        )
                      }
                    />

                    {unseenCount > 0 ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={uiT("chat.newMessagesJump", {
                          count: unseenCount,
                        })}
                        activeOpacity={0.9}
                        onPress={() => scrollToBottom(true)}
                        style={styles.unseenBadge}
                      >
                        <Text style={styles.unseenCount}>
                          {unseenCount > 99 ? "99+" : unseenCount}
                        </Text>
                        <Ionicons name="arrow-down" size={16} color={colors.white} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {stagedUpload && !fileUploading ? (
                    <ChatDocumentTypePanel
                      fileName={stagedUpload.fileName}
                      disabled={loading || !!fileUploading}
                      t={uiT}
                      onSelectDocumentType={(value) => void finishDocumentUpload(value)}
                      onCancel={cancelStagedUpload}
                    />
                  ) : null}

                  <View style={styles.composer}>
                    <View style={styles.composerRow}>
                      <Pressable
                        accessibilityLabel={uiT("chat.attachFile")}
                        disabled={loading || !!fileUploading}
                        onPress={() => setPickerOpen(true)}
                        style={styles.attachBtn}
                      >
                        <Ionicons name="attach" size={22} color={colors.brand} />
                      </Pressable>
                      <TextInput
                        value={draft}
                        onChangeText={(text) => setDraft(text.slice(0, CHAT_MESSAGE_MAX_LENGTH))}
                        placeholder={uiT("chat.placeholder")}
                        placeholderTextColor={colors.brownMuted}
                        multiline
                        maxLength={CHAT_MESSAGE_MAX_LENGTH}
                        editable={!loading && !fileUploading}
                        autoCorrect
                        autoCapitalize="sentences"
                        spellCheck
                        textContentType="none"
                        keyboardType="default"
                        style={styles.input}
                      />
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={uiT("chat.send")}
                        activeOpacity={0.85}
                        disabled={loading || !!fileUploading || !draft.trim()}
                        onPress={() => void handleSend()}
                        style={[
                          styles.sendBtn,
                          (!draft.trim() || loading || !!fileUploading) && styles.sendBtnDisabled,
                        ]}
                      >
                        <Ionicons name="send" size={20} color={colors.white} />
                      </TouchableOpacity>
                    </View>
                    <Pressable onPress={handleStartNew} style={styles.newLink}>
                      <Text style={styles.newLinkText}>{uiT("chat.newConversation")}</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </Animated.View>
          </KeyboardAvoidingView>

          {/* Anidado en el modal del chat: en iOS un Modal hermano no se
              presenta si ya hay otro visible, por eso el clip "no hacía nada". */}
          <UploadSourceSheet
            visible={pickerOpen}
            title={uiT("chat.attachFile")}
            onClose={() => setPickerOpen(false)}
            onSelect={(source) => {
              void handlePickSource(source);
            }}
          />

          {renaming ? (
            <View style={styles.renameRoot} pointerEvents="box-none">
              <Pressable style={styles.renameBackdrop} onPress={closeRename} />
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.renameWrap}
              >
                <View style={styles.renameCard}>
                  <Text style={styles.renameTitle}>{uiT("chat.renameConversation")}</Text>
                  <TextInput
                    value={renameDraft}
                    onChangeText={(text) => setRenameDraft(text.slice(0, 120))}
                    placeholder={uiT("chat.renamePlaceholder")}
                    placeholderTextColor={colors.brownMuted}
                    autoFocus
                    maxLength={120}
                    editable={!renameSaving}
                    style={styles.renameInput}
                    returnKeyType="done"
                    onSubmitEditing={() => void saveRename()}
                  />
                  <View style={styles.renameActions}>
                    <Pressable
                      disabled={renameSaving}
                      onPress={closeRename}
                      style={styles.renameCancel}
                    >
                      <Text style={styles.renameCancelText}>{uiT("common.cancel")}</Text>
                    </Pressable>
                    <Pressable
                      disabled={renameSaving}
                      onPress={() => void saveRename()}
                      style={[styles.renameSave, renameSaving && styles.renameSaveDisabled]}
                    >
                      {renameSaving ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.renameSaveText}>{uiT("chat.renameSave")}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          ) : null}
          </GestureHandlerRootView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabAnchor: {
    position: "absolute",
    zIndex: 40,
    alignItems: "flex-end",
    gap: 8,
  },
  hintBubble: {
    backgroundColor: "rgba(44, 30, 24, 0.85)",
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 220,
  },
  hintText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  panelWrap: {
    position: "absolute",
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
  },
  panel: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.brown,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: colors.creamWarm,
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
  },
  newFabLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  listView: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  listIntro: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.soft,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  listIntroHint: {
    fontSize: 12,
    color: colors.soft,
    lineHeight: 16,
  },
  emptyConv: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
    paddingBottom: 40,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 13,
    color: colors.soft,
    textAlign: "center",
    marginBottom: 8,
  },
  newBelowList: {
    alignItems: "center",
    gap: 8,
    paddingTop: 18,
    paddingBottom: 8,
  },
  newBelowLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.soft,
  },
  convList: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 16,
  },
  convCard: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#3d6b45",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  convItem: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#ffffff",
  },
  convItemPressed: {
    backgroundColor: "#e8f0e9",
  },
  convAccent: {
    width: 6,
    backgroundColor: "#3d6b45",
  },
  convBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  convTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 20,
  },
  convMeta: {
    fontSize: 12,
    color: colors.soft,
  },
  stateCard: {
    marginHorizontal: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stateText: {
    fontSize: 13,
    color: colors.soft,
    flex: 1,
  },
  errorCard: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
  },
  chatView: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  chatListWrap: {
    flex: 1,
    position: "relative",
  },
  unseenBadge: {
    position: "absolute",
    alignSelf: "center",
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  unseenCount: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
    minWidth: 14,
    textAlign: "center",
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  messagesHeader: {
    gap: 10,
    marginBottom: 4,
  },
  messagesFooter: {
    gap: 8,
    marginTop: 4,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: "92%",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    marginRight: 28,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 6,
    marginLeft: 36,
  },
  assistantText: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  userText: {
    fontSize: 14,
    color: colors.white,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  suggestions: {
    gap: 6,
  },
  suggestionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 2,
  },
  suggestionChip: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionChipPressed: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
  },
  attachHint: {
    fontSize: 11,
    color: colors.soft,
    marginRight: 24,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 6,
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
  input: {
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
  newLink: {
    alignSelf: "flex-end",
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  newLinkText: {
    fontSize: 12,
    color: colors.soft,
  },
  renameRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 20,
    zIndex: 30,
  },
  renameBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  renameWrap: {
    zIndex: 1,
  },
  renameCard: {
    backgroundColor: colors.cream,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 12,
  },
  renameTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.brown,
  },
  renameInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  renameActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },
  renameCancel: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  renameCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.soft,
  },
  renameSave: {
    backgroundColor: colors.brand,
    borderRadius: radii.control,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 88,
    alignItems: "center",
  },
  renameSaveDisabled: {
    opacity: 0.6,
  },
  renameSaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
});
