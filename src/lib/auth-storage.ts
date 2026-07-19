import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "epoint_access_token";
const REFRESH_TOKEN_KEY = "epoint_refresh_token";
const TWO_FA_TEMP_TOKEN_KEY = "epoint_2fa_temp_token";

type TokenListener = (token: string) => void;
const tokenListeners = new Set<TokenListener>();

export function onAccessTokenRefreshed(listener: TokenListener): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

function notifyTokenRefreshed(token: string) {
  tokenListeners.forEach((listener) => listener(token));
}

async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function storageDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getToken(): Promise<string | null> {
  return storageGet(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return storageGet(REFRESH_TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await storageSet(TOKEN_KEY, token);
  notifyTokenRefreshed(token);
}

export async function setRefreshToken(token: string): Promise<void> {
  await storageSet(REFRESH_TOKEN_KEY, token);
}

export async function setSession(accessToken: string, refreshToken: string): Promise<void> {
  await setToken(accessToken);
  await setRefreshToken(refreshToken);
}

export async function clearToken(): Promise<void> {
  await storageDelete(TOKEN_KEY);
  await storageDelete(REFRESH_TOKEN_KEY);
  await storageDelete(TWO_FA_TEMP_TOKEN_KEY);
}

export async function getTwoFactorTempToken(): Promise<string | null> {
  return storageGet(TWO_FA_TEMP_TOKEN_KEY);
}

export async function setTwoFactorTempToken(token: string): Promise<void> {
  await storageSet(TWO_FA_TEMP_TOKEN_KEY, token);
}

export async function clearTwoFactorTempToken(): Promise<void> {
  await storageDelete(TWO_FA_TEMP_TOKEN_KEY);
}
