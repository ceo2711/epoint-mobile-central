import { Redirect, Stack } from "expo-router";

import { ScreenState } from "@/components/ui/ScreenState";
import { useAuth, mustForcePasswordChange } from "@/features/auth/AuthContext";
import { colors } from "@/theme/tokens";

export default function StaffLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <ScreenState loading />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (mustForcePasswordChange(user)) {
    return <Redirect href="/(auth)/change-password" />;
  }
  if (user.role.code === "CLIENT") {
    return <Redirect href="/(portal)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.cream },
      }}
    />
  );
}
