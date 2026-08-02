import type { Client, User } from "@/types/api";

const SALES_REP_EDITABLE_STATUSES = ["PENDIENTE_DE_REVISION", "RECHAZADO"] as const;

function isOnboardingAreaLeader(user: Pick<User, "role" | "area"> | null | undefined): boolean {
  return user?.role.code === "AREA_LEADER" && user.area?.code === "ONBOARDING";
}

function canManageOnboarding(user: Pick<User, "role" | "area"> | null | undefined): boolean {
  if (!user) return false;
  const role = user.role.code;
  return role === "ADMIN" || role === "BRANCH_MANAGER" || isOnboardingAreaLeader(user);
}

export function canViewClientOnboardingWorkspace(
  user: Pick<User, "id" | "role" | "area"> | null | undefined,
): boolean {
  if (!user) return false;
  return canManageOnboarding(user) || user.role.code === "ADVISOR";
}

export function canViewApprovedClientWorkspace(
  user: Pick<User, "id" | "role" | "area"> | null | undefined,
  client: Pick<Client, "approved_at"> | null | undefined,
): boolean {
  return canViewClientOnboardingWorkspace(user) && Boolean(client?.approved_at);
}

export function canEditClientProfile(
  user: Pick<User, "role" | "area"> | null | undefined,
  client: Pick<Client, "status"> | null | undefined,
  hasUpdatePermission: boolean,
): boolean {
  if (!hasUpdatePermission || !client || !user) return false;
  if (canManageOnboarding(user)) {
    return true;
  }
  return SALES_REP_EDITABLE_STATUSES.includes(
    client.status as (typeof SALES_REP_EDITABLE_STATUSES)[number],
  );
}

export function canManageClientAdvisor(
  user: Pick<User, "role" | "area"> | null | undefined,
  client: Pick<Client, "approved_at"> | null | undefined,
  hasApprovePermission: boolean,
): boolean {
  if (!user || !client?.approved_at) return false;
  if (canManageOnboarding(user) && hasApprovePermission) return true;
  return false;
}

export function canContactClientAdvisor(
  user: Pick<User, "role"> | null | undefined,
  client: Pick<Client, "advisor"> | null | undefined,
): boolean {
  if (!user || !client?.advisor) return false;
  const role = user.role.code;
  return role === "ADMIN" || role === "SALES_REP" || role === "SUB_SELLER";
}
