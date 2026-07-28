import { Stack } from "expo-router";

import { AppShell } from "@/components/shell/AppShell";
import { PortalBoardUnlockProvider } from "@/features/portal/PortalBoardUnlockContext";
import { colors } from "@/theme/tokens";

export default function PortalTabsLayout() {
  return (
    <PortalBoardUnlockProvider>
      <AppShell
        homeHref="/(portal)/(tabs)"
        accountHref="/(portal)/(tabs)/cuenta"
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.cream },
            animation: "slide_from_right",
            gestureEnabled: true,
            // Solo borde izquierdo (no swipe desde el centro de la pantalla).
            fullScreenGestureEnabled: false,
            animationMatchesGesture: true,
          }}
        />
      </AppShell>
    </PortalBoardUnlockProvider>
  );
}
