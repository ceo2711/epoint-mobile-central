import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Select, type SelectOption } from "@/components/ui/Select";
import { useTranslation } from "@/contexts/LanguageContext";
import type { CalendlySalesRep } from "@/types/api";

type SalesRepPickerProps = {
  reps: CalendlySalesRep[];
  value: number | null;
  onChange: (salesRepId: number | null) => void;
  allowAll?: boolean;
  label?: string;
  disabled?: boolean;
};

export function SalesRepPicker({
  reps,
  value,
  onChange,
  allowAll = true,
  label,
  disabled,
}: SalesRepPickerProps) {
  const { t } = useTranslation();

  const options = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = allowAll
      ? [{ value: "", label: t("scope.allReps") }]
      : [];
    for (const rep of reps) {
      list.push({
        value: String(rep.id),
        label: `${rep.first_name} ${rep.last_name}`.trim(),
        hint: rep.email,
      });
    }
    return list;
  }, [reps, allowAll, t]);

  return (
    <View style={styles.wrap}>
      <Select
        label={label ?? t("scope.salesRep")}
        value={value != null ? String(value) : ""}
        options={options}
        onChange={(next) => onChange(next ? Number(next) : null)}
        placeholder={t("scope.selectRep")}
        sheetTitle={t("scope.salesRep")}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
  },
});
