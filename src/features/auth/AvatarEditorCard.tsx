import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { User } from "@/types/api";
import { colors } from "@/theme/tokens";

export function AvatarEditorCard() {
  const { user, token, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!user || !token) return null;

  const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase();

  async function pickAndUpload() {
    setError(null);
    setOk(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Necesitamos acceso a la galería para elegir tu foto");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append("file", {
      uri: asset.uri,
      name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
      type: asset.mimeType ?? "image/jpeg",
    } as unknown as Blob);

    setBusy(true);
    try {
      await api.upload<User>("/auth/me/avatar", formData, token);
      await refreshUser();
      setOk("Avatar actualizado");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo subir el avatar"));
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      await api.delete<User>("/auth/me/avatar", token);
      await refreshUser();
      setOk("Avatar eliminado");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo quitar el avatar"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Foto de perfil">
      <View style={styles.row}>
        <View style={styles.avatar}>
          {busy ? (
            <ActivityIndicator color={colors.brand} />
          ) : user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.initials}>{initials || "?"}</Text>
          )}
        </View>
        <View style={styles.actions}>
          <Button
            title={busy ? "Subiendo…" : "Cambiar foto"}
            variant="secondary"
            fullWidth
            disabled={busy}
            onPress={() => void pickAndUpload()}
          />
          {user.avatar_url ? (
            <Pressable disabled={busy} onPress={() => void removeAvatar()}>
              <Text style={styles.remove}>Quitar foto</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Text style={styles.hint}>JPEG, PNG o WebP. Máximo 5 MB.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {ok ? <Text style={styles.ok}>{ok}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandLight,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  initials: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.brand,
  },
  actions: {
    flex: 1,
    gap: 8,
  },
  remove: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
    color: colors.danger,
    paddingVertical: 4,
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.soft,
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    color: colors.danger,
  },
  ok: {
    marginTop: 8,
    fontSize: 13,
    color: colors.brand,
    fontWeight: "600",
  },
});
