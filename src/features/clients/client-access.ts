import type { Client, User } from "@/types/api";

const SALES_REP_EDITABLE_STATUSES = ["PENDIENTE_DE_REVISION", "RECHAZADO"] as const;

export function canViewClientOnboardingWorkspace(
  user: Pick<User, "id" | "role"> | null | undefined,
): boolean {
  if (!user) return false;
  const role = user.role.code;
  return role === "ADMIN" || role === "ONBOARDING_MANAGER" || role === "ADVISOR";
}

export function canViewApprovedClientWorkspace(
  user: Pick<User, "id" | "role"> | null | undefined,
  client: Pick<Client, "approved_at"> | null | undefined,
): boolean {
  return canViewClientOnboardingWorkspace(user) && Boolean(client?.approved_at);
}

export function canEditClientProfile(
  user: Pick<User, "role"> | null | undefined,
  client: Pick<Client, "status"> | null | undefined,
  hasUpdatePermission: boolean,
): boolean {
  if (!hasUpdatePermission || !client || !user) return false;
  const role = user.role.code;
  if (role === "ONBOARDING_MANAGER" || role === "ADMIN") return true;
  return SALES_REP_EDITABLE_STATUSES.includes(
    client.status as (typeof SALES_REP_EDITABLE_STATUSES)[number],
  );
}

export function canManageClientAdvisor(
  user: Pick<User, "role"> | null | undefined,
  client: Pick<Client, "approved_at"> | null | undefined,
  hasApprovePermission: boolean,
): boolean {
  if (!user || !client?.approved_at || !hasApprovePermission) return false;
  return user.role.code === "ONBOARDING_MANAGER";
}

export function canContactClientAdvisor(
  user: Pick<User, "role"> | null | undefined,
  client: Pick<Client, "advisor"> | null | undefined,
): boolean {
  if (!user || !client?.advisor) return false;
  const role = user.role.code;
  return role === "ADMIN" || role === "SALES_REP";
}
