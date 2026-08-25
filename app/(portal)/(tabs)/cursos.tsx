import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

import { ScreenState } from "@/components/ui/ScreenState";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { api, getUserFacingErrorMessage } from "@/lib/api";
import { colors } from "@/theme/tokens";

type Lesson = {
  id: number;
  title: string;
  duration_label: string | null;
  objective: string | null;
  has_video: boolean;
  completed: boolean;
};

type Module = {
  id: number;
  number: string;
  title: string;
  goal: string | null;
  lessons: Lesson[];
};

type Course = {
  title: string;
  description: string | null;
  modules: Module[];
};

export default function PortalCursosScreen() {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const allowed = Boolean(user?.entitlements?.course);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openModuleId, setOpenModuleId] = useState<number | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Course>("/portal/courses", token);
      setCourse(data);
      setOpenModuleId(data.modules[0]?.id ?? null);
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("portal.loadError")));
    } finally {
      setLoading(false);
    }
  }, [allowed, t, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function playLesson(lesson: Lesson) {
    if (!token || !lesson.has_video) {
      setPlayUrl(null);
      setActiveTitle(lesson.title);
      return;
    }
    try {
      const data = await api.get<{ play_url: string }>(
        `/portal/courses/lessons/${lesson.id}/play`,
        token,
      );
      setActiveTitle(lesson.title);
      setPlayUrl(data.play_url);
      await api.post(`/portal/courses/lessons/${lesson.id}/complete`, {}, token);
    } catch (err) {
      setError(getUserFacingErrorMessage(err, t("nav.courses")));
    }
  }

  if (!allowed) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{t("nav.courses")}</Text>
        <Text style={styles.body}>{t("nav.productLocked")}</Text>
      </View>
    );
  }

  if (loading && !course) {
    return <ScreenState loading message={t("portal.loading")} />;
  }

  const videoHtml = playUrl
    ? `<html><body style="margin:0;background:#000"><video controls autoplay playsinline style="width:100%;height:100%" src="${playUrl.replace(/"/g, "")}"></video></body></html>`
    : "";

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{course?.title ?? t("nav.courses")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {playUrl ? (
        <View style={styles.player}>
          <Text style={styles.playerTitle}>{activeTitle}</Text>
          <WebView
            originWhitelist={["*"]}
            source={{ html: videoHtml }}
            style={styles.webview}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
        </View>
      ) : null}
      {course?.modules.map((module) => {
        const open = openModuleId === module.id;
        return (
          <View key={module.id} style={styles.module}>
            <TouchableOpacity onPress={() => setOpenModuleId(open ? null : module.id)}>
              <Text style={styles.moduleNumber}>
                {module.number}
              </Text>
              <Text style={styles.moduleTitle}>{module.title}</Text>
            </TouchableOpacity>
            {open
              ? module.lessons.map((lesson) => (
                  <TouchableOpacity
                    key={lesson.id}
                    style={styles.lesson}
                    onPress={() => void playLesson(lesson)}
                  >
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                    <Text style={styles.lessonMeta}>
                      {lesson.duration_label ?? ""}
                      {lesson.has_video ? "" : " · —"}
                      {lesson.completed ? " · ✓" : ""}
                    </Text>
                  </TouchableOpacity>
                ))
              : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  body: { fontSize: 16, color: colors.ink, lineHeight: 22 },
  error: { color: colors.danger, marginBottom: 8 },
  player: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 8,
  },
  playerTitle: { padding: 12, fontWeight: "600", color: colors.ink },
  webview: { height: 220, backgroundColor: "#000" },
  module: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
  },
  moduleNumber: { fontSize: 11, fontWeight: "700", color: colors.brand, textTransform: "uppercase" },
  moduleTitle: { fontSize: 16, fontWeight: "600", color: colors.ink, marginTop: 4 },
  lesson: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, marginTop: 8 },
  lessonTitle: { fontSize: 15, color: colors.ink },
  lessonMeta: { fontSize: 12, color: colors.soft, marginTop: 2 },
});
