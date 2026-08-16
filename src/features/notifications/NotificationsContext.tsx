import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { useAuth } from "@/features/auth/AuthContext";
import {
  connectNotificationStream,
  getStreamAccessToken,
} from "@/features/notifications/notificationStream";
import {
  configurePushNotificationHandler,
  ensureNotificationPermissions,
  isRemotePushSupported,
  presentLocalNotification,
  registerDevicePushToken,
  subscribePushNotificationEvents,
} from "@/features/notifications/pushNotifications";
import { api } from "@/lib/api";
import type { Notification, Paginated } from "@/types/api";
import {
  SaleCongratsModal,
  isSaleCongratsNotification,
  isSaleCongratsPayload,
} from "@/features/notifications/SaleCongratsModal";

interface NotificationsContextValue {
  unreadCount: number;
  recent: Notification[];
  loading: boolean;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  markRead: (ids: number[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (ids: number[]) => Promise<void>;
  presentSaleCongrats: (notification: Notification) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/** Respaldo si el SSE se cae; no debe competir con el stream en tiempo real. */
const POLL_MS = 10 * 60_000;
const STREAM_RECONNECT_MS = 3_000;
const STREAM_START_DEFER_MS = 1_500;
/** Misma lista para campana y pantalla: solo las últimas N. */
export const NOTIFICATIONS_LIST_LIMIT = 10;
const RETENTION_MS = 5 * 24 * 60 * 60 * 1000;

function isWithinRetention(createdAt: string): boolean {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return false;
  return created >= Date.now() - RETENTION_MS;
}

function normalizeList(items: Notification[]): Notification[] {
  return [...items]
    .filter((item) => isWithinRetention(item.created_at))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, NOTIFICATIONS_LIST_LIMIT);
}

function isDuplicateNotification(prev: Notification[], notification: Notification): boolean {
  return prev.some((item) => item.id === notification.id);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [recent, setRecent] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [saleCongrats, setSaleCongrats] = useState<Notification | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const recentRef = useRef<Notification[]>([]);
  const presentedLocalIdsRef = useRef<Set<number>>(new Set());
  const refreshRef = useRef<(options?: { silent?: boolean }) => Promise<void>>(
    async () => {},
  );
  const streamConnectedRef = useRef(false);

  recentRef.current = recent;

  const presentSaleCongrats = useCallback((notification: Notification) => {
    setSaleCongrats(notification);
  }, []);

  const presentSaleCongratsRef = useRef(presentSaleCongrats);
  presentSaleCongratsRef.current = presentSaleCongrats;

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) {
      setRecent([]);
      return;
    }
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const data = await api.get<Paginated<Notification>>(
        `/notifications?page=1&page_size=${NOTIFICATIONS_LIST_LIMIT}&unread_only=false`,
        token,
      );
      const next = normalizeList(data.items);
      setRecent(next);

      // Marcar como "ya vistas" las existentes para no spamear banners al abrir la app
      for (const item of next) {
        presentedLocalIdsRef.current.add(item.id);
      }
    } catch {
      // silencioso: la campana no debe romper la shell
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token]);

  refreshRef.current = refresh;

  const announceOsNotification = useCallback(async (notification: Notification) => {
    if (presentedLocalIdsRef.current.has(notification.id)) return;
    presentedLocalIdsRef.current.add(notification.id);

    // Si hay push remoto registrado, el backend ya manda el banner del sistema.
    // En Expo Go (sin push remoto) siempre mostramos local desde el SSE.
    if (isRemotePushSupported && pushTokenRef.current) {
      const state = AppState.currentState;
      // En foreground el push a veces no se nota: reforzamos con local.
      if (state !== "active") return;
    }

    try {
      await presentLocalNotification({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        data: {
          ...(notification.payload ?? {}),
          event_type: notification.event_type,
        },
      });
    } catch {
      // no romper el flujo in-app
    }
  }, []);

  const applyNotification = useCallback(
    (notification: Notification) => {
      if (notification.read_at) return;
      if (!isWithinRetention(notification.created_at)) return;

      const prev = recentRef.current;
      if (isDuplicateNotification(prev, notification)) {
        void refreshRef.current({ silent: true });
        return;
      }

      setRecent((current) => {
        if (isDuplicateNotification(current, notification)) return current;
        return normalizeList([notification, ...current]);
      });
      void announceOsNotification(notification);
      if (isSaleCongratsNotification(notification)) {
        presentSaleCongratsRef.current(notification);
      }
      void refreshRef.current({ silent: true });
    },
    [announceOsNotification],
  );

  const applyNotificationRef = useRef(applyNotification);
  applyNotificationRef.current = applyNotification;

  const markRead = useCallback(
    async (ids: number[]) => {
      if (!token || ids.length === 0) return;
      try {
        await api.post("/notifications/mark-read", { notification_ids: ids }, token);
        setRecent((prev) =>
          prev.map((item) =>
            ids.includes(item.id)
              ? { ...item, read_at: item.read_at ?? new Date().toISOString() }
              : item,
          ),
        );
      } catch {
        // silencioso
      }
    },
    [token],
  );

  const markAllRead = useCallback(async () => {
    const ids = recent.filter((n) => !n.read_at).map((n) => n.id);
    await markRead(ids);
  }, [markRead, recent]);

  const remove = useCallback(
    async (ids: number[]) => {
      if (!token || ids.length === 0) return;
      const previous = recentRef.current;
      // Salida inmediata de la UI; el API va en background
      setRecent((prev) => prev.filter((item) => !ids.includes(item.id)));
      try {
        await api.post("/notifications/delete", { notification_ids: ids }, token);
        // Reponer en background sin bloquear la UI
        void refreshRef.current({ silent: true });
      } catch (err) {
        setRecent(previous);
        throw err;
      }
    },
    [token],
  );

  useEffect(() => {
    configurePushNotificationHandler();
  }, []);

  useEffect(() => {
    if (!token || !user) {
      setRecent([]);
      pushTokenRef.current = null;
      streamConnectedRef.current = false;
      presentedLocalIdsRef.current = new Set();
      return;
    }
    void refresh();
    void (async () => {
      try {
        await ensureNotificationPermissions();
        pushTokenRef.current = await registerDevicePushToken(token);
      } catch {
        pushTokenRef.current = null;
      }
    })();
  }, [token, user, refresh]);

  // SSE en primer plano y background (mientras el OS mantenga JS vivo)
  useEffect(() => {
    if (!token || !user) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let abortController = new AbortController();
    let stopped = false;

    const clearTimers = () => {
      if (startTimer) clearTimeout(startTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      startTimer = null;
      reconnectTimer = null;
    };

    const startStream = () => {
      if (stopped) return;
      abortController = new AbortController();
      connectNotificationStream(
        () => getStreamAccessToken(token),
        {
          onConnected: () => {
            streamConnectedRef.current = true;
          },
          onNotification: (notification) => applyNotificationRef.current(notification),
          onError: () => {
            streamConnectedRef.current = false;
            if (stopped || abortController.signal.aborted) return;
            reconnectTimer = setTimeout(startStream, STREAM_RECONNECT_MS);
          },
        },
        abortController.signal,
      );
    };

    startTimer = setTimeout(startStream, STREAM_START_DEFER_MS);

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshRef.current({ silent: true });
        if (!streamConnectedRef.current && !stopped) {
          abortController.abort();
          clearTimers();
          startTimer = setTimeout(startStream, 400);
        }
      }
      // No cortar SSE en background: necesitamos recibir eventos y
      // disparar notificación local tipo WhatsApp mientras JS siga vivo.
    });

    return () => {
      stopped = true;
      streamConnectedRef.current = false;
      abortController.abort();
      clearTimers();
      appStateSub.remove();
    };
  }, [token, user]);

  // Poll lento solo como respaldo del SSE
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      void refreshRef.current({ silent: true });
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    return subscribePushNotificationEvents({
      onReceived: () => {
        void refreshRef.current({ silent: true });
      },
      onResponse: (data) => {
        void refreshRef.current({ silent: true });
        if (!isSaleCongratsPayload(data)) return;
        const clientId = Number(data?.client_id);
        const notificationId = Number(data?.notification_id);
        const fromList = recentRef.current.find((item) => {
          if (notificationId && item.id === notificationId) return true;
          return (
            isSaleCongratsNotification(item) &&
            Number(item.payload?.client_id) === clientId
          );
        });
        presentSaleCongratsRef.current(
          fromList ?? {
            id: notificationId || Date.now(),
            event_type: String(data?.event_type ?? "PAYMENT_LINK_COMPLETED"),
            channel: "PUSH",
            title: "",
            body: "",
            payload: data ?? {},
            read_at: null,
            created_at: new Date().toISOString(),
          },
        );
      },
    });
  }, []);

  const unreadCount = useMemo(
    () => recent.filter((item) => !item.read_at).length,
    [recent],
  );

  const value = useMemo(
    () => ({
      unreadCount,
      recent,
      loading,
      refresh,
      markRead,
      markAllRead,
      remove,
      presentSaleCongrats,
    }),
    [unreadCount, recent, loading, refresh, markRead, markAllRead, remove, presentSaleCongrats],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      {saleCongrats ? (
        <SaleCongratsModal
          notification={saleCongrats}
          onClose={() => setSaleCongrats(null)}
        />
      ) : null}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
