import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = (clientId: number) => `epoint_portal_pwd_${clientId}`;

export async function savePortalTempPassword(
  clientId: number,
  tempPassword: string,
): Promise<void> {
  await AsyncStorage.setItem(KEY(clientId), tempPassword);
}

export async function loadPortalTempPassword(clientId: number): Promise<string | null> {
  return AsyncStorage.getItem(KEY(clientId));
}

export async function clearPortalTempPassword(clientId: number): Promise<void> {
  await AsyncStorage.removeItem(KEY(clientId));
}
