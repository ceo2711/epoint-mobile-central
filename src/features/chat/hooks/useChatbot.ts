import { useCallback, useEffect, useRef, useState } from "react";

import { clearChatState, loadChatState, saveChatState } from "@/features/chat/chat-storage";
import type {
  ChatbotApiResponse,
  ChatConversationDetail,
  ChatConversationSummary,
  ChatMessage,
  PendingChatAction,
} from "@/features/chat/types";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/features/chat/types";
import { useTranslation } from "@/contexts/LanguageContext";
import type { UploadFileAsset } from "@/features/documents/pickUploadSource";
import { translate, type Locale } from "@/i18n";
import { api, getUserFacingErrorMessage } from "@/lib/api";

function newMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeChatLocale(locale: string): "es" | "en" {
  return locale.toLowerCase().startsWith("en") ? "en" : "es";
}

export interface StagedUpload {
  file: UploadFileAsset;
  fileName: string;
}

interface UseChatbotOptions {
  userId?: number | null;
  clientId?: number | null;
}

export function useChatbot(
  token: string | null,
  defaultLocale: string,
  options: UseChatbotOptions = {},
) {
  const { userId = null, clientId = null } = options;
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileUploading, setFileUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingChatAction | null>(null);
  const [stagedUpload, setStagedUpload] = useState<StagedUpload | null>(null);
  const [chatLocale, setChatLocale] = useState<"es" | "en">(normalizeChatLocale(defaultLocale));
  const [chatHydrated, setChatHydrated] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [conversationLoading, setConversationLoading] = useState(false);

  const pendingActionRef = useRef<PendingChatAction | null>(null);
  const stagedUploadRef = useRef<StagedUpload | null>(null);
  const conversationIdRef = useRef<number | null>(null);
  const loadedUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    pendingActionRef.current = pendingAction;
  }, [pendingAction]);

  useEffect(() => {
    stagedUploadRef.current = stagedUpload;
  }, [stagedUpload]);

  useEffect(() => {
    if (!userId) {
      loadedUserIdRef.current = null;
      setChatHydrated(false);
      setMessages([]);
      setPendingAction(null);
      pendingActionRef.current = null;
      setConversationId(null);
      conversationIdRef.current = null;
      setConversations([]);
      return;
    }

    if (loadedUserIdRef.current === userId) return;

    let cancelled = false;
    void (async () => {
      const saved = await loadChatState(userId);
      if (cancelled) return;

      if (saved) {
        setMessages(saved.messages);
        setPendingAction(saved.pendingAction);
        pendingActionRef.current = saved.pendingAction;
        // Siempre alinear con el idioma actual de la app.
        setChatLocale(normalizeChatLocale(defaultLocale));
        setConversationId(saved.conversationId);
        conversationIdRef.current = saved.conversationId;
      } else {
        setMessages([]);
        setPendingAction(null);
        pendingActionRef.current = null;
        setChatLocale(normalizeChatLocale(defaultLocale));
        setConversationId(null);
        conversationIdRef.current = null;
      }

      setError(null);
      setStagedUpload(null);
      setConversations([]);
      setConversationsError(null);
      loadedUserIdRef.current = userId;
      setChatHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, defaultLocale]);

  useEffect(() => {
    if (!userId || !chatHydrated) return;
    void saveChatState(userId, {
      conversationId,
      messages,
      pendingAction,
      chatLocale,
      activeClientId: clientId,
    });
  }, [userId, chatHydrated, conversationId, messages, pendingAction, chatLocale, clientId]);

  const chatT = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(normalizeChatLocale(defaultLocale) as Locale, key, params),
    [defaultLocale],
  );

  // La UI y las respuestas siguen el idioma de la app, no el de una conversación vieja.
  useEffect(() => {
    setChatLocale(normalizeChatLocale(defaultLocale));
  }, [defaultLocale]);

  const appendAssistant = useCallback((content: string) => {
    setMessages((prev) => [...prev, { id: newMessageId(), role: "assistant", content }]);
  }, []);

  const applyChatResponse = useCallback(
    (response: ChatbotApiResponse, preferredLocale: "es" | "en") => {
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
        conversationIdRef.current = response.conversation_id;
      }
      pendingActionRef.current = response.pending_action;
      setPendingAction(response.pending_action);
      // Preferir el idioma de la app; el backend puede devolver el de la conversación vieja.
      setChatLocale(preferredLocale);
      appendAssistant(response.reply);
    },
    [appendAssistant],
  );

  const sendMessage = useCallback(
    async (text: string, uiLocale: string) => {
      const trimmed = text.trim();
      if (!trimmed || !token || loading) return;

      const preferredLocale = normalizeChatLocale(uiLocale);

      if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
        setError(chatT("chat.messageTooLong", { max: CHAT_MESSAGE_MAX_LENGTH }));
        return;
      }

      const userMessage: ChatMessage = {
        id: newMessageId(),
        role: "user",
        content: trimmed,
      };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError(null);
      setChatLocale(preferredLocale);

      if (stagedUploadRef.current) {
        appendAssistant(chatT("chat.useUploadPanel"));
        setLoading(false);
        return;
      }

      const currentPendingAction = pendingActionRef.current;

      try {
        const history = [...messages, userMessage].slice(-20).map((item) => ({
          role: item.role,
          content: item.content,
        }));

        const response = await api.post<ChatbotApiResponse>(
          "/chatbot/message",
          {
            message: trimmed,
            history: history.slice(0, -1),
            client_id: clientId,
            locale: preferredLocale,
            chat_locale: preferredLocale,
            pending_action: currentPendingAction,
            conversation_id: conversationIdRef.current,
          },
          token,
        );

        applyChatResponse(response, preferredLocale);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("common.requestError")));
      } finally {
        setLoading(false);
      }
    },
    [
      token,
      loading,
      messages,
      clientId,
      applyChatResponse,
      appendAssistant,
      chatT,
      t,
    ],
  );

  const cancelStagedUpload = useCallback(() => {
    setStagedUpload(null);
    setError(null);
  }, []);

  const stageFile = useCallback((file: UploadFileAsset) => {
    setError(null);
    setMessages((prev) => [
      ...prev,
      { id: newMessageId(), role: "user", content: `📎 ${file.name}` },
    ]);
    setStagedUpload({ file, fileName: file.name });
  }, []);

  const finishDocumentUpload = useCallback(
    async (documentType: string) => {
      if (!token || !stagedUpload || loading || fileUploading) return;

      const { file, fileName } = stagedUpload;
      setStagedUpload(null);
      setFileUploading(fileName);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("document_type", documentType);
        formData.append("file", {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        } as unknown as Blob);

        await api.upload("/documents/upload", formData, token);

        const label = translate(normalizeChatLocale(defaultLocale) as Locale, `documentTypes.${documentType}`);
        appendAssistant(chatT("chat.uploadDocumentSuccess", { type: label }));
      } catch (err) {
        const message = getUserFacingErrorMessage(err, t("common.error"));
        setError(message);
        appendAssistant(chatT("chat.uploadError", { message }));
      } finally {
        setFileUploading(null);
      }
    },
    [token, stagedUpload, loading, fileUploading, defaultLocale, chatT, appendAssistant, t],
  );

  const resetChat = useCallback(() => {
    if (userId) {
      void clearChatState(userId);
    }
    setMessages([]);
    setError(null);
    pendingActionRef.current = null;
    setPendingAction(null);
    setStagedUpload(null);
    setFileUploading(null);
    setConversationId(null);
    conversationIdRef.current = null;
    setChatLocale(normalizeChatLocale(defaultLocale));
  }, [userId, defaultLocale]);

  const loadConversations = useCallback(async () => {
    if (!token) return;
    setConversationsLoading(true);
    setConversationsError(null);
    try {
      const items = await api.get<ChatConversationSummary[]>(
        "/chatbot/conversations?limit=20",
        token,
      );
      setConversations(items);
    } catch (err) {
      setConversations([]);
      setConversationsError(getUserFacingErrorMessage(err, t("chat.conversationsError")));
    } finally {
      setConversationsLoading(false);
    }
  }, [token, t]);

  const startNewConversation = useCallback(() => {
    resetChat();
  }, [resetChat]);

  const selectConversation = useCallback(
    async (id: number) => {
      if (!token) return false;
      setConversationLoading(true);
      setError(null);
      try {
        const detail = await api.get<ChatConversationDetail>(
          `/chatbot/conversations/${id}`,
          token,
        );
        setConversationId(detail.id);
        conversationIdRef.current = detail.id;
        setMessages(
          detail.messages.map((item) => ({
            id: `srv-${item.id}`,
            role: item.role,
            content: item.content,
          })),
        );
        setPendingAction(null);
        pendingActionRef.current = null;
        setStagedUpload(null);
        setFileUploading(null);
        // Seguir el idioma de la app aunque la conversación vieja haya sido en otro.
        setChatLocale(normalizeChatLocale(defaultLocale));
        return true;
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("common.requestError")));
        return false;
      } finally {
        setConversationLoading(false);
      }
    },
    [token, t, defaultLocale],
  );

  const deleteConversation = useCallback(
    async (id: number) => {
      if (!token) return;
      const previous = conversations;
      setConversations((current) => current.filter((item) => item.id !== id));
      if (conversationIdRef.current === id) {
        resetChat();
      }
      try {
        await api.delete(`/chatbot/conversations/${id}`, token);
      } catch (err) {
        setConversations(previous);
        throw err;
      }
    },
    [token, conversations, resetChat],
  );

  const renameConversation = useCallback(
    async (id: number, title: string) => {
      if (!token) return;
      const trimmed = title.trim();
      if (!trimmed) {
        throw new Error(t("chat.renameEmpty"));
      }
      const updated = await api.patch<ChatConversationSummary>(
        `/chatbot/conversations/${id}`,
        { title: trimmed },
        token,
      );
      setConversations((current) =>
        current.map((item) => (item.id === id ? { ...item, ...updated } : item)),
      );
    },
    [token, t],
  );

  return {
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
    chatLocale,
    stagedUpload,
    chatT,
  };
}
