import { Platform } from "react-native";

/**
 * Base URL de la API.
 * - Override: EXPO_PUBLIC_API_URL
 * - Android emulador: 10.0.2.2 (alias de localhost del host)
 * - iOS simulador / web: localhost
 * - Dispositivo físico: usar IP LAN del PC en .env
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000/api/v1";
  }
  return "http://localhost:8000/api/v1";
}
