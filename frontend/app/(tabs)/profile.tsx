import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { COLORS, RADIUS, SPACING, apiFetch, clearToken, store, type Lang } from "@/src/lib/api";

type FieldT = { id: string; name: string; preferred_crop: string; area_acres: number; soil_type: string };
type Device = { id: string; serial: string; connected: boolean; battery: number; status: string };

const LANGS: { key: Lang; label: string }[] = [
  { key: "en", label: "English" },
  { key: "te", label: "తెలుగు" },
  { key: "hi", label: "हिन्दी" },
];

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [fields, setFields] = useState<FieldT[]>([]);
  const [device, setDevice] = useState<Device | null>(null);
  const [lang, setLang] = useState<Lang>(store.lang);
  const [langOpen, setLangOpen] = useState(false);

  const load = useCallback(async () => {
    const [u, f, d] = await Promise.all([
      apiFetch<{ user: any }>("/auth/me"),
      apiFetch<{ fields: FieldT[] }>("/fields"),
      apiFetch<{ devices: Device[] }>("/devices"),
    ]);
    setUser(u.user);
    setFields(f.fields);
    setDevice(d.devices[0] || null);
    if (u.user.preferred_language && u.user.preferred_language !== store.lang) {
      await store.setLang(u.user.preferred_language as Lang);
      setLang(u.user.preferred_language as Lang);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chooseLang = async (l: Lang) => {
    Haptics.selectionAsync();
    setLang(l);
    await store.setLang(l);
    await apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify({ preferred_language: l }) });
    setLangOpen(false);
  };

  const logout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await clearToken();
    store.setUser(null);
    router.replace("/(auth)/login");
  };

  const totalAcres = fields.reduce((s, f) => s + (f.area_acres || 0), 0);
  const primaryField = fields[0];
  const initials = (user?.full_name || "F K").split(" ").map((s: string) => s[0]).slice(0, 2).join("");

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient colors={[COLORS.brandDark, COLORS.brand]} style={styles.header}>
          <SafeAreaView edges={["top"]} style={{ alignItems: "center" }}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </View>
            <Text style={styles.name}>{user?.full_name || "—"}</Text>
            <Text style={styles.info}>+91 {user?.mobile || ""}</Text>
            {user?.email ? <Text style={styles.info}>{user.email}</Text> : null}

            <View style={styles.stats}>
              <Stat value={String(fields.length)} label="Fields" />
              <Stat value={totalAcres.toFixed(1)} label="Acres" />
              <Stat value="78" label="Score" />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.section}>PERSONAL DETAILS</Text>
          <Row label="Full Name" value={user?.full_name || "—"} />
          <Row label="Mobile" value={user?.mobile ? `+91 ${user.mobile}` : "—"} />
          <Row label="Email" value={user?.email || "—"} last />
        </View>

        {primaryField && (
          <View style={styles.card} testID="farm-details-card">
            <View style={styles.rowBetween}>
              <Text style={styles.section}>FARM DETAILS</Text>
              <View style={styles.rowGap}>
                <Ionicons name="create-outline" size={14} color={COLORS.brand} />
                <Text style={styles.editText}>Edit</Text>
              </View>
            </View>
            <Row label="Farm Name" value={user?.farm_name || "—"} />
            <Row label="Field Name" value={primaryField.name} />
            <Row label="Area" value={`${primaryField.area_acres} Acres`} />
            <Row label="Soil Type" value={primaryField.soil_type} />
            <Row label="Preferred Crop" value={primaryField.preferred_crop} last />
          </View>
        )}

        {device && (
          <View style={styles.card}>
            <Text style={styles.section}>DEVICE INFORMATION</Text>
            <Row label="Serial" value={device.serial} />
            <Row label="Status" value={device.connected ? "Connected" : "Disconnected"} />
            <Row label="Battery" value={`${device.battery}%`} last />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.section}>SETTINGS</Text>
          <Pressable testID="language-toggle" style={styles.settingRow} onPress={() => setLangOpen(true)}>
            <View style={styles.rowGap}>
              <Ionicons name="language" size={18} color={COLORS.text} />
              <Text style={styles.settingLabel}>Language</Text>
            </View>
            <View style={styles.rowGap}>
              <Text style={styles.settingValue}>{LANGS.find((l) => l.key === lang)?.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </View>
          </Pressable>
        </View>

        <Pressable testID="logout-button" style={styles.logout} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setLangOpen(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Select Language</Text>
          {LANGS.map((l) => (
            <Pressable
              key={l.key}
              testID={`lang-${l.key}`}
              style={[styles.modalItem, lang === l.key && { backgroundColor: COLORS.brandLight }]}
              onPress={() => chooseLang(l.key)}
            >
              <Text style={styles.modalItemName}>{l.label}</Text>
              {lang === l.key && <Ionicons name="checkmark-circle" size={20} color={COLORS.brand} />}
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

function Stat({ value, label }: any) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ label, value, last }: any) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  scroll: { paddingBottom: 140 },
  header: {
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingBottom: SPACING.xl,
  },
  avatarWrap: { marginTop: SPACING.md },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 28 },
  editBadge: {
    position: "absolute", right: 0, bottom: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.warning,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: COLORS.brand,
  },
  name: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: SPACING.md },
  info: { color: "rgba(255,255,255,0.85)", marginTop: 2 },
  stats: { flexDirection: "row", gap: SPACING.md, marginTop: SPACING.lg },
  stat: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    minWidth: 76,
  },
  statValue: { color: "#fff", fontSize: 18, fontWeight: "800" },
  statLabel: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2 },
  card: {
    backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginHorizontal: SPACING.lg, marginTop: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  section: { color: COLORS.brand, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { color: COLORS.textMuted },
  rowValue: { color: COLORS.text, fontWeight: "700", flexShrink: 1, textAlign: "right" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 6 },
  editText: { color: COLORS.brand, fontWeight: "700", fontSize: 13 },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: SPACING.md, marginTop: SPACING.sm },
  settingLabel: { color: COLORS.text, fontWeight: "600" },
  settingValue: { color: COLORS.textMuted },
  logout: {
    marginTop: SPACING.md,
    marginHorizontal: SPACING.lg,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: COLORS.danger, borderRadius: RADIUS.md,
    paddingVertical: 14,
  },
  logoutText: { color: COLORS.danger, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: {
    position: "absolute", left: SPACING.lg, right: SPACING.lg, top: "30%",
    backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg,
  },
  modalTitle: { fontWeight: "800", fontSize: 16, marginBottom: SPACING.md, color: COLORS.text },
  modalItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: SPACING.md, borderRadius: RADIUS.md,
  },
  modalItemName: { color: COLORS.text, fontWeight: "600" },
});
