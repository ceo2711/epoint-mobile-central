import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/features/auth/AuthContext";
import { ClientBoardPanel } from "@/features/clients/components/ClientBoardPanel";
import {
  usePortalBoardUnlock,
  usePortalBoardUnlocked,
} from "@/features/portal/PortalBoardUnlockContext";
import { ScreenState } from "@/components/ui/ScreenState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTranslation } from "@/contexts/LanguageContext";
import { payloadPositiveInt } from "@/features/notifications/notification-routes";
import { colors } from "@/theme/tokens";

export default function PortalTableroScreen() {
  const { token, user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const { card: cardParam } = useLocalSearchParams<{ card?: string }>();
  const clientId = user?.client_id;
  const boardUnlocked = usePortalBoardUnlocked();
  const unlockCtx = usePortalBoardUnlock();
  const unlocking = Boolean(unlockCtx?.loading);
  const initialCardId = payloadPositiveInt(
    Array.isArray(cardParam) ? cardParam[0] : cardParam,
  );

  useEffect(() => {
    if (!authLoading && !unlocking && unlockCtx?.client && !boardUnlocked) {
      router.replace("/(portal)/(tabs)" as never);
    }
  }, [authLoading, unlocking, unlockCtx?.client, boardUnlocked, router]);

  if (authLoading || unlocking) {
    return <ScreenState loading message={t("portalBoard.loading")} />;
  }

  if (!token || !clientId) {
    return (
      <View style={styles.wrap}>
        <EmptyState
          icon="clipboard-outline"
          title={t("portalBoard.unavailableTitle")}
          description={t("portalBoard.unavailableBody")}
        />
      </View>
    );
  }

  if (!boardUnlocked) {
    return (
      <View style={styles.wrap}>
        <EmptyState
          icon="lock-closed-outline"
          title={t("portalBoard.lockedTitle")}
          description={t("portalBoard.lockedBody")}
        />
      </View>
    );
  }

  return (
    <ClientBoardPanel
      clientId={clientId}
      token={token}
      canManage={false}
      isClientPortal
      scrollable
      title={t("portalBoard.title")}
      subtitle={t("portalBoard.subtitle")}
      initialCardId={initialCardId}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.cream,
    padding: 20,
  },
});
