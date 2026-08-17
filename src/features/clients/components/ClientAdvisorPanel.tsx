import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useTranslation } from "@/contexts/LanguageContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { colors, radii } from "@/theme/tokens";
import type { AdvisorBrief } from "@/types/api";

const STATUSES_REQUIRING_ADVISOR = new Set([
  "LISTO_PARA_TRABAJAR",
  "ONBOARDING_EN_PROGRESO",
  "ONBOARDING_COMPLETADO",
]);

type ClientAdvisorPanelProps = {
  clientId: number;
  clientStatus: string;
  advisorsAssigned: AdvisorBrief[];
  token: string;
  advisors: AdvisorBrief[];
  onAdvisorsUpdated: (advisors: AdvisorBrief[]) => void;
  onLoadAdvisors: () => Promise<void>;
};

export function ClientAdvisorPanel({
  clientId,
  clientStatus,
  advisorsAssigned,
  token,
  advisors,
  onAdvisorsUpdated,
  onLoadAdvisors,
}: ClientAdvisorPanelProps) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAdvisors, setLoadingAdvisors] = useState(false);

  const requiresAdvisor = STATUSES_REQUIRING_ADVISOR.has(clientStatus);
  const canRemoveAdvisor = (count: number) =>
    count > 1 || (count === 1 && !requiresAdvisor);

  const assignedIds = useMemo(
    () => new Set(advisorsAssigned.map((item) => item.id)),
    [advisorsAssigned],
  );
  const availableAdvisors = useMemo(
    () => advisors.filter((item) => !assignedIds.has(item.id)),
    [advisors, assignedIds],
  );

  async function startAdding() {
    setError(null);
    setAdding(true);
    if (!advisors.length) {
      setLoadingAdvisors(true);
      try {
        await onLoadAdvisors();
      } finally {
        setLoadingAdvisors(false);
      }
    }
  }

  async function handleAdd() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const added = await api.post<AdvisorBrief>(
        `/clients/${clientId}/advisors`,
        { advisor_user_id: Number(selectedId) },
        token,
      );
      const next = advisorsAssigned.some((item) => item.id === added.id)
        ? advisorsAssigned
        : [...advisorsAssigned, added];
      onAdvisorsUpdated(next);
      setAdding(false);
      setSelectedId("");
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("common.error")));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(advisorUserId: number) {
    setRemovingId(advisorUserId);
    setError(null);
    try {
      await api.delete(`/clients/${clientId}/advisors/${advisorUserId}`, token);
      onAdvisorsUpdated(
        advisorsAssigned.filter((item) => item.id !== advisorUserId),
      );
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("common.error")));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card>
      <Text style={styles.title}>{t("clientDetail.assignedAdvisors")}</Text>
      <Text style={styles.hint}>{t("clientDetail.assignedAdvisorsHint")}</Text>
      {advisorsAssigned.length === 0 ? (
        <Text style={styles.muted}>{t("clientDetail.advisorAutoAssignHint")}</Text>
      ) : null}

      {advisorsAssigned.length === 0 ? (
        <Text style={styles.row}>{t("clientDetail.noAdvisorAssigned")}</Text>
      ) : (
        advisorsAssigned.map((advisor) => (
          <View key={advisor.id} style={styles.advisorRow}>
            <View style={styles.advisorMeta}>
              <Text style={styles.optionName}>
                {advisor.first_name} {advisor.last_name}
              </Text>
              <Text style={styles.muted}>{advisor.email}</Text>
            </View>
            {canRemoveAdvisor(advisorsAssigned.length) ? (
              <Button
                title={t("clientDetail.removeAdvisor")}
                variant="danger"
                disabled={removingId === advisor.id || saving}
                loading={removingId === advisor.id}
                onPress={() => void handleRemove(advisor.id)}
              />
            ) : null}
          </View>
        ))
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {adding ? (
        <View style={styles.addBox}>
          {availableAdvisors.length > 0 ? (
            <Select
              label={t("clientDetail.selectAdvisor")}
              value={selectedId}
              onChange={setSelectedId}
              options={availableAdvisors.map((item) => ({
                value: String(item.id),
                label: `${item.first_name} ${item.last_name}`,
                hint: item.email,
              }))}
              placeholder={t("clientDetail.selectAdvisor")}
              disabled={saving || loadingAdvisors}
            />
          ) : (
            <Text style={styles.muted}>{t("clientDetail.noMoreAdvisors")}</Text>
          )}
          <Button
            title={saving ? t("common.loading") : t("clientDetail.addAdvisor")}
            fullWidth
            loading={saving}
            disabled={saving || !selectedId}
            onPress={() => void handleAdd()}
          />
          <Button
            title={t("common.cancel")}
            variant="ghost"
            fullWidth
            disabled={saving}
            onPress={() => {
              setAdding(false);
              setSelectedId("");
              setError(null);
            }}
          />
        </View>
      ) : (
        <Pressable
          style={styles.addBtn}
          onPress={() => void startAdding()}
          disabled={loadingAdvisors}
        >
          <Text style={styles.addBtnText}>{t("clientDetail.addAdvisor")}</Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.brownMuted,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.soft,
    marginTop: 4,
  },
  muted: {
    fontSize: 13,
    color: colors.soft,
    marginTop: 6,
  },
  row: {
    fontSize: 14,
    color: colors.ink,
    marginTop: 8,
  },
  advisorRow: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    backgroundColor: colors.creamSoft,
    gap: 8,
  },
  advisorMeta: {
    gap: 2,
  },
  optionName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    color: colors.danger,
  },
  addBox: {
    marginTop: 12,
    gap: 10,
  },
  addBtn: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 10,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brand,
  },
});
