import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getLocales } from "expo-localization";

import {
  defaultLocale,
  getMessages,
  translate,
  type Locale,
  type Messages,
} from "@/i18n";

type LanguageContextValue = {
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  messages: Messages;
  ready: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function resolveDeviceLocale(): Locale {
  try {
    const device = getLocales()[0];
    const code = (device?.languageCode ?? device?.languageTag ?? "").toLowerCase();
    if (code.startsWith("en")) return "en";
    if (code.startsWith("es")) return "es";
  } catch {
    // fall through
  }
  return defaultLocale;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => resolveDeviceLocale());
  const [ready, setReady] = useState(false);

  const syncFromDevice = useCallback(() => {
    setLocale(resolveDeviceLocale());
  }, []);

  useEffect(() => {
    syncFromDevice();
    setReady(true);

    const onChange = (state: AppStateStatus) => {
      if (state === "active") syncFromDevice();
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [syncFromDevice]);

  const messages = useMemo(() => getMessages(locale), [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, t, messages, ready }),
    [locale, t, messages, ready],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage debe usarse dentro de LanguageProvider");
  return ctx;
}

export function useTranslation() {
  const { t, locale, messages, ready } = useLanguage();
  return { t, locale, messages, ready };
}
