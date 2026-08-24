import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING, store, clearToken } from "@/src/lib/api";
import { exportReadingsToCSV } from "@/src/utils/csv";

export default function ProfileScreen() {
  const user = store.user;

  const handleLogout = async () => {
    await clearToken();
    store.setUser(null);
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{store.t("settings")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{store.t("personal_details")}</Text>
          <InfoRow label={store.t("full_name")} value={user?.farmer_name || "N/A"} />
          <InfoRow label={store.t("mobile")} value={user?.phone_number || "N/A"} />
          <InfoRow label={store.t("email")} value={user?.email_id || "N/A"} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{store.t("farm_details")}</Text>
          <InfoRow label={store.t("acres")} value={`${user?.holding_acres || 0} Acres`} />
          <InfoRow label={store.t("device_info")} value={user?.device_id || "No Device"} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATA MANAGEMENT</Text>
          <Pressable style={styles.actionBtn} onPress={exportReadingsToCSV}>
            <Ionicons name="download-outline" size={20} color={COLORS.brand} />
            <Text style={styles.actionBtnText}>Download Sensor Data (CSV)</Text>
          </Pressable>
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutBtnText}>{store.t("logout")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { padding: SPACING.lg, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text },
  content: { padding: SPACING.lg },
  section: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: COLORS.textMuted, marginBottom: SPACING.md, letterSpacing: 1 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.chipBg },
  infoLabel: { color: COLORS.textMuted, fontWeight: "600" },
  infoValue: { color: COLORS.text, fontWeight: "700" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  actionBtnText: { color: COLORS.brand, fontWeight: "700", fontSize: 15 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: RADIUS.md, backgroundColor: COLORS.dangerBg, marginTop: SPACING.md },
  logoutBtnText: { color: COLORS.danger, fontWeight: "800", fontSize: 16 },
});
