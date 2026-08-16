import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ScreenState } from "@/components/ui/ScreenState";
import { Select, type SelectOption } from "@/components/ui/Select";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import {
  AREA_REQUIRED_ROLE_CODES,
  isGlobalAdmin,
  isSalesAreaLeader,
  SEDE_REQUIRED_ROLE_CODES,
} from "@/lib/roles";
import { fetchSedes } from "@/lib/staffScope";
import { SalesLeaderVendorsScreen } from "@/features/users/SalesLeaderVendorsScreen";
import type { Area, Paginated, Role, Sede, User } from "@/types/api";
import { colors, radii, spacing } from "@/theme/tokens";

const PAGE_SIZE = 50;

const HIDDEN_FILTER_ROLE_CODES = new Set([
  "ADMIN",
  "BRANCH_MANAGER",
  "CLIENT",
  "ONBOARDING_MANAGER",
]);

type UserFormState = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  role_id: string;
  area_id: string;
  sede_id: string;
  is_active: boolean;
};

const EMPTY_FORM: UserFormState = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  phone: "",
  role_id: "",
  area_id: "",
  sede_id: "",
  is_active: true,
};

function userToForm(user: User): UserFormState {
  return {
    email: user.email,
    password: "",
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone ?? "",
    role_id: String(user.role.id),
    area_id: user.area ? String(user.area.id) : "",
    sede_id: user.sede_id != null ? String(user.sede_id) : "",
    is_active: user.is_active,
  };
}

function isSedeRequired(roleCode: string | undefined): boolean {
  return (
    !!roleCode &&
    SEDE_REQUIRED_ROLE_CODES.includes(
      roleCode as (typeof SEDE_REQUIRED_ROLE_CODES)[number],
    )
  );
}

function isAreaRequired(roleCode: string | undefined): boolean {
  return (
    !!roleCode &&
    AREA_REQUIRED_ROLE_CODES.includes(
      roleCode as (typeof AREA_REQUIRED_ROLE_CODES)[number],
    )
  );
}

export default function UsuariosScreen() {
  const { t } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return <ScreenState loading message={`${t("users.title")}…`} />;
  }
  if (isSalesAreaLeader(user)) {
    return <SalesLeaderVendorsScreen />;
  }
  return <UsersDirectoryScreen />;
}

function UsersDirectoryScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token, user: currentUser, hasPermission, isLoading: authLoading } =
    useAuth();

  const canCreate = hasPermission("users:create");
  const canUpdate = hasPermission("users:update");
  const isBranchManager = currentUser?.role.code === "BRANCH_MANAGER";
  const showSedeSelect = isGlobalAdmin(currentUser?.role.code);

  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sedeFilter, setSedeFilter] = useState("");

  const [roles, setRoles] = useState<Role[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);

  const isEdit = editingUser != null;

  const assignableRoles = useMemo(() => {
    const allowCurrentSubSeller = Boolean(
      editingUser && editingUser.role.code === "SUB_SELLER",
    );
    const base = isBranchManager
      ? roles.filter(
          (r) => isSedeRequired(r.code) && r.code !== "BRANCH_MANAGER",
        )
      : roles;
    return base.filter((r) => {
      if (r.code === "CLIENT") return false;
      if (r.code === "ONBOARDING_MANAGER") return false;
      if (r.code === "SUB_SELLER") return allowCurrentSubSeller;
      return r.is_active !== false;
    });
  }, [roles, isBranchManager, editingUser]);

  const selectedRole = useMemo(
    () => assignableRoles.find((r) => String(r.id) === form.role_id),
    [assignableRoles, form.role_id],
  );

  const sedeRequired = isSedeRequired(selectedRole?.code);
  const areaRequired = isAreaRequired(selectedRole?.code);

  const roleFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: t("users.allRoles") },
      ...roles
        .filter(
          (r) =>
            r.is_active !== false && !HIDDEN_FILTER_ROLE_CODES.has(r.code),
        )
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => ({ value: String(r.id), label: r.name })),
    ],
    [roles, t],
  );

  const sedeFilterOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: t("users.allSedes") },
      ...sedes
        .filter((s) => s.is_active)
        .map((s) => ({ value: String(s.id), label: s.name })),
    ],
    [sedes, t],
  );

  const roleFormOptions: SelectOption[] = useMemo(() => {
    const opts = assignableRoles.map((r) => ({
      value: String(r.id),
      label: r.name,
    }));
    if (
      editingUser &&
      !opts.some((o) => o.value === String(editingUser.role.id))
    ) {
      opts.unshift({
        value: String(editingUser.role.id),
        label: editingUser.role.name,
      });
    }
    return [{ value: "", label: t("users.selectRole") }, ...opts];
  }, [assignableRoles, editingUser, t]);

  const areaFormOptions: SelectOption[] = useMemo(() => {
    const active = areas.filter((a) => a.is_active);
    const list = [...active];
    const currentId = editingUser?.area?.id;
    if (currentId != null && !list.some((a) => a.id === currentId)) {
      const found = areas.find((a) => a.id === currentId);
      if (found) list.push(found);
      else if (editingUser?.area) {
        list.push({
          id: editingUser.area.id,
          code: editingUser.area.code,
          name: editingUser.area.name,
          description: null,
          is_active: false,
          created_at: "",
        });
      }
    }
    return [
      {
        value: "",
        label: areaRequired ? t("users.selectArea") : t("users.noArea"),
      },
      ...list.map((a) => ({ value: String(a.id), label: a.name })),
    ];
  }, [areas, areaRequired, editingUser, t]);

  const sedeFormOptions: SelectOption[] = useMemo(() => {
    const active = sedes.filter((s) => s.is_active);
    const list = [...active];
    const currentId = editingUser?.sede_id ?? editingUser?.sede?.id;
    if (currentId != null && !list.some((s) => s.id === currentId)) {
      const found = sedes.find((s) => s.id === currentId);
      if (found) list.push(found);
      else if (editingUser?.sede) {
        list.push({
          id: editingUser.sede.id,
          code: editingUser.sede.code,
          name: editingUser.sede.name,
          description: null,
          is_active: false,
          created_at: "",
        });
      }
    }
    return [
      { value: "", label: t("users.selectSede") },
      ...list.map((s) => ({ value: String(s.id), label: s.name })),
    ];
  }, [sedes, editingUser, t]);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, sedeFilter]);

  const loadOptions = useCallback(async () => {
    if (!token) return;
    const [rolesRes, areasRes, sedesRes] = await Promise.allSettled([
      api.get<Role[]>("/roles?include_inactive=true", token),
      api.get<Area[]>("/areas?include_inactive=true", token),
      showSedeSelect
        ? fetchSedes(token, { includeInactive: true })
        : Promise.resolve([] as Sede[]),
    ]);
    if (rolesRes.status === "fulfilled") setRoles(rolesRes.value);
    if (areasRes.status === "fulfilled") setAreas(areasRes.value);
    if (sedesRes.status === "fulfilled") setSedes(sedesRes.value);
  }, [token, showSedeSelect]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          page_size: String(PAGE_SIZE),
        });
        if (query) params.set("search", query);
        if (roleFilter) params.set("role_id", roleFilter);
        if (showSedeSelect && sedeFilter) params.set("sede_id", sedeFilter);

        const data = await api.get<Paginated<User>>(
          `/users?${params.toString()}`,
          token,
        );
        setItems(data.items);
        setTotal(data.total);
        setPages(Math.max(1, data.pages));
      } catch (err) {
        setError(getUserFacingErrorMessage(err, t("users.loadError")));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, page, query, roleFilter, sedeFilter, showSedeSelect, t],
  );

  useEffect(() => {
    if (!authLoading && token) {
      void loadOptions();
      void load();
    }
  }, [authLoading, token, load, loadOptions]);

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setForm(userToForm(user));
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting || togglingActive) return;
    setModalOpen(false);
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function buildPayload(includePassword: boolean): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      email: form.email.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim() || null,
      role_id: Number(form.role_id),
      area_id: form.area_id ? Number(form.area_id) : null,
    };

    if (showSedeSelect) {
      payload.sede_id =
        sedeRequired && form.sede_id ? Number(form.sede_id) : null;
    }

    if (includePassword && form.password.trim()) {
      payload.password = form.password;
    }

    return payload;
  }

  async function handleSubmit() {
    if (!token) return;

    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setFormError(t("common.required"));
      return;
    }
    if (!form.role_id) {
      setFormError(t("users.selectRole"));
      return;
    }
    if (!isEdit) {
      if (!form.password.trim() || form.password.trim().length < 8) {
        setFormError(t("users.passwordRequired"));
        return;
      }
    } else if (form.password.trim() && form.password.trim().length < 8) {
      setFormError(t("users.passwordMin"));
      return;
    }
    if (areaRequired && !form.area_id) {
      setFormError(t("users.areaRequired"));
      return;
    }
    if (sedeRequired && showSedeSelect && !form.sede_id) {
      setFormError(t("users.selectSede"));
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (isEdit && editingUser) {
        const payload = buildPayload(true);
        payload.is_active = form.is_active;
        await api.patch(`/users/${editingUser.id}`, payload, token);
      } else {
        await api.post(
          "/users",
          {
            ...buildPayload(false),
            password: form.password,
          },
          token,
        );
      }
      setModalOpen(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
      await load({ silent: true });
    } catch (err) {
      setFormError(getUserFacingErrorMessage(err, t("users.saveError")));
    } finally {
      setSubmitting(false);
    }
  }

  function confirmToggleActive() {
    if (!editingUser || !token || !canUpdate) return;
    if (editingUser.id === currentUser?.id) return;

    const next = !editingUser.is_active;
    const name = `${editingUser.first_name} ${editingUser.last_name}`.trim();
    Alert.alert(
      next ? t("users.reactivate") : t("users.deactivate"),
      t(next ? "users.reactivateConfirm" : "users.deactivateConfirm", { name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: next ? t("users.reactivate") : t("users.deactivate"),
          style: next ? "default" : "destructive",
          onPress: () => void toggleActive(next),
        },
      ],
    );
  }

  async function toggleActive(next: boolean) {
    if (!editingUser || !token) return;
    setTogglingActive(true);
    setFormError(null);
    try {
      const updated = await api.patch<User>(
        `/users/${editingUser.id}`,
        { is_active: next },
        token,
      );
      setEditingUser(updated);
      setForm((prev) => ({ ...prev, is_active: updated.is_active }));
      await load({ silent: true });
    } catch (err) {
      setFormError(getUserFacingErrorMessage(err, t("users.saveError")));
    } finally {
      setTogglingActive(false);
    }
  }

  function onRoleChange(role_id: string) {
    const code = assignableRoles.find((r) => String(r.id) === role_id)?.code;
    setForm((f) => ({
      ...f,
      role_id,
      area_id: isAreaRequired(code) ? f.area_id : "",
      sede_id: isSedeRequired(code) ? f.sede_id : "",
    }));
  }

  if (authLoading || (loading && items.length === 0 && !error)) {
    return <ScreenState loading message={t("common.loading")} />;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t("users.title")}</Text>
          <Text style={styles.subtitle}>
            {t("users.count", { count: total })}
          </Text>
        </View>
        {canCreate ? (
          <Button
            title={t("users.create")}
            onPress={openCreate}
            style={styles.createBtn}
          />
        ) : null}
      </View>

      <Input
        value={search}
        onChangeText={setSearch}
        placeholder={t("users.search")}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={styles.search}
      />

      <View style={styles.filters}>
        <View style={styles.filterItem}>
          <Select
            label={t("users.filterRole")}
            value={roleFilter}
            options={roleFilterOptions}
            onChange={setRoleFilter}
            placeholder={t("users.allRoles")}
            sheetTitle={t("users.filterRole")}
          />
        </View>
        {showSedeSelect ? (
          <View style={styles.filterItem}>
            <Select
              label={t("users.filterSede")}
              value={sedeFilter}
              options={sedeFilterOptions}
              onChange={setSedeFilter}
              placeholder={t("users.allSedes")}
              sheetTitle={t("users.filterSede")}
            />
          </View>
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
              void loadOptions();
              void load({ silent: true });
            }}
          />
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>{t("users.empty")}</Text> : null
        }
        ListFooterComponent={
          items.length > 0 && pages > 1 ? (
            <View style={styles.pagination}>
              <Button
                title={t("common.previous")}
                variant="secondary"
                disabled={page <= 1 || loading}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                style={styles.pageBtn}
              />
              <Text style={styles.pageLabel}>
                {t("common.pageOf", { page, pages })}
              </Text>
              <Button
                title={t("common.next")}
                variant="secondary"
                disabled={page >= pages || loading}
                onPress={() => setPage((p) => Math.min(pages, p + 1))}
                style={styles.pageBtn}
              />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openEdit(item)}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Card style={styles.item}>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.first_name} {item.last_name}
                </Text>
                <View
                  style={[
                    styles.badge,
                    !item.is_active && styles.badgeInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      !item.is_active && styles.badgeTextInactive,
                    ]}
                  >
                    {item.is_active
                      ? t("common.active")
                      : t("common.inactive")}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>{item.email}</Text>
              <Text style={styles.role}>{item.role.name}</Text>
              {item.area ? (
                <Text style={styles.meta}>
                  {t("users.area")}: {item.area.name}
                </Text>
              ) : null}
              {item.sede?.name ? (
                <Text style={styles.meta}>
                  {t("users.sede")}: {item.sede.name}
                </Text>
              ) : null}
            </Card>
          </Pressable>
        )}
      />

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScroll}
            >
              <Text style={styles.modalTitle}>
                {isEdit ? t("users.edit") : t("users.create")}
              </Text>

              <Input
                label={t("common.firstName")}
                value={form.first_name}
                onChangeText={(first_name) =>
                  setForm((f) => ({ ...f, first_name }))
                }
                autoCapitalize="words"
                editable={!submitting}
              />
              <Input
                label={t("common.lastName")}
                value={form.last_name}
                onChangeText={(last_name) =>
                  setForm((f) => ({ ...f, last_name }))
                }
                autoCapitalize="words"
                editable={!submitting}
              />
              <Input
                label={t("common.email")}
                value={form.email}
                onChangeText={(email) => setForm((f) => ({ ...f, email }))}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />
              <Input
                label={t("common.phone")}
                value={form.phone}
                onChangeText={(phone) => setForm((f) => ({ ...f, phone }))}
                keyboardType="phone-pad"
                editable={!submitting}
              />
              <Input
                label={t("users.password")}
                value={form.password}
                onChangeText={(password) =>
                  setForm((f) => ({ ...f, password }))
                }
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={
                  isEdit ? t("users.passwordKeepCurrent") : undefined
                }
                editable={!submitting}
              />
              {isEdit ? (
                <Text style={styles.hint}>{t("users.passwordHint")}</Text>
              ) : null}

              <Select
                label={t("common.role")}
                value={form.role_id}
                options={roleFormOptions}
                onChange={onRoleChange}
                placeholder={t("users.selectRole")}
                sheetTitle={t("common.role")}
                disabled={submitting}
              />

              {areaRequired ? (
                <Select
                  label={t("users.area")}
                  value={form.area_id}
                  options={areaFormOptions}
                  onChange={(area_id) => setForm((f) => ({ ...f, area_id }))}
                  placeholder={t("users.selectArea")}
                  sheetTitle={t("users.area")}
                  disabled={submitting}
                />
              ) : null}

              {showSedeSelect && sedeRequired ? (
                <Select
                  label={t("users.sede")}
                  value={form.sede_id}
                  options={sedeFormOptions}
                  onChange={(sede_id) => setForm((f) => ({ ...f, sede_id }))}
                  placeholder={t("users.selectSede")}
                  sheetTitle={t("users.sede")}
                  disabled={submitting}
                />
              ) : null}

              {formError ? <Text style={styles.error}>{formError}</Text> : null}

              <View style={styles.modalActions}>
                <Button
                  title={t("common.cancel")}
                  variant="secondary"
                  disabled={submitting || togglingActive}
                  onPress={closeModal}
                  style={styles.modalActionBtn}
                />
                {(isEdit ? canUpdate : canCreate) ? (
                  <Button
                    title={submitting ? t("common.saving") : t("common.save")}
                    loading={submitting}
                    disabled={togglingActive}
                    onPress={() => void handleSubmit()}
                    style={styles.modalActionBtn}
                  />
                ) : null}
              </View>

              {isEdit &&
              canUpdate &&
              editingUser &&
              editingUser.id !== currentUser?.id ? (
                <Button
                  title={
                    editingUser.is_active
                      ? t("users.deactivate")
                      : t("users.reactivate")
                  }
                  variant={editingUser.is_active ? "danger" : "secondary"}
                  loading={togglingActive}
                  disabled={submitting}
                  onPress={confirmToggleActive}
                  fullWidth
                  style={styles.toggleBtn}
                />
              ) : null}
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
  search: {
    marginBottom: spacing.sm,
  },
  filters: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexShrink: 0,
  },
  filterItem: {
    flex: 1,
    minWidth: 0,
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
  role: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.brownSoft,
  },
  empty: {
    textAlign: "center",
    color: colors.soft,
    marginTop: 40,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
    fontSize: 13,
  },
  hint: {
    fontSize: 12,
    color: colors.soft,
    marginTop: -4,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 16,
  },
  pageBtn: {
    flexShrink: 1,
    minWidth: 100,
  },
  pageLabel: {
    fontSize: 13,
    color: colors.soft,
    fontWeight: "600",
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
    maxHeight: "92%",
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
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalActionBtn: {
    flex: 1,
  },
  toggleBtn: {
    marginTop: 4,
  },
});
