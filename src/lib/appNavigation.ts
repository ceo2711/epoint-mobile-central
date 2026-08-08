import type { User } from "@/types/api";
import { isSalesAreaLeader } from "@/lib/roles";

export type StaffRoleCode =
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "SALES_REP"
  | "SUB_SELLER"
  | "ADVISOR"
  | "AREA_LEADER";

export interface NavItem {
  /** Expo Router path (group-relative) */
  href: string;
  /** Web href for parity reference */
  webHref: string;
  /** i18n key, e.g. nav.panel */
  labelKey: string;
  /** Ionicons name */
  icon: string;
  permission?: string | null;
  roles?: readonly StaffRoleCode[];
  /** Ítems de supervisión comercial: visibles para líder solo si área = VENTAS. */
  salesAreaOnly?: boolean;
  /** Show in bottom tab bar (others go to "Más") */
  primaryTab?: boolean;
}

const SALES_ROLES: readonly StaffRoleCode[] = [
  "ADMIN",
  "BRANCH_MANAGER",
  "SALES_REP",
  "SUB_SELLER",
  "AREA_LEADER",
];

export const internalNav: NavItem[] = [
  {
    href: "/(staff)/(tabs)/dashboard",
    webHref: "/dashboard",
    labelKey: "nav.panel",
    icon: "grid-outline",
    permission: null,
    primaryTab: true,
  },
  {
    href: "/(staff)/(tabs)/clientes",
    webHref: "/clientes",
    labelKey: "nav.clients",
    icon: "people-outline",
    permission: "clients:read",
    primaryTab: true,
  },
  {
    href: "/(staff)/(tabs)/prospectos",
    webHref: "/prospectos",
    labelKey: "nav.prospects",
    icon: "person-add-outline",
    permission: "prospects:read",
    roles: SALES_ROLES,
    salesAreaOnly: true,
    primaryTab: true,
  },
  {
    href: "/(staff)/(tabs)/calendario",
    webHref: "/calendario",
    labelKey: "nav.calendar",
    icon: "calendar-outline",
    permission: null,
    roles: SALES_ROLES,
    salesAreaOnly: true,
  },
  {
    href: "/(staff)/(tabs)/contratos",
    webHref: "/contratos",
    labelKey: "nav.contracts",
    icon: "document-text-outline",
    permission: null,
    roles: SALES_ROLES,
    salesAreaOnly: true,
  },
  {
    href: "/(staff)/(tabs)/pagos",
    webHref: "/pagos",
    labelKey: "nav.payments",
    icon: "card-outline",
    permission: null,
    roles: SALES_ROLES,
    salesAreaOnly: true,
  },
  {
    href: "/(staff)/(tabs)/usuarios",
    webHref: "/usuarios",
    labelKey: "nav.users",
    icon: "people-circle-outline",
    permission: "users:read",
  },
  {
    href: "/(staff)/(tabs)/sedes",
    webHref: "/sedes",
    labelKey: "nav.sedes",
    icon: "location-outline",
    permission: "sedes:read",
    roles: ["ADMIN"],
  },
  {
    href: "/(staff)/(tabs)/comercios",
    webHref: "/comercios",
    labelKey: "nav.merchants",
    icon: "storefront-outline",
    permission: "merchants:read",
    roles: ["ADMIN"],
  },
  {
    href: "/(staff)/(tabs)/fuentes",
    webHref: "/fuentes",
    labelKey: "nav.sources",
    icon: "pricetag-outline",
    permission: "sources:read",
    roles: ["ADMIN"],
  },
  {
    href: "/(staff)/(tabs)/roles",
    webHref: "/roles",
    labelKey: "nav.roles",
    icon: "shield-checkmark-outline",
    permission: "roles:read",
    roles: ["ADMIN"],
  },
  {
    href: "/(staff)/(tabs)/cuenta",
    webHref: "/configuracion",
    labelKey: "nav.account",
    icon: "person-outline",
    permission: null,
    primaryTab: true,
  },
];

export const clientNav: NavItem[] = [
  {
    href: "/(portal)/(tabs)",
    webHref: "/portal",
    labelKey: "nav.home",
    icon: "home-outline",
    primaryTab: true,
  },
  {
    href: "/(portal)/(tabs)/datos",
    webHref: "/portal/datos",
    labelKey: "nav.myData",
    icon: "person-outline",
    primaryTab: true,
  },
  {
    href: "/(portal)/(tabs)/documentos",
    webHref: "/portal/documentos",
    labelKey: "nav.documents",
    icon: "folder-outline",
    primaryTab: true,
  },
  {
    href: "/(portal)/(tabs)/tablero",
    webHref: "/portal/tablero",
    labelKey: "nav.myBoard",
    icon: "clipboard-outline",
    primaryTab: true,
  },
  {
    href: "/(portal)/(tabs)/cuenta",
    webHref: "/portal/cuenta",
    labelKey: "nav.portalAccount",
    icon: "settings-outline",
    primaryTab: true,
  },
];

export function getAccessibleNavItems(
  user: User | null,
  hasPermission: (permission: string) => boolean,
  options?: { boardUnlocked?: boolean },
): NavItem[] {
  if (!user) return [];

  if (user.role.code === "CLIENT") {
    const unlocked = Boolean(options?.boardUnlocked);
    return clientNav.filter(
      (item) => item.href !== "/(portal)/(tabs)/tablero" || unlocked,
    );
  }

  const salesLeader = isSalesAreaLeader(user);

  return internalNav
    .filter((item) => {
      if (item.roles && !item.roles.includes(user.role.code as StaffRoleCode)) {
        return false;
      }
      if (item.salesAreaOnly && user.role.code === "AREA_LEADER" && !salesLeader) {
        return false;
      }
      return !item.permission || hasPermission(item.permission);
    })
    .map((item) => {
      if (item.href === "/(staff)/(tabs)/usuarios" && salesLeader) {
        return { ...item, labelKey: "nav.salesReps" };
      }
      return item;
    });
}

export function getDefaultAppPath(roleCode: string): string {
  return roleCode === "CLIENT" ? "/(portal)/(tabs)" : "/(staff)/(tabs)/dashboard";
}

export function mustForcePasswordChange(user: {
  must_change_password: boolean;
} | null): boolean {
  return Boolean(user?.must_change_password);
}
