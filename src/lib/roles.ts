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

export function isOnboardingAreaLeader(user: User | null | undefined): boolean {
  return user?.role.code === "AREA_LEADER" && user.area?.code === "ONBOARDING";
}

/** Puede operar herramientas comerciales propias (prospectos, calendario, contratos, pagos). */
export function canSell(user: User | null | undefined): boolean {
  return isSalesStaff(user?.role.code) || isSalesAreaLeader(user);
}

export function canSuperviseSalesReps(user: User | null | undefined): boolean {
  return isSedeAdmin(user?.role.code) || isSalesAreaLeader(user);
}

/** Filtro por vendedor/subvendedor en clientes (incluye líder de onboarding). */
export function canFilterClientsBySalesRep(user: User | null | undefined): boolean {
  return canSuperviseSalesReps(user) || isOnboardingAreaLeader(user);
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
