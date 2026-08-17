import { canManageOnboarding, isAdvisor, isSedeAdmin } from "@/lib/roles";
import type { AdvisorBrief, Client, User } from "@/types/api";

const SALES_REP_EDITABLE_STATUSES = ["PENDIENTE_DE_REVISION", "RECHAZADO"] as const;

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

export function assignedAdvisorsOf(
  client: Pick<Client, "advisors" | "advisor"> | null | undefined,
): AdvisorBrief[] {
  if (!client) return [];
  if (client.advisors?.length) return client.advisors;
  return client.advisor ? [client.advisor] : [];
}

export function canManageClientAdvisor(
  user: Pick<User, "id" | "role" | "area"> | null | undefined,
  client: Pick<Client, "approved_at" | "advisors" | "advisor"> | null | undefined,
  hasApprovePermission: boolean,
): boolean {
  if (!user || !client?.approved_at) return false;
  if (canManageOnboarding(user) && hasApprovePermission) return true;
  if (!isAdvisor(user) || !user.id) return false;
  return assignedAdvisorsOf(client).some((item) => item.id === user.id);
}

export function canContactClientAdvisor(
  user: Pick<User, "role"> | null | undefined,
  client: Pick<Client, "advisors" | "advisor"> | null | undefined,
): boolean {
  if (!user || assignedAdvisorsOf(client).length === 0) return false;
  const role = user.role.code;
  return isSedeAdmin(role) || role === "SALES_REP" || role === "SUB_SELLER";
}
