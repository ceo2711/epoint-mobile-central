import { StyleSheet, Text, View, type ViewProps } from "react-native";

import { colors, radii } from "@/theme/tokens";

interface CardProps extends ViewProps {
  title?: string;
}

export function Card({ title, children, style, ...rest }: CardProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.creamSoft,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.brown,
    marginBottom: 4,
  },
});
