import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { runOnJS } from "react-native-reanimated";

import { useAuth } from "@/features/auth/AuthContext";
import { getAccessibleNavItems, type NavItem } from "@/lib/appNavigation";
import { colors, radii } from "@/theme/tokens";

type AppShellProps = {
  children: ReactNode;
  accountHref: string;
  homeHref: string;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);
const DRAWER_HIDDEN_X = -DRAWER_WIDTH;
const OPEN_MS = 280;
const CLOSE_MS = 240;
const BACK_EDGE_WIDTH = 28;
const BACK_DISTANCE = 72;
const BACK_VELOCITY = 650;

/** Strip Expo Router groups: /(portal)/(tabs)/cuenta -> /cuenta */
function normalizePath(path: string): string {
  return (
    path
      .replace(/\/\([^/]+\)/g, "")
      .replace(/\/+/g, "/")
      .replace(/\/$/, "") || "/"
  );
}

function hrefLeaf(href: string): string | null {
  const parts = normalizePath(href).split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : null;
}

function isHomePath(pathname: string, homeHref: string): boolean {
  const path = normalizePath(pathname);
  const home = normalizePath(homeHref);
  if (path === home) return true;
  // Portal index often resolves to "/" or "/portal"
  if (home === "/" || home === "" || !hrefLeaf(homeHref)) {
    return path === "/" || path === "/portal";
  }
  return path === `/${hrefLeaf(homeHref)}`;
}

function pathMatchesNavItem(pathname: string, item: NavItem): boolean {
  const path = normalizePath(pathname);
  const leaf = hrefLeaf(item.href);
  const segments = path.split("/").filter(Boolean);
  if (!leaf) {
    return path === "/" || path === "/portal" || segments.length === 0;
  }
  // Raíz del ítem: último segmento es el leaf (/clientes sí, /clientes/12 no)
  return segments[segments.length - 1] === leaf;
}

function pathMatchesHref(pathname: string, href: string): boolean {
  return pathMatchesNavItem(pathname, {
    href,
    webHref: href,
    label: "",
    icon: "",
  });
}

function isOnRootNavScreen(pathname: string, navItems: NavItem[], homeHref: string): boolean {
  if (isHomePath(pathname, homeHref)) return true;
  return navItems.some((item) => pathMatchesNavItem(pathname, item));
}

function isOnAccountScreen(pathname: string, accountHref: string): boolean {
  return pathMatchesHref(pathname, accountHref);
}

export function AppShell({ children, accountHref, homeHref }: AppShellProps) {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(DRAWER_HIDDEN_X)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const navItems = useMemo(
    () => getAccessibleNavItems(user, hasPermission),
    [user, hasPermission],
  );

  const onAccountScreen = isOnAccountScreen(pathname, accountHref);

  useEffect(() => {
    if (menuOpen) {
      setModalVisible(true);
      return;
    }

    if (!modalVisible) return;

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: DRAWER_HIDDEN_X,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setModalVisible(false);
    });
  }, [menuOpen, modalVisible, slideAnim, backdropAnim]);

  useEffect(() => {
    if (!menuOpen || !modalVisible) return;

    slideAnim.setValue(DRAWER_HIDDEN_X);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [menuOpen, modalVisible, slideAnim, backdropAnim]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function goTo(href: string) {
    closeMenu();
    if (pathMatchesHref(pathname, href) || isHomePath(pathname, href)) {
      return;
    }
    router.replace(href as never);
  }

  const onBack = useCallback(() => {
    if (isHomePath(pathname, homeHref)) return;

    // Vistas raíz del menú (Cuenta, Datos, Documentos, etc.) → Inicio
    if (isOnRootNavScreen(pathname, navItems, homeHref)) {
      router.replace(homeHref as never);
      return;
    }

    // Subvistas → pantalla anterior
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(homeHref as never);
    }
  }, [router, pathname, navItems, homeHref]);

  function onUser() {
    if (onAccountScreen) return;
    router.push(accountHref as never);
  }

  const backGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isHomePath(pathname, homeHref))
        .activeOffsetX(18)
        .failOffsetY([-24, 24])
        .onEnd((event) => {
          const shouldGoBack =
            event.translationX > BACK_DISTANCE || event.velocityX > BACK_VELOCITY;
          if (shouldGoBack) {
            runOnJS(onBack)();
          }
        }),
    [onBack, pathname, homeHref],
  );

  const displayName = user
    ? `${user.first_name} ${user.last_name}`.trim() || user.email
    : "";

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Abrir menú"
          onPress={() => setMenuOpen(true)}
          style={styles.headerBtn}
        >
          <Ionicons name="menu" size={26} color={colors.cream} />
        </TouchableOpacity>

        <View style={styles.headerBrand}>
          <Image
            source={require("../../../assets/epoint-logo.png")}
            style={styles.headerLogo}
            resizeMode="cover"
            accessibilityLabel="Epoint"
          />
          <Text style={styles.headerBrandText}>Epoint</Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Usuario"
          onPress={onUser}
          style={styles.headerBtn}
        >
          <Ionicons name="person-circle-outline" size={26} color={colors.cream} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {children}
        <GestureDetector gesture={backGesture}>
          <View
            style={styles.backEdge}
            accessibilityLabel="Deslizá a la derecha para volver"
          />
        </GestureDetector>
      </View>

      <Modal
        visible={modalVisible}
        animationType="none"
        transparent
        onRequestClose={closeMenu}
      >
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          </Animated.View>

          <Animated.View
            style={[
              styles.drawer,
              {
                width: DRAWER_WIDTH,
                paddingTop: insets.top + 12,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <View style={styles.drawerHeader}>
              <Image
                source={require("../../../assets/epoint-logo.png")}
                style={styles.drawerLogo}
                resizeMode="cover"
              />
              <View style={styles.drawerHeaderText}>
                <Text style={styles.drawerUser} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.drawerRole}>{user?.role.name}</Text>
              </View>
              <TouchableOpacity onPress={closeMenu} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.brown} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.menuList}>
              {navItems.map((item) => {
                const segment =
                  item.href.split("/").filter(Boolean).pop() ?? "__none__";
                const active =
                  pathname === item.href ||
                  pathname.endsWith(`/${segment}`) ||
                  pathname.includes(`/${segment}/`);
                return (
                  <TouchableOpacity
                    key={item.href}
                    style={[styles.menuItem, active && styles.menuItemActive]}
                    onPress={() => goTo(item.href)}
                  >
                    <Ionicons
                      name={item.icon as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color={active ? colors.brand : colors.brown}
                    />
                    <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    backgroundColor: colors.brown,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  headerBrandText: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: "800",
  },
  content: {
    flex: 1,
  },
  backEdge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: BACK_EDGE_WIDTH,
    zIndex: 20,
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.cream,
    borderTopRightRadius: radii.card,
    borderBottomRightRadius: radii.card,
    zIndex: 2,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 12,
  },
  drawerLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  drawerHeaderText: {
    flex: 1,
  },
  drawerUser: {
    fontSize: 13,
    color: colors.ink,
  },
  drawerRole: {
    fontSize: 12,
    color: colors.soft,
  },
  closeBtn: {
    padding: 4,
  },
  menuList: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radii.control,
  },
  menuItemActive: {
    backgroundColor: colors.brandLight,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  menuLabelActive: {
    color: colors.brand,
  },
});
