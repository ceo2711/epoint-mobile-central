import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BackGestureContextValue = {
  /** Pantallas con scroll horizontal (p. ej. Kanban) piden silenciar el gesto. */
  suppressCount: number;
  suppressBackGesture: () => () => void;
  isBackGestureSuppressed: boolean;
};

const BackGestureContext = createContext<BackGestureContextValue | null>(null);

export function BackGestureProvider({ children }: { children: ReactNode }) {
  const [suppressCount, setSuppressCount] = useState(0);

  const suppressBackGesture = useCallback(() => {
    setSuppressCount((n) => n + 1);
    return () => setSuppressCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo(
    () => ({
      suppressCount,
      suppressBackGesture,
      isBackGestureSuppressed: suppressCount > 0,
    }),
    [suppressCount, suppressBackGesture],
  );

  return (
    <BackGestureContext.Provider value={value}>{children}</BackGestureContext.Provider>
  );
}

export function useBackGestureController() {
  const ctx = useContext(BackGestureContext);
  if (!ctx) {
    throw new Error("useBackGestureController debe usarse dentro de BackGestureProvider");
  }
  return ctx;
}

/** Silencia el gesto de atrás (custom + nativo) mientras el componente esté montado. */
export function useSuppressBackGesture(enabled = true) {
  const ctx = useContext(BackGestureContext);

  useEffect(() => {
    if (!enabled || !ctx) return;
    return ctx.suppressBackGesture();
  }, [enabled, ctx]);
}
