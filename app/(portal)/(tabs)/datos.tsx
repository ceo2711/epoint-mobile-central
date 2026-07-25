import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ScreenState } from "@/components/ui/ScreenState";
import { Section } from "@/components/ui/Section";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import type { Client } from "@/types/api";
import { colors } from "@/theme/tokens";

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) ? n : NaN;
}

function parseRequiredInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) ? n : NaN;
}

function currentYear() {
  return new Date().getFullYear();
}

export default function PortalDatosScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [ssn, setSsn] = useState("");
  const [storedSsn, setStoredSsn] = useState<string | null>(null);
  const [dob, setDob] = useState("");
  const [addr, setAddr] = useState({
    street: "",
    city: "",
    state: "",
    zip_code: "",
    residence_since_month: "",
    residence_since_year: "",
  });
  const [vehicle, setVehicle] = useState({ model: "", year: "", color: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadStoredSsn = useCallback(
    async (hasSsn: boolean) => {
      if (!token || !hasSsn) {
        setStoredSsn(null);
        return;
      }
      try {
        const data = await api.get<{ ssn: string }>("/portal/ssn", token);
        setStoredSsn(data.ssn);
      } catch {
        setStoredSsn(null);
      }
    },
    [token],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const c = await api.get<Client>("/portal/me", token);
      setClient(c);
      if (c.date_of_birth) setDob(c.date_of_birth);
      const a = c.addresses?.find((x) => x.type === "CURRENT");
      if (a) {
        setAddr({
          street: a.street,
          city: a.city,
          state: a.state,
          zip_code: a.zip_code,
          residence_since_month: String(a.residence_since_month ?? ""),
          residence_since_year: String(a.residence_since_year ?? ""),
        });
      }
      const v = c.vehicles?.find((x) => x.order === 1);
      if (v) setVehicle({ model: v.model, year: String(v.year), color: v.color });
      await loadStoredSsn(c.has_ssn);
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudieron cargar tus datos"));
    } finally {
      setLoading(false);
    }
  }, [token, loadStoredSsn]);

  useEffect(() => {
    if (!authLoading && token) {
      void load();
    }
  }, [authLoading, token, load]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    const ssnDigits = ssn.trim().replace(/\D/g, "");
    if (ssn.trim() && ssnDigits.length !== 9) {
      next.ssn = "El SSN debe tener 9 dígitos";
    }
    if (dob.trim() && Number.isNaN(Date.parse(dob))) {
      next.dob = "Fecha de nacimiento inválida (YYYY-MM-DD)";
    }
    const month = parseOptionalInt(addr.residence_since_month);
    if (
      addr.residence_since_month.trim() &&
      (Number.isNaN(month) || month === null || month < 1 || month > 12)
    ) {
      next.month = "Mes inválido (1-12)";
    }
    const year = parseOptionalInt(addr.residence_since_year);
    if (
      addr.residence_since_year.trim() &&
      (Number.isNaN(year) || year === null || year < 1900 || year > 2100)
    ) {
      next.year = "Año inválido";
    }
    if (!addr.street.trim()) next.street = "Requerido";
    if (!addr.city.trim()) next.city = "Requerido";
    if (!addr.state.trim()) next.state = "Requerido";
    if (!addr.zip_code.trim()) next.zip = "Requerido";
    if (!vehicle.model.trim()) next.model = "Requerido";
    if (!vehicle.color.trim()) next.color = "Requerido";
    const vehicleYear = parseRequiredInt(vehicle.year);
    const maxYear = currentYear();
    if (!vehicle.year.trim()) {
      next.vehicleYear = "Requerido";
    } else if (
      Number.isNaN(vehicleYear) ||
      vehicleYear === null ||
      vehicleYear < 1900 ||
      vehicleYear > maxYear
    ) {
      next.vehicleYear = `Año inválido (1900-${maxYear})`;
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSave() {
    if (!token) return;
    setMessage("");
    setError("");
    if (!validate()) return;

    const year = parseRequiredInt(vehicle.year);
    if (year === null || Number.isNaN(year)) return;

    const profilePayload: { ssn?: string; date_of_birth?: string } = {};
    if (ssn.trim()) profilePayload.ssn = ssn.trim();
    if (dob.trim()) profilePayload.date_of_birth = dob.trim();

    setSaving(true);
    try {
      if (Object.keys(profilePayload).length > 0) {
        await api.patch("/portal/profile", profilePayload, token);
      }
      await api.post(
        "/portal/addresses",
        {
          type: "CURRENT",
          street: addr.street.trim(),
          city: addr.city.trim(),
          state: addr.state.trim(),
          zip_code: addr.zip_code.trim(),
          residence_since_month: parseOptionalInt(addr.residence_since_month),
          residence_since_year: parseOptionalInt(addr.residence_since_year),
        },
        token,
      );
      await api.post(
        "/portal/vehicles",
        {
          order: 1,
          model: vehicle.model.trim(),
          year,
          color: vehicle.color.trim(),
        },
        token,
      );
      const updated = await api.get<Client>("/portal/me", token);
      setClient(updated);
      setSsn("");
      await loadStoredSsn(updated.has_ssn);
      setMessage("Datos guardados correctamente");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "No se pudieron guardar los datos"));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return <ScreenState loading message="Cargando tus datos…" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Mis datos</Text>
        <Text style={styles.subtitle}>
          Completá tu información personal, domicilio y vehículo principal.
        </Text>

        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Section title="Datos básicos">
          {client?.has_ssn ? (
            <View style={styles.ssnBox}>
              <Text style={styles.ssnLabel}>SSN en archivo</Text>
              <Text style={styles.ssnValue}>{storedSsn ?? "•••••••••"}</Text>
              <Text style={styles.hint}>Dejá el campo vacío para mantener el actual.</Text>
            </View>
          ) : null}
          <Input
            label="SSN"
            value={ssn}
            onChangeText={setSsn}
            placeholder={client?.has_ssn ? "Actualizar SSN" : "123-45-6789"}
            keyboardType="number-pad"
            secureTextEntry
            error={fieldErrors.ssn}
          />
          <Input
            label="Fecha de nacimiento"
            value={dob}
            onChangeText={setDob}
            placeholder="YYYY-MM-DD"
            error={fieldErrors.dob}
          />
        </Section>

        <Section title="Domicilio actual">
          <AddressAutocomplete
            label="Calle"
            value={addr.street}
            onChangeText={(v) => setAddr({ ...addr, street: v })}
            onSelect={(resolved) =>
              setAddr((prev) => ({
                ...prev,
                street: resolved.street,
                city: resolved.city || prev.city,
                state: resolved.state || prev.state,
                zip_code: resolved.zip_code || prev.zip_code,
              }))
            }
            placeholder="123 Main St"
            error={fieldErrors.street}
          />
          <Input
            label="Ciudad"
            value={addr.city}
            onChangeText={(v) => setAddr({ ...addr, city: v })}
            error={fieldErrors.city}
          />
          <Input
            label="Estado"
            value={addr.state}
            onChangeText={(v) => setAddr({ ...addr, state: v })}
            error={fieldErrors.state}
          />
          <Input
            label="Código postal"
            value={addr.zip_code}
            onChangeText={(v) => setAddr({ ...addr, zip_code: v })}
            keyboardType="number-pad"
            error={fieldErrors.zip}
          />
          <Input
            label="Mes desde (1-12)"
            value={addr.residence_since_month}
            onChangeText={(v) => setAddr({ ...addr, residence_since_month: v })}
            keyboardType="number-pad"
            error={fieldErrors.month}
          />
          <Input
            label="Año desde"
            value={addr.residence_since_year}
            onChangeText={(v) => setAddr({ ...addr, residence_since_year: v })}
            keyboardType="number-pad"
            error={fieldErrors.year}
          />
        </Section>

        <Section title="Vehículo principal">
          <Input
            label="Modelo"
            value={vehicle.model}
            onChangeText={(v) => setVehicle({ ...vehicle, model: v })}
            error={fieldErrors.model}
          />
          <Input
            label="Año"
            value={vehicle.year}
            onChangeText={(v) => setVehicle({ ...vehicle, year: v })}
            keyboardType="number-pad"
            error={fieldErrors.vehicleYear}
          />
          <Input
            label="Color"
            value={vehicle.color}
            onChangeText={(v) => setVehicle({ ...vehicle, color: v })}
            error={fieldErrors.color}
          />
        </Section>

        <Button
          title={saving ? "Guardando…" : "Guardar datos"}
          loading={saving}
          fullWidth
          onPress={onSave}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 14,
    color: colors.soft,
    lineHeight: 20,
  },
  ssnBox: {
    backgroundColor: colors.creamSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 4,
  },
  ssnLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.soft,
  },
  ssnValue: {
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.ink,
  },
  hint: {
    fontSize: 12,
    color: colors.soft,
  },
  success: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
});
