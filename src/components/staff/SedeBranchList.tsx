import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState } from "@/components/ui/EmptyState";
import { useTranslation } from "@/contexts/LanguageContext";
import type { SedeBranchCard } from "@/features/sedes/utils/sedeBranches";
import { colors, spacing } from "@/theme/tokens";

type SedeBranchListProps = {
  branches: SedeBranchCard[];
  onSelect: (id: number) => void;
  titleKey?: string;
  hintKey?: string;
  emptyKey?: string;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function SedeBranchList({
  branches,
  onSelect,
  titleKey = "scope.adminSedesTitle",
  hintKey = "scope.adminSedesHint",
  emptyKey = "scope.adminSedesEmpty",
}: SedeBranchListProps) {
  const { t } = useTranslation();

  if (branches.length === 0) {
    return <EmptyState title={t(emptyKey)} />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{t(titleKey)}</Text>
      <Text style={styles.hint}>{t(hintKey)}</Text>

      <View style={styles.list}>
        {branches.map((branch) => (
          <View key={branch.id} style={styles.cardShadow}>
            {/* El borde vive acá (sin overflow:hidden) para que no se recorte. */}
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelect(branch.id)}
              style={({ pressed }) => [styles.cardBorder, pressed && styles.cardPressed]}
            >
              <View style={styles.cardInner}>
                <View style={styles.cover}>
                  {branch.avatarUrl ? (
                    <Image source={{ uri: branch.avatarUrl }} style={styles.coverImg} />
                  ) : (
                    <View style={styles.coverFallback}>
                      <Text style={styles.initials}>{initialsFor(branch.name)}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <View style={styles.titleText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {branch.name}
                      </Text>
                      {branch.description ? (
                        <Text style={styles.description} numberOfLines={1}>
                          {branch.description}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.brownMuted} />
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  heading: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.soft,
  },
  hint: {
    fontSize: 14,
    color: colors.soft,
    marginTop: -4,
  },
  list: {
    gap: spacing.md,
  },
  cardShadow: {
    borderRadius: 12,
    shadowColor: "#5c4033",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
    backgroundColor: "transparent",
  },
  cardBorder: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.brownSoft,
  },
  cardPressed: {
    opacity: 0.96,
    borderColor: colors.brand,
  },
  cardInner: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.white,
  },
  cover: {
    height: 96,
    backgroundColor: colors.creamWarm,
  },
  coverImg: {
    width: "100%",
    height: "100%",
  },
  coverFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandLight,
  },
  initials: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.brand,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  titleText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  description: {
    fontSize: 12,
    color: colors.soft,
  },
});
