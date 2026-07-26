export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export const CHAT_MESSAGE_MAX_LENGTH = 6000;

export interface PendingChatAction {
  action: string;
  client_id?: number | null;
  client_ids?: number[];
  advisor_user_id?: number | null;
  draft?: Record<string, unknown>;
}

export interface ChatbotApiResponse {
  reply: string;
  client_id: number | null;
  pending_action: PendingChatAction | null;
  chat_locale: string;
  conversation_id?: number | null;
}

export interface ChatConversationSummary {
  id: number;
  title: string;
  chat_locale: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatConversationDetail {
  id: number;
  title: string;
  chat_locale: string;
  created_at: string;
  updated_at: string;
  messages: Array<{
    id: number;
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }>;
}
