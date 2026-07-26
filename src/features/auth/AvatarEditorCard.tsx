import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { User } from "@/types/api";
import { colors } from "@/theme/tokens";

/** Lado máximo del avatar (más que suficiente para UI). */
const AVATAR_MAX_EDGE = 1024;
const AVATAR_JPEG_QUALITY = 0.72;

export function AvatarEditorCard() {
  const { user, token, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (!user || !token) return null;

  const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase();

  async function prepareAvatarUpload(asset: ImagePicker.ImagePickerAsset) {
    const width = asset.width || AVATAR_MAX_EDGE;
    const height = asset.height || AVATAR_MAX_EDGE;
    const longest = Math.max(width, height);
    const actions: ImageManipulator.Action[] = [];

    if (longest > AVATAR_MAX_EDGE) {
      const scale = AVATAR_MAX_EDGE / longest;
      actions.push({
        resize: {
          width: Math.round(width * scale),
          height: Math.round(height * scale),
        },
      });
    }

    const manipulated = await ImageManipulator.manipulateAsync(
      asset.uri,
      actions,
      {
        compress: AVATAR_JPEG_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    return {
      uri: manipulated.uri,
      name: `avatar-${Date.now()}.jpg`,
      type: "image/jpeg",
    };
  }

  async function pickAndUpload() {
    setError(null);
    setOk(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t("account.galleryPermission"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: false,
      allowsEditing: true,
      aspect: [1, 1],
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setBusy(true);
    try {
      const prepared = await prepareAvatarUpload(result.assets[0]);
      const formData = new FormData();
      formData.append("file", {
        uri: prepared.uri,
        name: prepared.name,
        type: prepared.type,
      } as unknown as Blob);

      await api.upload<User>("/auth/me/avatar", formData, token);
      await refreshUser();
      setOk(t("account.avatarSaved"));
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("account.avatarError")));
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
      setOk(t("account.avatarRemoved"));
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("account.avatarRemoveError")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t("account.avatarTitle")}>
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
            title={busy ? t("account.avatarUploading") : t("account.avatarChange")}
            variant="secondary"
            fullWidth
            disabled={busy}
            onPress={() => void pickAndUpload()}
          />
          {user.avatar_url ? (
            <Pressable disabled={busy} onPress={() => void removeAvatar()}>
              <Text style={styles.remove}>{t("account.avatarRemove")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Text style={styles.hint}>{t("account.avatarFormats")}</Text>
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
