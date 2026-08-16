import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/contexts/LanguageContext";
import type { SalesToolsScope } from "@/hooks/useSalesToolsScope";
import { colors, radii } from "@/theme/tokens";

export function SalesToolsScopeToggle({
  value,
  onChange,
}: {
  value: SalesToolsScope;
  onChange: (value: SalesToolsScope) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === "own" }}
        onPress={() => onChange("own")}
        style={[styles.tab, value === "own" && styles.tabActive]}
      >
        <Text style={[styles.label, value === "own" && styles.labelActive]}>
          {t("common.myTools")}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === "team" }}
        onPress={() => onChange("team")}
        style={[styles.tab, value === "team" && styles.tabActive]}
      >
        <Text style={[styles.label, value === "team" && styles.labelActive]}>
          {t("common.teamTools")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: colors.creamWarm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 4,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    paddingHorizontal: 12,
  },
  tabActive: {
    backgroundColor: colors.brand,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.brown,
  },
  labelActive: {
    color: colors.white,
  },
});
