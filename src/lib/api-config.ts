import { NativeModules, Platform } from "react-native";
import Constants from "expo-constants";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function isPrivateIpv4(host: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const [a, b] = host.split(".").map(Number);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/** Extrae host IPv4 de strings tipo `192.168.0.1:8081`, `exp://192.168.0.1:8081`, etc. */
function extractIpv4Host(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const match = raw.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
  if (!match) return null;
  const host = match[1];
  if (host === "127.0.0.1" || host === "10.0.2.2") return null;
  if (!isPrivateIpv4(host)) return null;
  return host;
}

/** Host LAN desde el que Expo/Metro está sirviendo el bundle. */
function getMetroLanHost(): string | null {
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;

  const candidates = [
    scriptURL,
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.linkingUri,
    Constants.experienceUrl,
    Constants.manifest2?.extra?.expoClient?.hostUri,
    (Constants.manifest as { debuggerHost?: string; hostUri?: string } | null)
      ?.debuggerHost,
    (Constants.manifest as { debuggerHost?: string; hostUri?: string } | null)
      ?.hostUri,
  ];

  for (const raw of candidates) {
    const host = extractIpv4Host(raw);
    if (host) return host;
  }
  return null;
}

/**
 * Base URL de la API.
 *
 * Prioridad:
 * 1. Emulador Android (sin Metro LAN) → 10.0.2.2
 * 2. EXPO_PUBLIC_API_URL (config explícita)
 * 3. Misma IP LAN que Metro / scriptURL (teléfono físico)
 * 4. Fallback por plataforma
 */
export function getApiBaseUrl(): string {
  const metroHost = getMetroLanHost();
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();

  const isAndroidEmulator =
    Platform.OS === "android" && Constants.isDevice === false && !metroHost;

  if (isAndroidEmulator) {
    return "http://10.0.2.2:8000/api/v1";
  }

  // Preferir .env: en dispositivos físicos es la fuente más predecible
  if (fromEnv) {
    return normalizeBaseUrl(fromEnv);
  }

  if (metroHost) {
    return `http://${metroHost}:8000/api/v1`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000/api/v1";
  }
  return "http://localhost:8000/api/v1";
}

/** Solo para diagnóstico en __DEV__. */
export function getApiDebugInfo(): Record<string, unknown> {
  return {
    resolved: getApiBaseUrl(),
    fromEnv: process.env.EXPO_PUBLIC_API_URL ?? null,
    metroHost: getMetroLanHost(),
    isDevice: Constants.isDevice,
    platform: Platform.OS,
    hostUri: Constants.expoConfig?.hostUri ?? null,
    debuggerHost: Constants.expoGoConfig?.debuggerHost ?? null,
    scriptURL: (NativeModules.SourceCode?.scriptURL as string | undefined) ?? null,
  };
}
