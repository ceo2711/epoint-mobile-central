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

type InScreenBackHandler = () => void;

type BackGestureContextValue = {
  /** Pantallas con scroll horizontal (p. ej. Kanban) piden silenciar el gesto. */
  suppressCount: number;
  suppressBackGesture: () => () => void;
  isBackGestureSuppressed: boolean;
  hasInScreenBack: boolean;
  registerInScreenBack: (handler: InScreenBackHandler) => () => void;
  runInScreenBack: () => boolean;
};

const BackGestureContext = createContext<BackGestureContextValue | null>(null);

export function BackGestureProvider({ children }: { children: ReactNode }) {
  const [suppressCount, setSuppressCount] = useState(0);
  const [handlerCount, setHandlerCount] = useState(0);
  const handlersRef = useRef<InScreenBackHandler[]>([]);

  const suppressBackGesture = useCallback(() => {
    setSuppressCount((n) => n + 1);
    return () => setSuppressCount((n) => Math.max(0, n - 1));
  }, []);

  const registerInScreenBack = useCallback((handler: InScreenBackHandler) => {
    handlersRef.current = [...handlersRef.current, handler];
    setHandlerCount(handlersRef.current.length);
    return () => {
      handlersRef.current = handlersRef.current.filter((item) => item !== handler);
      setHandlerCount(handlersRef.current.length);
    };
  }, []);

  const runInScreenBack = useCallback(() => {
    const handler = handlersRef.current[handlersRef.current.length - 1];
    if (!handler) return false;
    handler();
    return true;
  }, []);

  const value = useMemo(
    () => ({
      suppressCount,
      suppressBackGesture,
      isBackGestureSuppressed: suppressCount > 0,
      hasInScreenBack: handlerCount > 0,
      registerInScreenBack,
      runInScreenBack,
    }),
    [
      suppressCount,
      suppressBackGesture,
      handlerCount,
      registerInScreenBack,
      runInScreenBack,
    ],
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

/**
 * Atrás in-screen (lista → detalle en la misma ruta).
 * El swipe del borde y el botón atrás del sistema ejecutan `onBack`.
 */
export function useInScreenBack(onBack: (() => void) | undefined) {
  const ctx = useContext(BackGestureContext);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const enabled = typeof onBack === "function";

  useEffect(() => {
    if (!enabled || !ctx) return;
    return ctx.registerInScreenBack(() => {
      onBackRef.current?.();
    });
  }, [enabled, ctx]);
}
