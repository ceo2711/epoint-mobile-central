import { Stack } from "expo-router";

import { AppShell } from "@/components/shell/AppShell";
import { colors } from "@/theme/tokens";

export default function PortalTabsLayout() {
  return (
    <AppShell
      homeHref="/(portal)/(tabs)"
      accountHref="/(portal)/(tabs)/cuenta"
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.cream },
          animation: "slide_from_right",
        }}
      />
    </AppShell>
  );
}
