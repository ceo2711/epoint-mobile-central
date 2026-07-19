import { Redirect } from "expo-router";

import { useAuth, mustForcePasswordChange } from "@/features/auth/AuthContext";
import { getDefaultAppPath } from "@/lib/appNavigation";
import { ScreenState } from "@/components/ui/ScreenState";

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <ScreenState loading message="Cargando sesión…" />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (mustForcePasswordChange(user)) {
    return <Redirect href="/(auth)/change-password" />;
  }

  return <Redirect href={getDefaultAppPath(user.role.code) as never} />;
}
