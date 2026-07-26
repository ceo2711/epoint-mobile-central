import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DesertBackground } from "@/features/auth/DesertBackground";

type AuthGlassShellProps = {
  children: ReactNode;
  topLeftContent?: ReactNode;
  /** Extra top padding inside the glass card. */
  cardPaddingTop?: number;
};

export function AuthGlassShell({
  children,
  topLeftContent,
  cardPaddingTop = 28,
}: AuthGlassShellProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <DesertBackground />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 12}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 12) + 24,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {topLeftContent ? (
            <View style={styles.brandSlot}>{topLeftContent}</View>
          ) : null}

          <View style={styles.cardSlot}>
            <View style={styles.cardOuter}>
              <BlurView intensity={6} tint="light" style={StyleSheet.absoluteFill} />
              <View style={[styles.cardInner, { paddingTop: cardPaddingTop }]}>
                {children}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1a1008",
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  brandSlot: {
    alignSelf: "flex-start",
    marginBottom: 12,
    marginLeft: 4,
  },
  cardSlot: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 8,
  },
  cardOuter: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(240, 234, 218, 0.28)",
    backgroundColor: "rgba(249, 247, 242, 0.22)",
  },
  cardInner: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
});
