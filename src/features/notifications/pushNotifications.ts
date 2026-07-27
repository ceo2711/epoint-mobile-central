import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

import { api } from "@/lib/api";

/**
 * Push remoto (app cerrada / background OS) NO funciona en Expo Go (SDK 53+).
 * Requiere development build / preview / production (`expo-dev-client` + EAS).
 *
 * En Expo Go cargamos SOLO módulos locales (sin `expo-notifications` index),
 * porque el entry principal registra push tokens y hace console.error.
 */
export const isRemotePushSupported =
  Platform.OS !== "web" && !isRunningInExpoGo();

export const isLocalNotificationsSupported = Platform.OS !== "web";

type LocalNotificationsApi = {
  setNotificationHandler: (handler: {
    handleNotification: () => Promise<{
      shouldShowAlert: boolean;
      shouldShowBanner: boolean;
      shouldShowList: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }) => void;
  scheduleNotificationAsync: (request: {
    content: Record<string, unknown>;
    trigger: null;
  }) => Promise<string>;
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  setNotificationChannelAsync?: (
    id: string,
    channel: Record<string, unknown>,
  ) => Promise<unknown>;
  androidImportanceHigh?: number;
  addNotificationReceivedListener: (listener: () => void) => { remove: () => void };
  addNotificationResponseReceivedListener: (
    listener: (event: {
      notification: { request: { content: { data: Record<string, unknown> } } };
    }) => void,
  ) => { remove: () => void };
};

let localApi: LocalNotificationsApi | null | undefined;

/** Expo Go imprime WARN al cargar expo-notifications; no aporta en desarrollo con Go. */
function withSilencedExpoNotificationWarns<T>(fn: () => T): T {
  if (!isRunningInExpoGo()) return fn();
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (
      msg.includes("expo-notifications") ||
      msg.includes("Expo Go") ||
      msg.includes("development build") ||
      msg.includes("expo.fyi/dev-client")
    ) {
      return;
    }
    originalWarn.apply(console, args as []);
  };
  try {
    return fn();
  } finally {
    console.warn = originalWarn;
  }
}

/**
 * Imports profundos: evita `expo-notifications` (index) → DevicePushTokenAutoRegistration.fx
 * que en Expo Go Android hace console.error al suscribir push tokens.
 */
function loadLocalNotifications(): LocalNotificationsApi | null {
  if (!isLocalNotificationsSupported) return null;
  if (localApi !== undefined) return localApi;

  try {
    localApi = withSilencedExpoNotificationWarns(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const handler = require("expo-notifications/build/NotificationsHandler") as {
        setNotificationHandler: LocalNotificationsApi["setNotificationHandler"];
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const scheduleMod = require("expo-notifications/build/scheduleNotificationAsync") as {
        default: LocalNotificationsApi["scheduleNotificationAsync"];
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const perms = require("expo-notifications/build/NotificationPermissions") as {
        getPermissionsAsync: LocalNotificationsApi["getPermissionsAsync"];
        requestPermissionsAsync: LocalNotificationsApi["requestPermissionsAsync"];
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const emitter = require("expo-notifications/build/NotificationsEmitter") as {
        addNotificationReceivedListener: LocalNotificationsApi["addNotificationReceivedListener"];
        addNotificationResponseReceivedListener: LocalNotificationsApi["addNotificationResponseReceivedListener"];
      };

      let setNotificationChannelAsync: LocalNotificationsApi["setNotificationChannelAsync"];
      let androidImportanceHigh: number | undefined;
      if (Platform.OS === "android") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const channelMod = require("expo-notifications/build/setNotificationChannelAsync") as {
          default: NonNullable<LocalNotificationsApi["setNotificationChannelAsync"]>;
        };
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const types = require("expo-notifications/build/NotificationChannelManager.types") as {
          AndroidImportance: { HIGH: number };
        };
        setNotificationChannelAsync = channelMod.default;
        androidImportanceHigh = types.AndroidImportance.HIGH;
      }

      return {
        setNotificationHandler: handler.setNotificationHandler,
        scheduleNotificationAsync: scheduleMod.default,
        getPermissionsAsync: perms.getPermissionsAsync,
        requestPermissionsAsync: perms.requestPermissionsAsync,
        setNotificationChannelAsync,
        androidImportanceHigh,
        addNotificationReceivedListener: emitter.addNotificationReceivedListener,
        addNotificationResponseReceivedListener:
          emitter.addNotificationResponseReceivedListener,
      };
    });
  } catch {
    localApi = null;
  }

  return localApi;
}

const ANDROID_CHANNEL_ID = "epoint-default";

let handledColdStartResponse = false;

function getEasProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

export function configurePushNotificationHandler(): void {
  const Notifications = loadLocalNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  const Notifications = loadLocalNotifications();
  if (!Notifications) return false;

  if (Platform.OS === "android" && Notifications.setNotificationChannelAsync) {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Epoint",
      importance: Notifications.androidImportanceHigh ?? 6,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3d6b45",
      sound: "default",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === "granted";
}

export async function presentLocalNotification(input: {
  id?: number;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
}): Promise<void> {
  const Notifications = loadLocalNotifications();
  if (!Notifications) return;

  const granted = await ensureNotificationPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      data: {
        ...(input.data ?? {}),
        notification_id: input.id ?? null,
        source: "epoint-local",
      },
      sound: true,
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}

/**
 * Registra el Expo Push Token en el backend.
 * Solo en development/production builds (no Expo Go) y en dispositivo físico.
 */
export async function registerDevicePushToken(
  authToken: string,
): Promise<string | null> {
  if (!isRemotePushSupported) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require("expo-device") as typeof import("expo-device");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require("expo-notifications") as typeof import("expo-notifications");

    if (!Device.isDevice) {
      return null;
    }

    const granted = await ensureNotificationPermissions();
    if (!granted) {
      return null;
    }

    const projectId = getEasProjectId();
    if (!projectId) {
      return null;
    }

    const push = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoToken = push.data;
    if (!expoToken) return null;

    await api.post(
      "/notifications/device-token",
      {
        token: expoToken,
        platform: Platform.OS === "ios" ? "ios" : "android",
      },
      authToken,
    );

    return expoToken;
  } catch {
    return null;
  }
}

export function subscribePushNotificationEvents(handlers: {
  onReceived: () => void;
  onResponse: (data: Record<string, unknown> | undefined) => void;
}): () => void {
  const Notifications = loadLocalNotifications();
  if (!Notifications) return () => {};

  const received = Notifications.addNotificationReceivedListener(() => {
    handlers.onReceived();
  });
  const response = Notifications.addNotificationResponseReceivedListener((event) => {
    handlers.onResponse(event.notification.request.content.data);
  });

  // App abierta desde notificación (estaba cerrada / killed)
  void (async () => {
    if (handledColdStartResponse || !isRemotePushSupported) return;
    try {
      await withSilencedExpoNotificationWarns(async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const full = require("expo-notifications") as typeof import("expo-notifications");
        if (!full.getLastNotificationResponseAsync) return;
        const last = await full.getLastNotificationResponseAsync();
        handledColdStartResponse = true;
        if (last?.notification?.request?.content?.data) {
          handlers.onResponse(
            last.notification.request.content.data as Record<string, unknown>,
          );
        }
      });
    } catch {
      handledColdStartResponse = true;
    }
  })();

  return () => {
    received.remove();
    response.remove();
  };
}
