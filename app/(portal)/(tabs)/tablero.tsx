import { useAuth } from "@/features/auth/AuthContext";
import { ClientBoardPanel } from "@/features/clients/components/ClientBoardPanel";
import { ScreenState } from "@/components/ui/ScreenState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTranslation } from "@/contexts/LanguageContext";
import { colors } from "@/theme/tokens";
import { StyleSheet, View } from "react-native";

export default function PortalTableroScreen() {
  const { token, user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const clientId = user?.client_id;

  if (authLoading) {
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

  return (
    <ClientBoardPanel
      clientId={clientId}
      token={token}
      canManage={false}
      isClientPortal
      scrollable
      title={t("portalBoard.title")}
      subtitle={t("portalBoard.subtitle")}
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
