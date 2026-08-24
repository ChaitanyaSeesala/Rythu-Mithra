import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  PermissionsAndroid,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { COLORS, RADIUS, SPACING, store, FieldDto } from "@/src/lib/api";
import { ble, BleData } from "@/src/lib/ble";
import { FieldDb, db } from "@/src/lib/db";

export default function HomeScreen() {
  const [fields, setFields] = useState<FieldDto[]>([]);
  const [selectedField, setSelectedField] = useState<FieldDto | null>(null);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [bleState, setBleState] = useState("Disconnected");
  const [sensingState, setSensingState] = useState("IDLE");
  const [readings, setReadings] = useState<Record<number, string>>({});

  useEffect(() => {
    loadFields();

    // Listen for live BLE data
    ble.onData((data: BleData) => {
      if (data.status === "SENSOR_DATA" && data.parameterId) {
        setReadings(prev => ({ ...prev, [data.parameterId!]: data.value || "0" }));
        saveReadingLocally(data);
      } else if (["STARTED", "STOPPED", "PAUSED"].includes(data.status)) {
        setSensingState(data.status);
      }
    });

    return () => ble.disconnect();
  }, []);

  const loadFields = async () => {
    const f = await FieldDb.getFields();
    setFields(f);
    if (f.length > 0) setSelectedField(f[0]);
  };

  const saveReadingLocally = async (data: BleData) => {
    if (!selectedField) return;
    await db.runAsync(
      'INSERT INTO sensor_readings (deviceId, locationId, parameterId, value, timestamp, fieldId) VALUES (?, ?, ?, ?, ?, ?)',
      [data.deviceId, data.locationId, data.parameterId!, data.value!, data.timestamp || Math.floor(Date.now()/1000), selectedField.field_id.toString()]
    );
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return granted['android.permission.BLUETOOTH_SCAN'] === 'granted' &&
               granted['android.permission.BLUETOOTH_CONNECT'] === 'granted';
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  };

  const toggleConnection = async () => {
    if (bleState === "Connected") {
      ble.disconnect();
      setBleState("Disconnected");
    } else {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        Alert.alert("Permission Denied", "Bluetooth and Location permissions are required to scan.");
        return;
      }

      setBleState("Scanning...");
      await ble.startScan(
        () => setBleState("Connected"),
        (error) => {
          setBleState("Disconnected");
          Alert.alert("Scan Error", error);
        }
      );
    }
  };

  const sendCommand = (cmd: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ble.sendCommand(cmd);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.brandDark, COLORS.brand]} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>GOOD DAY</Text>
              <Text style={styles.userName}>{store.user?.farmer_name || "Farmer"}</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {store.user?.farmer_name?.split(" ").map((s: string) => s[0]).join("") || "RM"}
              </Text>
            </View>
          </View>

          <Pressable style={styles.fieldPicker} onPress={() => setFieldPickerOpen(true)}>
            <Text style={styles.fieldPickerText}>{selectedField?.Field_Name || "Select Field"}</Text>
            <Ionicons name="chevron-down" size={18} color="#fff" />
          </Pressable>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.rowGap}>
              <Ionicons name="bluetooth" size={18} color={COLORS.brand} />
              <Text style={styles.cardTitle}>IoT Node</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: bleState === "Connected" ? COLORS.successBg : COLORS.dangerBg }]}>
              <Text style={[styles.pillText, { color: bleState === "Connected" ? COLORS.success : COLORS.danger }]}>
                {bleState}
              </Text>
            </View>
          </View>

          {bleState === "Connected" ? (
            <View style={styles.controls}>
              <CtrlBtn icon="play" label="Start" onPress={() => sendCommand("START")} active={sensingState === "STARTED"} />
              <CtrlBtn icon="pause" label="Pause" onPress={() => sendCommand("PAUSE")} active={sensingState === "PAUSED"} />
              <CtrlBtn icon="stop" label="Stop" onPress={() => sendCommand("STOP")} active={sensingState === "STOPPED"} />
            </View>
          ) : (
            <Pressable style={styles.connectBtn} onPress={toggleConnection}>
              <Text style={styles.connectBtnText}>Connect Device</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.rowBetween, { marginTop: SPACING.lg }]}>
          <Text style={styles.sectionTitle}>Live Sensor Data</Text>
          {bleState === "Connected" && <View style={styles.liveDot} />}
        </View>

        <View style={styles.grid}>
          <SensorTile label="Nitrogen (N)" value={readings[1] || "--"} unit="mg/kg" />
          <SensorTile label="Phosphorus (P)" value={readings[2] || "--"} unit="mg/kg" />
          <SensorTile label="Potassium (K)" value={readings[3] || "--"} unit="mg/kg" />
          <SensorTile label="Moisture" value={readings[4] || "--"} unit="%" />
          <SensorTile label="pH Level" value={readings[5] || "--"} unit="pH" />
          <SensorTile label="Temperature" value={readings[7] || "--"} unit="°C" />
        </View>
      </ScrollView>

      <Modal visible={fieldPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setFieldPickerOpen(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Select Field</Text>
          {fields.map((f) => (
            <Pressable key={f.field_id} style={styles.modalItem} onPress={() => { setSelectedField(f); setFieldPickerOpen(false); }}>
              <Text style={styles.modalItemName}>{f.Field_Name}</Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

function CtrlBtn({ icon, label, onPress, active }: any) {
  return (
    <Pressable onPress={onPress} style={[styles.ctrlBtn, active && styles.ctrlBtnActive]}>
      <Ionicons name={icon} size={16} color={active ? "#fff" : COLORS.text} />
      <Text style={[styles.ctrlBtnLabel, active && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

function SensorTile({ label, value, unit }: any) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value} <Text style={styles.tileUnit}>{unit}</Text></Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { paddingBottom: SPACING.lg, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.md },
  greeting: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700" },
  userName: { color: "#fff", fontSize: 22, fontWeight: "800" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "800" },
  fieldPicker: { marginTop: SPACING.md, marginHorizontal: SPACING.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: RADIUS.md, padding: 12 },
  fieldPickerText: { color: "#fff", fontWeight: "700" },
  scroll: { padding: SPACING.lg },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontWeight: "800", color: COLORS.text },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  pillText: { fontSize: 11, fontWeight: "800" },
  controls: { flexDirection: "row", marginTop: SPACING.md, gap: 6 },
  ctrlBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F1F5F2", padding: 10, borderRadius: RADIUS.md, justifyContent: "center" },
  ctrlBtnActive: { backgroundColor: COLORS.brand },
  ctrlBtnLabel: { fontSize: 12, fontWeight: "700" },
  connectBtn: { marginTop: SPACING.md, backgroundColor: COLORS.brand, padding: 14, borderRadius: RADIUS.md, alignItems: "center" },
  connectBtnText: { color: "#fff", fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: SPACING.md },
  tile: { width: "48%", backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  tileValue: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  tileUnit: { fontSize: 12, color: COLORS.textMuted },
  tileLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalCard: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 16 },
  modalItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalItemName: { fontSize: 16, fontWeight: "600" },
});
