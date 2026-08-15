import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ScreenState } from "@/components/ui/ScreenState";
import { Select } from "@/components/ui/Select";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { fetchSedes } from "@/lib/staffScope";
import type { Merchant, Paginated, Sede } from "@/types/api";
import { colors, radii, spacing } from "@/theme/tokens";

const CODE_RE = /^[a-z0-9-]+$/;

type FormState = {
  code: string;
  name: string;
  description: string;
  sede_id: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  description: "",
  sede_id: "",
  is_active: true,
};

function unwrapList<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.items;
}

export default function ComerciosScreen() {
  const { t } = useTranslation();
  const { token, hasPermission, isLoading: authLoading } = useAuth();
  const canCreate = hasPermission("merchants:create");
  const canUpdate = hasPermission("merchants:update");

  const [items, setItems] = useState<Merchant[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Merchant | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sedeById = useMemo(() => {
    const map = new Map<number, Sede>();
    for (const sede of sedes) map.set(sede.id, sede);
    return map;
  }, [sedes]);

  const sedeOptions = useMemo(
    () => [
      { value: "", label: t("catalog.noSede") },
      ...sedes.map((sede) => ({
        value: String(sede.id),
        label: sede.name,
        hint: sede.code,
      })),
    ],
    [sedes, t],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const [merchantsData, sedesData] = await Promise.all([
          api.get<Merchant[] | Paginated<Merchant>>(
            "/merchants?include_inactive=true",
            token,
          ),
          fetchSedes(token, { includeInactive: true }),
        ]);
        setItems(unwrapList(merchantsData));
        setSedes(sedesData);
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("catalog.loadError")));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, t],
  );

  useEffect(() => {
    if (!authLoading && token) void load();
  }, [authLoading, token, load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(merchant: Merchant) {
    if (!canUpdate) return;
    setEditing(merchant);
    setForm({
      code: merchant.code,
      name: merchant.name,
      description: merchant.description ?? "",
      sede_id: merchant.sede_id != null ? String(merchant.sede_id) : "",
      is_active: merchant.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError(null);
  }

  async function handleSave() {
    if (!token) return;
    const name = form.name.trim();
    const code = form.code.trim().toLowerCase();
    const description = form.description.trim();
    const sedeId = form.sede_id ? Number(form.sede_id) : null;

    if (!name) {
      setFormError(t("common.required"));
      return;
    }
    if (!editing) {
      if (!code || !CODE_RE.test(code)) {
        setFormError(t("catalog.codeInvalid"));
        return;
      }
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await api.patch(
          `/merchants/${editing.id}`,
          {
            name,
            description: description || null,
            is_active: form.is_active,
            sede_id: sedeId,
          },
          token,
        );
      } else {
        await api.post(
          "/merchants",
          {
            code,
            name,
            description: description || null,
            ...(sedeId != null ? { sede_id: sedeId } : {}),
          },
          token,
        );
      }
      setModalOpen(false);
      setEditing(null);
      await load({ silent: true });
    } catch (err) {
      setFormError(getUserFacingErrorMessage(err, t("catalog.saveError")));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || (loading && items.length === 0 && !error)) {
    return <ScreenState loading message={t("common.loading")} />;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t("catalog.merchantsTitle")}</Text>
          <Text style={styles.subtitle}>
            {t("catalog.count", { count: items.length })}
          </Text>
        </View>
        {canCreate ? (
          <Button title={t("catalog.create")} onPress={openCreate} style={styles.createBtn} />
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.brand}
            onRefresh={() => {
              setRefreshing(true);
              void load({ silent: true });
            }}
          />
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>{t("catalog.empty")}</Text> : null
        }
        renderItem={({ item }) => {
          const sede =
            item.sede_id != null ? sedeById.get(item.sede_id) : undefined;
          return (
            <Pressable
              disabled={!canUpdate}
              onPress={() => openEdit(item)}
              style={({ pressed }) => [pressed && canUpdate && styles.pressed]}
            >
              <Card style={styles.item}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.name}</Text>
                  <View style={[styles.badge, !item.is_active && styles.badgeInactive]}>
                    <Text
                      style={[
                        styles.badgeText,
                        !item.is_active && styles.badgeTextInactive,
                      ]}
                    >
                      {item.is_active ? t("catalog.active") : t("catalog.inactive")}
                    </Text>
                  </View>
                </View>
                <Text style={styles.code}>{item.code}</Text>
                {sede ? (
                  <Text style={styles.meta}>
                    {t("catalog.sede")}: {sede.name}
                  </Text>
                ) : null}
                {item.description ? (
                  <Text style={styles.meta}>{item.description}</Text>
                ) : null}
              </Card>
            </Pressable>
          );
        }}
      />

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScroll}
            >
              <Text style={styles.modalTitle}>
                {editing ? t("catalog.edit") : t("catalog.create")}
              </Text>

              <Input
                label={t("catalog.code")}
                value={form.code}
                onChangeText={(code) =>
                  setForm((prev) => ({
                    ...prev,
                    code: code.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  }))
                }
                editable={!editing && !saving}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="epoint-lab"
              />
              <Text style={styles.hint}>{t("catalog.codeKebabHint")}</Text>

              <Input
                label={t("catalog.name")}
                value={form.name}
                onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
                editable={!saving}
                placeholder="Epoint Lab"
              />

              <Select
                label={t("catalog.sede")}
                value={form.sede_id}
                options={sedeOptions}
                onChange={(sede_id) => setForm((prev) => ({ ...prev, sede_id }))}
                placeholder={t("scope.selectSede")}
                sheetTitle={t("catalog.sede")}
                disabled={saving}
              />

              <Input
                label={t("catalog.description")}
                value={form.description}
                onChangeText={(description) =>
                  setForm((prev) => ({ ...prev, description }))
                }
                editable={!saving}
                multiline
                style={styles.textArea}
              />

              {editing ? (
                <Select
                  label={t("catalog.status")}
                  value={form.is_active ? "1" : "0"}
                  options={[
                    { value: "1", label: t("catalog.active") },
                    { value: "0", label: t("catalog.inactive") },
                  ]}
                  onChange={(v) =>
                    setForm((prev) => ({ ...prev, is_active: v === "1" }))
                  }
                  disabled={saving}
                />
              ) : null}

              {formError ? <Text style={styles.error}>{formError}</Text> : null}

              <View style={styles.modalActions}>
                <Button
                  title={t("common.cancel")}
                  variant="secondary"
                  disabled={saving}
                  onPress={closeModal}
                  style={styles.modalActionBtn}
                />
                <Button
                  title={t("catalog.save")}
                  loading={saving}
                  onPress={() => void handleSave()}
                  style={styles.modalActionBtn}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  createBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.brown,
  },
  subtitle: {
    fontSize: 13,
    color: colors.soft,
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  item: {
    backgroundColor: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  code: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.gold,
  },
  badge: {
    backgroundColor: colors.brandLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  badgeInactive: {
    backgroundColor: colors.creamWarm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.brand,
  },
  badgeTextInactive: {
    color: colors.soft,
  },
  meta: {
    fontSize: 13,
    color: colors.soft,
  },
  empty: {
    textAlign: "center",
    color: colors.soft,
    marginTop: 40,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: colors.soft,
    marginTop: -4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  modalScroll: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.brown,
    marginBottom: 4,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalActionBtn: {
    flex: 1,
  },
});
