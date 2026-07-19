import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  clearPortalTempPassword,
  savePortalTempPassword,
} from "@/features/clients/portal-credentials";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { Client, ClientPortalPassword } from "@/types/api";
import { colors } from "@/theme/tokens";

interface ClientPortalCredentialsCardProps {
  client: Client;
  token: string;
  canReset: boolean;
}

export function ClientPortalCredentialsCard({
  client,
  token,
  canReset,
}: ClientPortalCredentialsCardProps) {
  const [password, setPassword] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const portalEmail = client.portal_email ?? client.email;

  const hydrate = useCallback(async () => {
    if (client.portal_temp_password) {
      setPassword(client.portal_temp_password);
      await savePortalTempPassword(client.id, client.portal_temp_password);
      return;
    }
    // API sin temporal: limpiar cache local (cliente ya cambió la clave)
    await clearPortalTempPassword(client.id);
    setPassword(null);
  }, [client.id, client.portal_temp_password]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  function revealPassword() {
    if (!password) {
      Alert.alert(
        "Contraseña no disponible",
        "El cliente ya cambió su contraseña o la temporal ya no está disponible. Generá una nueva si tenés permiso.",
      );
      return;
    }
    setVisible((v) => !v);
  }

  function showPasswordAlert() {
    if (!password) {
      Alert.alert(
        "Contraseña no disponible",
        "El cliente ya cambió su contraseña o la temporal ya no está disponible.",
      );
      return;
    }
    Alert.alert("Contraseña temporal", password);
  }

  async function onReset() {
    setResetting(true);
    setError(null);
    try {
      const res = await api.post<ClientPortalPassword>(
        `/clients/${client.id}/reset-portal-password`,
        {},
        token,
      );
      await savePortalTempPassword(client.id, res.temp_password);
      setPassword(res.temp_password);
      setVisible(true);
      Alert.alert("Nueva contraseña", res.temp_password);
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudo restablecer la contraseña"));
    } finally {
      setResetting(false);
    }
  }

  return (
    <Card title="Credenciales del portal">
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.row}>
        Usuario: <Text style={styles.value}>{portalEmail}</Text>
      </Text>

      <View style={styles.passwordRow}>
        <Text style={styles.row}>
          Contraseña:{" "}
          <Text style={styles.value}>
            {password
              ? visible
                ? password
                : "••••••••••••"
              : "Cliente ya cambió su clave (o no hay temporal)"}
          </Text>
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          title={visible ? "Ocultar" : "Mostrar"}
          variant="secondary"
          onPress={revealPassword}
        />
        <Button title="Ver / copiar" variant="ghost" onPress={showPasswordAlert} />
        <Pressable
          onPress={() => Alert.alert("Usuario del portal", portalEmail)}
          style={styles.linkBtn}
        >
          <Text style={styles.linkText}>Ver usuario</Text>
        </Pressable>
      </View>

      {canReset ? (
        <Button
          title="Generar nueva contraseña"
          variant="secondary"
          fullWidth
          loading={resetting}
          onPress={() => void onReset()}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    fontSize: 14,
    color: colors.ink,
    lineHeight: 20,
  },
  value: {
    fontWeight: "700",
  },
  passwordRow: {
    gap: 4,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  linkBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brand,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});
