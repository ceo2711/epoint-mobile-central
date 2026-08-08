import type { User } from "@/types/api";

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
  /** Show in bottom tab bar (others go to "Más") */
  primaryTab?: boolean;
}

/** v1.0.0: solo portal cliente. Staff/admin viven en la app web (y en feature/admin-mobile). */
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

export function isClientRole(roleCode: string | undefined | null): boolean {
  return roleCode === "CLIENT";
}

export function getAccessibleNavItems(
  user: User | null,
  _hasPermission: (permission: string) => boolean,
  options?: { boardUnlocked?: boolean },
): NavItem[] {
  if (!user || !isClientRole(user.role.code)) return [];

  const unlocked = Boolean(options?.boardUnlocked);
  return clientNav.filter(
    (item) => item.href !== "/(portal)/(tabs)/tablero" || unlocked,
  );
}

export function getDefaultAppPath(roleCode: string): string {
  return "/(portal)/(tabs)";
}

export function mustForcePasswordChange(user: {
  must_change_password: boolean;
} | null): boolean {
  return Boolean(user?.must_change_password);
}
