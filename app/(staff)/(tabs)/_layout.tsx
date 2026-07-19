import { Redirect, Stack } from "expo-router";

import { AppShell } from "@/components/shell/AppShell";
import { ScreenState } from "@/components/ui/ScreenState";
import { useAuth } from "@/features/auth/AuthContext";
import { colors } from "@/theme/tokens";

export default function StaffTabsLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <ScreenState loading />;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <AppShell
      homeHref="/(staff)/(tabs)/dashboard"
      accountHref="/(staff)/(tabs)/cuenta"
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
