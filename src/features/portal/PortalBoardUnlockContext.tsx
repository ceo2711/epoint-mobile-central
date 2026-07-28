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

    const prev = prevUnlockedRef.current;

    if (prev === true && !boardUnlocked) {
      void clearCongratsSeen(clientId);
      setShowCongrats(false);
    }

    if (prev === false && boardUnlocked) {
      setShowCongrats(true);
    }

    prevUnlockedRef.current = boardUnlocked;
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
        <BoardUnlockedCongratsModal onClose={dismiss} onGoToBoard={goToBoard} />
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
