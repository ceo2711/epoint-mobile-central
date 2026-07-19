import { StyleSheet, Text, View, type ViewProps } from "react-native";

import { colors } from "@/theme/tokens";

interface SectionProps extends ViewProps {
  title: string;
}

export function Section({ title, children, style, ...rest }: SectionProps) {
  return (
    <View style={[styles.section, style]} {...rest}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.brownMuted,
  },
});
