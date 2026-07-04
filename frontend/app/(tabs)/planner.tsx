import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { COLORS, RADIUS, SPACING, apiFetch } from "@/src/lib/api";

type Task = {
  id: string;
  day: number;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
};
type Cycle = {
  crop: string;
  season: string;
  duration_days: number;
  today_day: number;
  progress: number;
  field_name: string;
  reminders_enabled: boolean;
};

export default function PlannerScreen() {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todayTask, setTodayTask] = useState<Task | null>(null);
  const [reminders, setReminders] = useState(true);

  const load = useCallback(async () => {
    const r = await apiFetch<{ cycle: Cycle | null; tasks: Task[]; today_task: Task | null }>("/planner");
    setCycle(r.cycle);
    setTasks(r.tasks);
    setTodayTask(r.today_task);
    if (r.cycle) setReminders(r.cycle.reminders_enabled);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markDone = async () => {
    if (!todayTask) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await apiFetch("/planner/complete", {
      method: "POST",
      body: JSON.stringify({ task_id: todayTask.id }),
    });
    await load();
  };

  const toggleReminders = async (v: boolean) => {
    setReminders(v);
    Haptics.selectionAsync();
    const form = new FormData();
    form.append("enabled", String(v));
    await apiFetch("/planner/reminders", { method: "POST", body: form as any });
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.brandDark, COLORS.brand]} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={{ padding: SPACING.lg }}>
            <Text style={styles.title}>Activity Planner</Text>
            {cycle && (
              <Text style={styles.sub}>
                {cycle.crop} Cultivation — {cycle.field_name}
              </Text>
            )}
            {cycle && (
              <View style={styles.durationRow}>
                <View style={styles.durationBox}>
                  <Text style={styles.durLabel}>DURATION</Text>
                  <Text style={styles.durValue}>{cycle.duration_days} Days · {cycle.season}</Text>
                </View>
                <View style={styles.durationBox}>
                  <Text style={styles.durLabel}>TODAY</Text>
                  <Text style={styles.durValue}>Day {cycle.today_day}</Text>
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        {cycle && (
          <>
            <View style={styles.rowBetween}>
              <Text style={styles.section}>Overall Progress</Text>
              <Text style={[styles.section, { color: COLORS.brand }]}>{cycle.progress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${cycle.progress}%` }]} />
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.mutedSm}>Day 1 · Sowing</Text>
              <Text style={styles.mutedSm}>Day {cycle.duration_days} · Harvest</Text>
            </View>
          </>
        )}

        {todayTask && (
          <View style={styles.todayCard} testID="today-task-card">
            <View style={styles.rowGap}>
              <View style={styles.dotBrand} />
              <Text style={styles.todayLabel}>TODAY — DAY {todayTask.day}</Text>
            </View>
            <View style={[styles.rowGap, { marginTop: SPACING.md, gap: SPACING.md }]}>
              <View style={styles.taskIcon}>
                <Ionicons name={mapIcon(todayTask.icon)} size={22} color={COLORS.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.todayTitle}>{todayTask.title}</Text>
                <Text style={styles.todayDesc}>{todayTask.description}</Text>
              </View>
            </View>
            <View style={[styles.rowGap, { marginTop: SPACING.md, gap: SPACING.md }]}>
              <Pressable testID="mark-done-button" style={styles.markBtn} onPress={markDone}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.markBtnText}>Mark Done</Text>
              </Pressable>
              <Pressable style={styles.voiceBtn}>
                <Ionicons name="mic" size={18} color={COLORS.brand} />
                <Text style={styles.voiceBtnText}>Voice Guide</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={[styles.card, styles.reminderRow]}>
          <View style={styles.rowGap}>
            <Ionicons name="notifications" size={18} color={COLORS.text} />
            <Text style={styles.cardTitle}>Daily Reminders</Text>
          </View>
          <Switch
            testID="reminders-switch"
            value={reminders}
            onValueChange={toggleReminders}
            trackColor={{ true: COLORS.brand, false: "#D1D5DB" }}
            thumbColor="#fff"
          />
        </View>

        <Text style={[styles.section, { marginTop: SPACING.md, marginBottom: SPACING.sm }]}>Full Timeline</Text>
        <View style={styles.timeline}>
          <View style={styles.timelineLine} />
          {tasks.map((t) => {
            const isToday = cycle && t.day === cycle.today_day;
            return (
              <View key={t.id} style={styles.timelineRow} testID={`task-${t.id}`}>
                <View
                  style={[
                    styles.timelineDot,
                    t.completed && { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
                    isToday && !t.completed && { backgroundColor: COLORS.warning, borderColor: COLORS.warning },
                  ]}
                />
                <View style={[styles.taskCard, isToday && { borderColor: COLORS.brand }]}>
                  <View style={styles.taskIconSm}>
                    <Ionicons name={mapIcon(t.icon)} size={16} color={t.completed ? COLORS.brand : COLORS.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, t.completed && { color: COLORS.text }]}>{t.title}</Text>
                    <Text style={styles.taskSub}>
                      Day {t.day} · {t.completed ? "Completed" : isToday ? "Today" : "Upcoming"}
                    </Text>
                  </View>
                  {t.completed ? (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.brand} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color={COLORS.textMuted} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function mapIcon(name: string): any {
  const m: Record<string, string> = {
    cart: "cart",
    flask: "flask",
    leaf: "leaf",
    seedling: "sunny",
    water: "water",
    cube: "cube",
    cut: "cut",
    bug: "bug",
    search: "search",
    trophy: "trophy",
  };
  return m[name] || "ellipse";
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  sub: { color: "rgba(255,255,255,0.85)", marginTop: 4 },
  durationRow: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.md },
  durationBox: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  durLabel: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  durValue: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 4 },
  scroll: { padding: SPACING.lg, paddingBottom: 140 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 6 },
  section: { color: COLORS.text, fontWeight: "800", fontSize: 15 },
  progressBar: {
    height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, marginVertical: SPACING.sm, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: COLORS.brand, borderRadius: 4 },
  mutedSm: { color: COLORS.textMuted, fontSize: 11 },
  todayCard: {
    backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginTop: SPACING.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  dotBrand: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brand },
  todayLabel: { color: COLORS.brand, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  taskIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.warningBg,
    alignItems: "center", justifyContent: "center",
  },
  todayTitle: { fontWeight: "800", fontSize: 16, color: COLORS.text },
  todayDesc: { color: COLORS.textMuted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  markBtn: {
    flex: 1, backgroundColor: COLORS.brand, borderRadius: RADIUS.md,
    paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  markBtnText: { color: "#fff", fontWeight: "700" },
  voiceBtn: {
    flex: 1, borderColor: COLORS.brand, borderWidth: 1.5, borderRadius: RADIUS.md,
    paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  voiceBtnText: { color: COLORS.brand, fontWeight: "700" },
  card: {
    backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  reminderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontWeight: "700", color: COLORS.text, fontSize: 15 },
  timeline: { position: "relative", paddingLeft: SPACING.md },
  timelineLine: {
    position: "absolute", left: 5, top: 8, bottom: 8, width: 2, backgroundColor: COLORS.border,
  },
  timelineRow: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm },
  timelineDot: {
    position: "absolute", left: -1, width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#fff", borderWidth: 2, borderColor: COLORS.border, zIndex: 1,
  },
  taskCard: {
    flex: 1, marginLeft: SPACING.lg,
    backgroundColor: "#fff", borderRadius: RADIUS.md,
    padding: SPACING.md, flexDirection: "row", alignItems: "center", gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  taskIconSm: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: "#F1F5F2",
    alignItems: "center", justifyContent: "center",
  },
  taskTitle: { color: COLORS.text, fontWeight: "700", fontSize: 14 },
  taskSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
});
