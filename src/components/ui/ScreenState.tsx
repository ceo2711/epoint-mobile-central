import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/tokens";

interface ScreenStateProps {
  loading?: boolean;
  message?: string;
}

export function ScreenState({ loading, message }: ScreenStateProps) {
  return (
    <View style={styles.wrap}>
      {loading ? <ActivityIndicator size="large" color={colors.brand} /> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: colors.cream,
  },
  message: {
    textAlign: "center",
    color: colors.soft,
    fontSize: 15,
  },
});
