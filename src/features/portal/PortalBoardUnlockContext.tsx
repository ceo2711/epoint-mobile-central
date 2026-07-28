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
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";

import { BoardUnlockedCongratsModal } from "@/features/portal/BoardUnlockedCongratsModal";
import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";
import type { Client } from "@/types/api";

type PortalBoardUnlockContextValue = {
  boardUnlocked: boolean;
  client: Client | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const PortalBoardUnlockContext = createContext<PortalBoardUnlockContextValue | null>(null);

function storageKey(clientId: number) {
  return `epoint_portal_board_congrats_seen_${clientId}`;
}

async function clearCongratsSeen(clientId: number) {
  try {
    await AsyncStorage.removeItem(storageKey(clientId));
  } catch {
    /* ignore */
  }
}

async function markCongratsSeen(clientId: number) {
  try {
    await AsyncStorage.setItem(storageKey(clientId), "1");
  } catch {
    /* ignore */
  }
}

async function hasCongratsSeen(clientId: number) {
  try {
    return (await AsyncStorage.getItem(storageKey(clientId))) === "1";
  } catch {
    return false;
  }
}

export function PortalBoardUnlockProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCongrats, setShowCongrats] = useState(false);
  const prevUnlockedRef = useRef<boolean | null>(null);

  const isClient = Boolean(token && user?.role.code === "CLIENT");

  const reload = useCallback(async () => {
    if (!token || !isClient) {
      setClient(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<Client>("/portal/me", token);
      setClient(data);
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, [token, isClient]);

  useEffect(() => {
    if (!isClient) {
      setClient(null);
      setLoading(false);
      return;
    }
    void reload();
  }, [isClient, reload]);

  // Al volver a foreground, refrescar por si la verificación/promoción terminó en background.
  useEffect(() => {
    if (!isClient) return;
    const onChange = (state: AppStateStatus) => {
      if (state === "active") void reload();
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [isClient, reload]);

  const boardUnlocked = Boolean(client?.board_unlocked);
  const clientId = client?.id;

  useEffect(() => {
    if (!isClient || boardUnlocked) return;
    const onDocs =
      typeof pathname === "string" &&
      (pathname.includes("/documentos") || pathname.endsWith("documentos"));
    const intervalMs = onDocs ? 4_000 : 8_000;
    const id = setInterval(() => {
      void reload();
    }, intervalMs);
    return () => clearInterval(id);
  }, [isClient, boardUnlocked, pathname, reload]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    void (async () => {
      const prev = prevUnlockedRef.current;

      if (prev === true && !boardUnlocked) {
        await clearCongratsSeen(clientId);
        if (!cancelled) setShowCongrats(false);
        prevUnlockedRef.current = boardUnlocked;
        return;
      }

      if (boardUnlocked) {
        const seen = await hasCongratsSeen(clientId);
        // Transición live false→true, o cold start ya desbloqueado sin haber visto el modal.
        if (!seen && (prev === false || prev === null)) {
          if (!cancelled) setShowCongrats(true);
        }
      }

      prevUnlockedRef.current = boardUnlocked;
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, boardUnlocked]);

  const dismiss = useCallback(() => {
    if (clientId) void markCongratsSeen(clientId);
    setShowCongrats(false);
  }, [clientId]);

  const goToBoard = useCallback(() => {
    if (clientId) void markCongratsSeen(clientId);
    setShowCongrats(false);
    router.push("/(portal)/(tabs)/tablero" as never);
  }, [clientId, router]);

  const advisorName = useMemo(() => {
    const advisor = client?.advisor;
    if (!advisor) return null;
    const name = `${advisor.first_name ?? ""} ${advisor.last_name ?? ""}`.trim();
    return name || null;
  }, [client?.advisor]);

  const value = useMemo(
    () => ({
      boardUnlocked,
      client,
      loading,
      reload,
    }),
    [boardUnlocked, client, loading, reload],
  );

  return (
    <PortalBoardUnlockContext.Provider value={value}>
      {children}
      {showCongrats ? (
        <BoardUnlockedCongratsModal
          advisorName={advisorName}
          onClose={dismiss}
          onGoToBoard={goToBoard}
        />
      ) : null}
    </PortalBoardUnlockContext.Provider>
  );
}

export function usePortalBoardUnlocked(): boolean {
  const ctx = useContext(PortalBoardUnlockContext);
  if (!ctx) return true;
  return ctx.boardUnlocked;
}

export function usePortalBoardUnlock() {
  return useContext(PortalBoardUnlockContext);
}
