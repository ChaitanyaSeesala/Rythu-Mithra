import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
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

import { COLORS, RADIUS, SPACING, apiFetch, store } from "@/src/lib/api";

type FieldT = { id: string; name: string; preferred_crop: string; area_acres: number; soil_type: string };
type SensorReading = { value: number; unit: string; status: "Good" | "Low" | "High" };
type Snapshot = {
  field: FieldT;
  readings: {
    nitrogen: SensorReading;
    phosphorus: SensorReading;
    potassium: SensorReading;
    moisture: SensorReading;
    timestamp: string;
  };
  alerts: { level: string; title: string; message: string }[];
};
type Device = { id: string; serial: string; connected: boolean; battery: number; status: string };

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
};

export default function HomeScreen() {
  const [fields, setFields] = useState<FieldT[]>([]);
  const [selectedField, setSelectedField] = useState<FieldT | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [me, setMe] = useState<any>(store.user);
  const pollRef = useRef<any>(null);

  const loadInitial = useCallback(async () => {
    try {
      const [f, d, m] = await Promise.all([
        apiFetch<{ fields: FieldT[] }>("/fields"),
        apiFetch<{ devices: Device[] }>("/devices"),
        apiFetch<{ user: any }>("/auth/me"),
      ]);
      setFields(f.fields);
      setDevice(d.devices[0] || null);
      setMe(m.user);
      store.setUser(m.user);
      if (f.fields.length && !selectedField) setSelectedField(f.fields[0]);
    } catch (e) {
      console.log("home load error", e);
    }
  }, [selectedField]);

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedField) return;
    const tick = async () => {
      try {
        const s = await apiFetch<Snapshot>(`/sensors/live?field_id=${selectedField.id}`);
        setSnap(s);
      } catch (e) {
        // ignore transient
      }
    };
    tick();
    if (pollRef.current) clearInterval(pollRef.current);
    if (device?.connected) {
      pollRef.current = setInterval(tick, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedField, device?.connected]);

  const toggleDevice = async () => {
    if (!device) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await apiFetch<{ device: Device }>(`/devices/${device.id}/toggle`, { method: "POST" });
    setDevice(res.device);
  };

  const control = async (action: "pause" | "start" | "stop" | "refresh" | "sync") => {
    if (!device) return;
    Haptics.selectionAsync();
    const form = new FormData();
    form.append("action", action);
    const res = await apiFetch<{ device: Device }>(`/devices/${device.id}/control`, {
      method: "POST",
      body: form as any,
    });
    setDevice(res.device);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.brandDark, COLORS.brand]} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{greeting()}</Text>
              <Text style={styles.userName}>{me?.full_name || "Farmer"}</Text>
            </View>
            <Pressable style={styles.iconBtn} testID="notifications-button">
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              <View style={styles.dot} />
            </Pressable>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(me?.full_name || "F K").split(" ").map((s: string) => s[0]).slice(0, 2).join("")}
              </Text>
            </View>
          </View>

          <Pressable
            testID="field-selector"
            style={styles.fieldPicker}
            onPress={() => setFieldPickerOpen(true)}
          >
            <Text style={styles.fieldPickerText}>{selectedField?.name || "Select Field"}</Text>
            <Ionicons name="chevron-down" size={18} color="#fff" />
          </Pressable>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        {snap?.alerts?.map((a, i) => (
          <View key={i} style={styles.alert} testID={`alert-${i}`}>
            <Ionicons name="warning" size={20} color={COLORS.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{a.title}</Text>
              <Text style={styles.alertMsg}>{a.message}</Text>
            </View>
          </View>
        ))}

        {device && (
          <View style={styles.card} testID="iot-device-card">
            <View style={styles.rowBetween}>
              <View style={styles.rowGap}>
                <Ionicons name="bluetooth" size={18} color={COLORS.brand} />
                <Text style={styles.cardTitle}>IoT Device</Text>
              </View>
              {device.connected ? (
                <View style={styles.rowGap}>
                  <View style={styles.rowGap}>
                    <Ionicons name="battery-half" size={14} color={COLORS.textMuted} />
                    <Text style={styles.mutedSm}>{device.battery}%</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: COLORS.successBg }]}>
                    <Text style={[styles.pillText, { color: COLORS.success }]}>Connected</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.pill, { backgroundColor: COLORS.dangerBg }]}>
                  <Text style={[styles.pillText, { color: COLORS.danger }]}>Disconnected</Text>
                </View>
              )}
            </View>
            <View style={{ marginTop: SPACING.md }}>
              <Text style={styles.mutedSm}>ID</Text>
              <Text style={styles.mono}>{device.serial}</Text>
            </View>

            {device.connected ? (
              <>
                <View style={styles.controls}>
                  <CtrlBtn icon="play" label={device.status === "running" ? "Start" : "Start"} onPress={() => control("start")} active={device.status === "running"} testID="ctrl-start" />
                  <CtrlBtn icon="pause" label="Pause" onPress={() => control("pause")} active={device.status === "paused"} testID="ctrl-pause" />
                  <CtrlBtn icon="stop" label="Stop" onPress={() => control("stop")} testID="ctrl-stop" />
                  <CtrlBtn icon="refresh" label="Refresh" onPress={() => control("refresh")} testID="ctrl-refresh" />
                  <CtrlBtn icon="sync" label="Sync" onPress={() => control("sync")} testID="ctrl-sync" />
                </View>
                <View style={[styles.rowBetween, { marginTop: SPACING.md }]}>
                  <Text style={styles.mutedSm}>
                    Status: <Text style={{ color: COLORS.brand, fontWeight: "700" }}>{device.status[0].toUpperCase() + device.status.slice(1)}</Text>
                  </Text>
                  <View style={styles.rowGap}>
                    <Ionicons name="cloud-done" size={14} color={COLORS.brand} />
                    <Text style={styles.mutedSm}>Cloud Synced</Text>
                  </View>
                </View>
              </>
            ) : (
              <Pressable style={styles.connectBtn} onPress={toggleDevice} testID="connect-device-button">
                <Ionicons name="bluetooth" size={18} color="#fff" />
                <Text style={styles.connectBtnText}>Connect Device</Text>
              </Pressable>
            )}
          </View>
        )}

        {device?.connected && snap ? (
          <>
            <View style={[styles.rowBetween, { marginTop: SPACING.lg, paddingHorizontal: SPACING.xs }]}>
              <Text style={styles.sectionTitle}>Live Sensor Data</Text>
              <View style={styles.rowGap}>
                <View style={styles.liveDot} />
                <Text style={styles.mutedSm}>
                  {new Date(snap.readings.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            </View>
            <View style={styles.grid}>
              <SensorTile icon="flask" iconColor="#6366F1" label="Nitrogen (N)" reading={snap.readings.nitrogen} testID="sensor-nitrogen" />
              <SensorTile icon="flash" iconColor="#A855F7" label="Phosphorus (P)" reading={snap.readings.phosphorus} testID="sensor-phosphorus" />
              <SensorTile icon="leaf" iconColor="#16A34A" label="Potassium (K)" reading={snap.readings.potassium} testID="sensor-potassium" />
              <SensorTile icon="water" iconColor="#0EA5E9" label="Soil Moisture" reading={snap.readings.moisture} testID="sensor-moisture" />
            </View>
          </>
        ) : (
          <View style={styles.emptyCard} testID="no-device-empty">
            <View style={styles.emptyIcon}>
              <Ionicons name="bluetooth" size={32} color={COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Device Connected</Text>
            <Text style={styles.emptyDesc}>Connect your RythuMitra device to view live soil data</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={fieldPickerOpen} transparent animationType="fade" onRequestClose={() => setFieldPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFieldPickerOpen(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Select Field</Text>
          {fields.map((f) => (
            <Pressable
              key={f.id}
              testID={`field-option-${f.id}`}
              style={[styles.modalItem, selectedField?.id === f.id && { backgroundColor: COLORS.brandLight }]}
              onPress={() => {
                setSelectedField(f);
                setFieldPickerOpen(false);
              }}
            >
              <Ionicons name="leaf" size={18} color={COLORS.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.modalItemName}>{f.name}</Text>
                <Text style={styles.mutedSm}>{f.preferred_crop} • {f.area_acres} acres • {f.soil_type}</Text>
              </View>
              {selectedField?.id === f.id && <Ionicons name="checkmark-circle" size={20} color={COLORS.brand} />}
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

function CtrlBtn({ icon, label, onPress, active, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.ctrlBtn, active && styles.ctrlBtnActive]}>
      <Ionicons name={icon} size={16} color={active ? "#fff" : COLORS.text} />
      <Text style={[styles.ctrlBtnLabel, active && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

function SensorTile({ icon, iconColor, label, reading, testID }: any) {
  const statusColor = reading.status === "Good" ? COLORS.success : reading.status === "Low" ? COLORS.warning : COLORS.danger;
  const statusBg = reading.status === "Good" ? COLORS.successBg : reading.status === "Low" ? COLORS.warningBg : COLORS.dangerBg;
  return (
    <View style={styles.tile} testID={testID}>
      <View style={styles.rowBetween}>
        <View style={[styles.tileIcon, { backgroundColor: iconColor + "22" }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <View style={[styles.pill, { backgroundColor: statusBg }]}>
          <Text style={[styles.pillText, { color: statusColor }]}>{reading.status}</Text>
        </View>
      </View>
      <Text style={styles.tileValue}>
        {reading.value} <Text style={styles.tileUnit}>{reading.unit}</Text>
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingBottom: SPACING.lg, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md },
  greeting: { color: "rgba(255,255,255,0.8)", fontSize: 11, letterSpacing: 1.2, fontWeight: "700" },
  userName: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 2 },
  iconBtn: { padding: 8, position: "relative" },
  dot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.warning },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800" },
  fieldPicker: {
    marginTop: SPACING.md,
    marginHorizontal: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.25)",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
  },
  fieldPickerText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  scroll: { padding: SPACING.lg, paddingBottom: 140 },
  alert: {
    flexDirection: "row",
    gap: SPACING.md,
    backgroundColor: COLORS.warningBg,
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  alertTitle: { color: COLORS.warning, fontWeight: "700" },
  alertMsg: { color: COLORS.text, marginTop: 2, fontSize: 13 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontWeight: "800", fontSize: 15, color: COLORS.text },
  mutedSm: { color: COLORS.textMuted, fontSize: 12 },
  mono: { fontFamily: "monospace", fontWeight: "700", color: COLORS.text, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  pillText: { fontSize: 11, fontWeight: "800" },
  connectBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.brand,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  connectBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  controls: { flexDirection: "row", marginTop: SPACING.md, gap: 6, flexWrap: "wrap" },
  ctrlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F2",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    flexGrow: 1,
    justifyContent: "center",
  },
  ctrlBtnActive: { backgroundColor: COLORS.brand },
  ctrlBtnLabel: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: SPACING.md },
  tile: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tileIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tileValue: { fontSize: 22, fontWeight: "800", color: COLORS.text, marginTop: SPACING.md },
  tileUnit: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  tileLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: "center",
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#F1F5F2",
    alignItems: "center", justifyContent: "center",
    marginBottom: SPACING.md,
  },
  emptyTitle: { fontWeight: "800", fontSize: 16, color: COLORS.text },
  emptyDesc: { color: COLORS.textMuted, textAlign: "center", marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: {
    position: "absolute", left: SPACING.lg, right: SPACING.lg, top: "20%",
    backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg,
  },
  modalTitle: { fontWeight: "800", fontSize: 16, marginBottom: SPACING.md, color: COLORS.text },
  modalItem: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.md,
  },
  modalItemName: { fontWeight: "700", color: COLORS.text },
});
