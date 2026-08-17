import type { User } from "@/types/api";

export const SALES_STAFF_ROLE_CODES = ["SALES_REP", "SUB_SELLER"] as const;

export function isSalesStaff(roleCode: string | undefined | null): boolean {
  return roleCode === "SALES_REP" || roleCode === "SUB_SELLER";
}

export function isGlobalAdmin(roleCode: string | undefined | null): boolean {
  return roleCode === "ADMIN";
}

export function isSedeAdmin(roleCode: string | undefined | null): boolean {
  return roleCode === "ADMIN" || roleCode === "BRANCH_MANAGER";
}

export function isSalesAreaLeader(user: User | null | undefined): boolean {
  return user?.role.code === "AREA_LEADER" && user.area?.code === "VENTAS";
}

export function isOnboardingAreaLeader(
  user: Pick<User, "role" | "area"> | null | undefined,
): boolean {
  return user?.role.code === "AREA_LEADER" && user.area?.code === "ONBOARDING";
}

export function isAdvisorsAreaLeader(
  user: Pick<User, "role" | "area"> | null | undefined,
): boolean {
  return user?.role.code === "AREA_LEADER" && user.area?.code === "ASESORES";
}

export function isAdvisor(
  user: Pick<User, "role"> | null | undefined,
): boolean {
  return user?.role.code === "ADVISOR";
}

/** Panel de onboarding: líder de onboarding, jefe de asesores y asesor. */
export function seesOnboardingDashboard(
  user: Pick<User, "role" | "area"> | null | undefined,
): boolean {
  return isOnboardingAreaLeader(user) || isAdvisorsAreaLeader(user) || isAdvisor(user);
}

/** Admin/gerente o staff de onboarding/asesores. */
export function canManageOnboarding(
  user: Pick<User, "role" | "area"> | null | undefined,
): boolean {
  return isSedeAdmin(user?.role.code) || seesOnboardingDashboard(user);
}

/** Puede operar herramientas comerciales propias (prospectos, calendario, contratos, pagos). */
export function canSell(user: User | null | undefined): boolean {
  return isSalesStaff(user?.role.code) || isSalesAreaLeader(user);
}

export function canSuperviseSalesReps(user: User | null | undefined): boolean {
  return isSedeAdmin(user?.role.code) || isSalesAreaLeader(user);
}

/** Filtro por vendedor/subvendedor en clientes (onboarding/jefes; no el asesor de línea). */
export function canFilterClientsBySalesRep(user: User | null | undefined): boolean {
  return canSuperviseSalesReps(user) || (seesOnboardingDashboard(user) && !isAdvisor(user));
}

export function canRunOnboardingReminders(user: User | null | undefined): boolean {
  return canManageOnboarding(user) && !isAdvisor(user);
}

export function canUploadClientDocuments(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role.code === "CLIENT") return true;
  return canManageOnboarding(user) && !isAdvisor(user);
}

export function canDownloadClientDocuments(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role.code === "CLIENT") return true;
  return isSedeAdmin(user.role.code) || isAdvisor(user);
}

/** Ver/enviar contratos DocuSign (desde el cliente; no el ítem Contratos del menú). */
export function canAccessDocusign(user: User | null | undefined): boolean {
  if (!user) return false;
  const code = user.role.code;
  if (
    code === "ADMIN" ||
    code === "BRANCH_MANAGER" ||
    code === "SALES_REP" ||
    code === "SUB_SELLER" ||
    code === "AREA_LEADER"
  ) {
    return true;
  }
  return canManageOnboarding(user);
}

export function canManageSedes(roleCode: string | undefined | null): boolean {
  return isGlobalAdmin(roleCode);
}

export function canManageMerchants(roleCode: string | undefined | null): boolean {
  return isGlobalAdmin(roleCode);
}

export function canManageSources(roleCode: string | undefined | null): boolean {
  return isGlobalAdmin(roleCode);
}

export const SEDE_REQUIRED_ROLE_CODES = [
  "SALES_REP",
  "SUB_SELLER",
  "ADVISOR",
  "BRANCH_MANAGER",
  "AREA_LEADER",
] as const;

export function isSedeRequiredRole(roleCode: string | undefined | null): boolean {
  return (
    !!roleCode &&
    (SEDE_REQUIRED_ROLE_CODES as readonly string[]).includes(roleCode)
  );
}

export const AREA_REQUIRED_ROLE_CODES = ["AREA_LEADER", "ADVISOR"] as const;
