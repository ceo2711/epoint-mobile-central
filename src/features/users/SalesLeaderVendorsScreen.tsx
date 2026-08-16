import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SalesRepList } from "@/components/staff/SalesRepList";
import { ScopePageHeader } from "@/components/staff/ScopeBackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScreenState } from "@/components/ui/ScreenState";
import { Select } from "@/components/ui/Select";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { fetchCalendlySalesReps } from "@/lib/staffScope";
import type { CalendlySalesRep, User } from "@/types/api";
import { colors } from "@/theme/tokens";

export function SalesLeaderVendorsScreen() {
  const { t, locale } = useTranslation();
  const { token, isLoading: authLoading } = useAuth();
  const [reps, setReps] = useState<CalendlySalesRep[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<number | null>(null);
  const [detail, setDetail] = useState<User | null>(null);
  const [loadingReps, setLoadingReps] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [parents, setParents] = useState<User[]>([]);
  const [parentId, setParentId] = useState("");
  const [loadingParents, setLoadingParents] = useState(false);
  const [savingParent, setSavingParent] = useState(false);

  const selectedRep = useMemo(
    () => reps.find((rep) => rep.id === selectedRepId) ?? null,
    [reps, selectedRepId],
  );

  const loadReps = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const list = await fetchCalendlySalesReps(token);
      setReps(list);
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("users.loadError")));
    } finally {
      setLoadingReps(false);
      setRefreshing(false);
    }
  }, [token, t]);

  const loadDetail = useCallback(async () => {
    if (!token || selectedRepId == null) {
      setDetail(null);
      setLoadingDetail(false);
      return;
    }
    setLoadingDetail(true);
    setError(null);
    try {
      const user = await api.get<User>(`/users/${selectedRepId}`, token);
      setDetail(user);
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("users.loadError")));
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [token, selectedRepId, t]);

  useEffect(() => {
    if (!authLoading && token) void loadReps();
  }, [authLoading, token, loadReps]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const selectedName = selectedRep
    ? `${selectedRep.first_name} ${selectedRep.last_name}`.trim()
    : detail
      ? `${detail.first_name} ${detail.last_name}`.trim()
      : "";
  const isSub = Boolean(detail?.parent_user_id ?? selectedRep?.parent_user_id);
  const inactive = detail ? !detail.is_active : selectedRep?.is_active === false;
  const parentName = detail?.parent
    ? `${detail.parent.first_name} ${detail.parent.last_name}`.trim()
    : selectedRep?.parent_name ?? "";

  function confirmToggle() {
    if (!token || selectedRepId == null) return;
    Alert.alert(
      t(inactive ? "users.vendorActivate" : "users.vendorDeactivate"),
      t(inactive ? "users.vendorActivateConfirm" : "users.vendorDeactivateConfirm", {
        name: selectedName,
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t(inactive ? "users.vendorActivate" : "users.vendorDeactivate"),
          style: inactive ? "default" : "destructive",
          onPress: () => void handleToggle(),
        },
      ],
    );
  }

  async function handleToggle() {
    if (!token || selectedRepId == null) return;
    setToggling(true);
    setError(null);
    try {
      const updated = await api.patch<User>(
        `/users/${selectedRepId}/active`,
        { is_active: inactive },
        token,
      );
      setDetail(updated);
      await loadReps();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("users.vendorToggleError")));
    } finally {
      setToggling(false);
    }
  }

  async function openReassign() {
    if (!token) return;
    setReassignOpen(true);
    setLoadingParents(true);
    setError(null);
    try {
      const rows = await api.get<User[]>("/sub-sellers/reassign-parents", token);
      const currentParentId = detail?.parent_user_id ?? selectedRep?.parent_user_id;
      const options = rows.filter((parent) => parent.id !== currentParentId);
      setParents(options);
      setParentId(options[0] ? String(options[0].id) : "");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("subSellers.reassignLoadError")));
      setParents([]);
    } finally {
      setLoadingParents(false);
    }
  }

  async function handleReassign() {
    if (!token || selectedRepId == null || !parentId) return;
    setSavingParent(true);
    setError(null);
    try {
      await api.patch(
        `/sub-sellers/${selectedRepId}/parent`,
        { new_parent_user_id: Number(parentId) },
        token,
      );
      setReassignOpen(false);
      setSelectedRepId(null);
      await loadReps();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("subSellers.reassignError")));
    } finally {
      setSavingParent(false);
    }
  }

  if (authLoading || (loadingReps && reps.length === 0 && !error)) {
    return <ScreenState loading message={`${t("nav.salesReps")}…`} />;
  }

  if (selectedRepId != null && (selectedRep || detail)) {
    const lastLogin = detail?.last_login_at
      ? new Date(detail.last_login_at).toLocaleString(locale === "en" ? "en-US" : "es")
      : t("users.vendorNeverLogin");

    return (
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.brand}
            onRefresh={() => {
              setRefreshing(true);
              void loadDetail();
              void loadReps();
            }}
          />
        }
      >
        <ScopePageHeader
          title={selectedName || t("nav.salesReps")}
          backLabel={t("users.backToVendors")}
          onBack={() => {
            setSelectedRepId(null);
            setDetail(null);
            setReassignOpen(false);
          }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loadingDetail && !detail ? (
          <ScreenState loading message={t("common.loading")} />
        ) : (
          <Card>
            <View style={styles.profileHead}>
              <UserAvatar
                firstName={detail?.first_name ?? selectedRep?.first_name ?? ""}
                lastName={detail?.last_name ?? selectedRep?.last_name ?? ""}
                avatarUrl={detail?.avatar_url ?? selectedRep?.avatar_url}
                size={56}
              />
              <View style={styles.profileMeta}>
                <Text style={styles.profileName}>{selectedName}</Text>
                <Text style={styles.profileRole}>
                  {isSub ? t("subSellers.subSeller") : t("common.role")}
                  {detail?.role.name ? ` · ${detail.role.name}` : ""}
                </Text>
                <View style={[styles.statusPill, inactive ? styles.statusOff : styles.statusOn]}>
                  <Text style={inactive ? styles.statusOffText : styles.statusOnText}>
                    {inactive ? t("common.inactive") : t("common.active")}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.fieldLabel}>{t("common.email")}</Text>
            <Text style={styles.fieldValue}>{detail?.email ?? selectedRep?.email}</Text>
            <Text style={styles.fieldLabel}>{t("users.vendorPhone")}</Text>
            <Text style={styles.fieldValue}>{detail?.phone || t("common.dash")}</Text>
            {detail?.sede?.name ? (
              <>
                <Text style={styles.fieldLabel}>{t("users.filterSede")}</Text>
                <Text style={styles.fieldValue}>{detail.sede.name}</Text>
              </>
            ) : null}
            {isSub ? (
              <>
                <Text style={styles.fieldLabel}>{t("users.vendorParent")}</Text>
                <Text style={styles.fieldValue}>{parentName || t("common.dash")}</Text>
              </>
            ) : null}
            <Text style={styles.fieldLabel}>{t("users.vendorLastLogin")}</Text>
            <Text style={styles.fieldValue}>{lastLogin}</Text>
          </Card>
        )}

        <Button
          title={inactive ? t("users.vendorActivate") : t("users.vendorDeactivate")}
          variant={inactive ? "primary" : "danger"}
          loading={toggling}
          onPress={confirmToggle}
        />
        {isSub ? (
          <Button
            title={t("subSellers.reassignAction")}
            variant="secondary"
            onPress={() => void openReassign()}
          />
        ) : null}

        <Modal
          visible={reassignOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setReassignOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t("subSellers.reassignTitle")}</Text>
              <Text style={styles.subtitle}>{t("subSellers.reassignHint")}</Text>
              {loadingParents ? (
                <ScreenState loading message={t("common.loading")} />
              ) : parents.length === 0 ? (
                <Text style={styles.subtitle}>{t("subSellers.reassignNoParents")}</Text>
              ) : (
                <Select
                  label={t("subSellers.reassignParent")}
                  value={parentId}
                  onChange={setParentId}
                  options={parents.map((parent) => ({
                    value: String(parent.id),
                    label: `${parent.first_name} ${parent.last_name}`.trim(),
                  }))}
                />
              )}
              <View style={styles.modalActions}>
                <Button
                  title={t("common.cancel")}
                  variant="secondary"
                  onPress={() => setReassignOpen(false)}
                />
                <Button
                  title={t("subSellers.reassignConfirm")}
                  loading={savingParent}
                  disabled={!parentId || parents.length === 0}
                  onPress={() => void handleReassign()}
                />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.brand}
          onRefresh={() => {
            setRefreshing(true);
            void loadReps();
          }}
        />
      }
    >
      <ScopePageHeader title={t("nav.salesReps")} />
      <Text style={styles.subtitle}>{t("users.vendorsTeamSubtitle")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <SalesRepList
        reps={reps}
        onSelect={setSelectedRepId}
        titleKey="users.vendorsListTitle"
        hintKey="users.vendorsListHint"
        showConnectionStatus={false}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  subtitle: {
    fontSize: 13,
    color: colors.soft,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  profileHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  profileMeta: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brown,
  },
  profileRole: {
    fontSize: 13,
    color: colors.soft,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusOn: {
    backgroundColor: colors.brandLight,
  },
  statusOff: {
    backgroundColor: "#fde8e4",
  },
  statusOnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.brand,
  },
  statusOffText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.danger,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.soft,
    marginTop: 8,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brown,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
  },
});
