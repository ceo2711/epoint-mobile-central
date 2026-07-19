import type { User } from "@/types/api";

export type StaffRoleCode = "ADMIN" | "SALES_REP" | "ONBOARDING_MANAGER" | "ADVISOR" | "AREA_LEADER";

export interface NavItem {
  /** Expo Router path (group-relative) */
  href: string;
  /** Web href for parity reference */
  webHref: string;
  label: string;
  /** Ionicons name */
  icon: string;
  permission?: string | null;
  roles?: readonly StaffRoleCode[];
  /** Show in bottom tab bar (others go to "Más") */
  primaryTab?: boolean;
}

export const internalNav: NavItem[] = [
  {
    href: "/(staff)/(tabs)/dashboard",
    webHref: "/dashboard",
    label: "Panel",
    icon: "grid-outline",
    permission: null,
    primaryTab: true,
  },
  {
    href: "/(staff)/(tabs)/clientes",
    webHref: "/clientes",
    label: "Clientes",
    icon: "people-outline",
    permission: "clients:read",
    primaryTab: true,
  },
  {
    href: "/(staff)/(tabs)/prospectos",
    webHref: "/prospectos",
    label: "Prospectos",
    icon: "person-add-outline",
    permission: "prospects:read",
    roles: ["ADMIN", "SALES_REP"],
    primaryTab: true,
  },
  {
    href: "/(staff)/(tabs)/notificaciones",
    webHref: "/notificaciones",
    label: "Notificaciones",
    icon: "notifications-outline",
    permission: null,
    primaryTab: true,
  },
  {
    href: "/(staff)/(tabs)/calendario",
    webHref: "/calendario",
    label: "Calendario",
    icon: "calendar-outline",
    permission: null,
    roles: ["ADMIN", "SALES_REP"],
  },
  {
    href: "/(staff)/(tabs)/contratos",
    webHref: "/contratos",
    label: "Contratos",
    icon: "document-text-outline",
    permission: null,
    roles: ["ADMIN", "SALES_REP"],
  },
  {
    href: "/(staff)/(tabs)/pagos",
    webHref: "/pagos",
    label: "Pagos",
    icon: "card-outline",
    permission: null,
    roles: ["ADMIN", "SALES_REP"],
  },
  {
    href: "/(staff)/(tabs)/usuarios",
    webHref: "/usuarios",
    label: "Usuarios",
    icon: "people-circle-outline",
    permission: "users:read",
  },
  {
    href: "/(staff)/(tabs)/comercios",
    webHref: "/comercios",
    label: "Comercios",
    icon: "storefront-outline",
    permission: "merchants:create",
  },
  {
    href: "/(staff)/(tabs)/roles",
    webHref: "/roles",
    label: "Roles",
    icon: "shield-checkmark-outline",
    permission: "roles:read",
  },
  {
    href: "/(staff)/(tabs)/cuenta",
    webHref: "/configuracion",
    label: "Mi cuenta",
    icon: "person-outline",
    permission: null,
    primaryTab: true,
  },
];

export const clientNav: NavItem[] = [
  {
    href: "/(portal)/(tabs)",
    webHref: "/portal",
    label: "Inicio",
    icon: "home-outline",
    primaryTab: true,
  },
  {
    href: "/(portal)/(tabs)/datos",
    webHref: "/portal/datos",
    label: "Mis datos",
    icon: "person-outline",
    primaryTab: true,
  },
  {
    href: "/(portal)/(tabs)/documentos",
    webHref: "/portal/documentos",
    label: "Documentos",
    icon: "folder-outline",
    primaryTab: true,
  },
  {
    href: "/(portal)/(tabs)/tablero",
    webHref: "/portal/tablero",
    label: "Tablero",
    icon: "clipboard-outline",
    primaryTab: true,
  },
  {
    href: "/(portal)/(tabs)/cuenta",
    webHref: "/portal/cuenta",
    label: "Cuenta",
    icon: "settings-outline",
    primaryTab: true,
  },
];

export function getAccessibleNavItems(
  user: User | null,
  hasPermission: (permission: string) => boolean,
): NavItem[] {
  if (!user) return [];

  if (user.role.code === "CLIENT") {
    return clientNav;
  }

  return internalNav.filter((item) => {
    if (item.roles && !item.roles.includes(user.role.code as StaffRoleCode)) {
      return false;
    }
    return !item.permission || hasPermission(item.permission);
  });
}

export function getDefaultAppPath(roleCode: string): string {
  return roleCode === "CLIENT" ? "/(portal)/(tabs)" : "/(staff)/(tabs)/dashboard";
}

export function mustForcePasswordChange(user: { must_change_password: boolean } | null): boolean {
  return Boolean(user?.must_change_password);
}

export const NAV_LABELS: Record<string, string> = Object.fromEntries(
  [...internalNav, ...clientNav].map((item) => [item.webHref, item.label]),
);
