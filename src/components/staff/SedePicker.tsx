import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Select, type SelectOption } from "@/components/ui/Select";
import { useTranslation } from "@/contexts/LanguageContext";
import type { Sede } from "@/types/api";

type SedePickerProps = {
  sedes: Sede[];
  value: number | null;
  onChange: (sedeId: number | null) => void;
  allowAll?: boolean;
  label?: string;
  disabled?: boolean;
};

export function SedePicker({
  sedes,
  value,
  onChange,
  allowAll = true,
  label,
  disabled,
}: SedePickerProps) {
  const { t } = useTranslation();

  const options = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = allowAll
      ? [{ value: "", label: t("scope.allSedes") }]
      : [];
    for (const sede of sedes) {
      if (!sede.is_active && value !== sede.id) continue;
      list.push({
        value: String(sede.id),
        label: sede.name,
        hint: sede.code,
      });
    }
    return list;
  }, [sedes, allowAll, value, t]);

  return (
    <View style={styles.wrap}>
      <Select
        label={label ?? t("scope.sede")}
        value={value != null ? String(value) : ""}
        options={options}
        onChange={(next) => onChange(next ? Number(next) : null)}
        placeholder={t("scope.selectSede")}
        sheetTitle={t("scope.sede")}
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
