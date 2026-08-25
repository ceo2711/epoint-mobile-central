import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { colors } from "@/theme/tokens";

export default function PortalMentoriasScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const allowed = Boolean(user?.entitlements?.mentorship);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("nav.mentorships")}</Text>
      <Text style={styles.body}>
        {allowed ? t("portal.mentorshipSoon") : t("nav.productLocked")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, backgroundColor: colors.cream },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  body: { fontSize: 16, color: colors.ink, lineHeight: 22 },
});
