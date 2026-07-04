import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { COLORS, RADIUS, SPACING, apiFetch } from "@/src/lib/api";

type FieldT = { id: string; name: string; preferred_crop: string };
type Recommendation = { title: string; detail: string; priority: string };
type Result = {
  readings: any;
  warning: string | null;
  summary: string;
  recommendations: Recommendation[];
  model_used: string;
};

const REC_TYPES = [
  { key: "fertilizer", label: "Fertilizer Recommendation" },
  { key: "crop", label: "Crop Recommendation" },
  { key: "irrigation", label: "Irrigation Advice" },
];

const MODELS = [
  { key: "claude", label: "RythuMitra AI v2 (Claude)" },
  { key: "rule", label: "Rule-based Engine" },
];

export default function AdviceScreen() {
  const [fields, setFields] = useState<FieldT[]>([]);
  const [selectedField, setSelectedField] = useState<FieldT | null>(null);
  const [recType, setRecType] = useState(REC_TYPES[0]);
  const [modelSel, setModelSel] = useState(MODELS[0]);
  const [picker, setPicker] = useState<null | "field" | "type" | "model">(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ fields: FieldT[] }>("/fields").then((f) => {
      setFields(f.fields);
      if (f.fields[0]) setSelectedField(f.fields[0]);
    });
  }, []);

  const generate = async () => {
    if (!selectedField) return;
    setErr(null);
    setLoading(true);
    setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const r = await apiFetch<Result>("/advice/generate", {
        method: "POST",
        body: JSON.stringify({
          field_id: selectedField.id,
          recommendation_type: recType.key,
          model: modelSel.key,
        }),
      });
      setResult(r);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setErr(e.message || "Failed to generate advice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.brandDark, COLORS.brand]} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <View style={{ padding: SPACING.lg }}>
            <Text style={styles.title}>Fertilizer Advice</Text>
            <Text style={styles.sub}>AI-powered soil nutrition plan</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>CONFIGURE QUERY</Text>

          <DropdownField label="Recommendation Type" value={recType.label} onPress={() => setPicker("type")} testID="dropdown-type" />
          <DropdownField label="AI Model / API" value={modelSel.label} onPress={() => setPicker("model")} testID="dropdown-model" />
          <DropdownField label="Field" value={selectedField?.name || "Select field"} onPress={() => setPicker("field")} testID="dropdown-field" />

          <Pressable
            testID="get-plan-button"
            style={[styles.cta, loading && { opacity: 0.6 }]}
            disabled={loading || !selectedField}
            onPress={generate}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="bulb" size={18} color="#fff" />
                <Text style={styles.ctaText}>Get Fertilizer Plan</Text>
              </>
            )}
          </Pressable>
          {err && <Text style={styles.err}>{err}</Text>}
        </View>

        {result && (
          <>
            <View style={styles.card} testID="soil-health-card">
              <Text style={styles.sectionLabel}>SOIL HEALTH STATUS</Text>
              <View style={styles.row3}>
                <NutrientTile value={result.readings.nitrogen.value} unit="mg/kg" label="N" status={result.readings.nitrogen.status} />
                <NutrientTile value={result.readings.phosphorus.value} unit="mg/kg" label="P" status={result.readings.phosphorus.status} />
                <NutrientTile value={result.readings.potassium.value} unit="mg/kg" label="K" status={result.readings.potassium.status} />
              </View>

              {result.warning && (
                <View style={styles.warnBanner} testID="warning-banner">
                  <Ionicons name="warning" size={18} color={COLORS.warning} />
                  <Text style={styles.warnText}>{result.warning}</Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionLabel}>RECOMMENDATIONS</Text>
                <View style={styles.modelBadge}>
                  <Ionicons name="sparkles" size={12} color={COLORS.brand} />
                  <Text style={styles.modelBadgeText}>{result.model_used === "claude" ? "AI" : "Rules"}</Text>
                </View>
              </View>
              {result.summary ? <Text style={styles.summary}>{result.summary}</Text> : null}
              {result.recommendations.map((r, i) => (
                <View key={i} style={styles.recCard} testID={`recommendation-${i}`}>
                  <View style={[styles.priorityDot, {
                    backgroundColor: r.priority === "high" ? COLORS.danger : r.priority === "medium" ? COLORS.warning : COLORS.brand
                  }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recTitle}>{r.title}</Text>
                    <Text style={styles.recDetail}>{r.detail}</Text>
                    <View style={[styles.priorityPill, {
                      backgroundColor: r.priority === "high" ? COLORS.dangerBg : r.priority === "medium" ? COLORS.warningBg : COLORS.successBg
                    }]}>
                      <Text style={[styles.priorityText, {
                        color: r.priority === "high" ? COLORS.danger : r.priority === "medium" ? COLORS.warning : COLORS.success
                      }]}>{r.priority.toUpperCase()} PRIORITY</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <PickerModal
        visible={picker !== null}
        title={picker === "field" ? "Select Field" : picker === "type" ? "Select Recommendation Type" : "Select AI Model"}
        onClose={() => setPicker(null)}
        options={
          picker === "field"
            ? fields.map((f) => ({ key: f.id, label: `${f.name} · ${f.preferred_crop}` }))
            : picker === "type"
            ? REC_TYPES
            : MODELS
        }
        onSelect={(opt) => {
          if (picker === "field") setSelectedField(fields.find((f) => f.id === opt.key) || null);
          else if (picker === "type") setRecType(REC_TYPES.find((t) => t.key === opt.key)!);
          else if (picker === "model") setModelSel(MODELS.find((m) => m.key === opt.key)!);
          setPicker(null);
        }}
      />
    </View>
  );
}

function DropdownField({ label, value, onPress, testID }: any) {
  return (
    <View style={{ marginTop: SPACING.md }}>
      <Text style={styles.dfLabel}>{label}</Text>
      <Pressable testID={testID} style={styles.dfBox} onPress={onPress}>
        <Text style={styles.dfValue}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
      </Pressable>
    </View>
  );
}

function NutrientTile({ value, unit, label, status }: any) {
  const color = status === "Good" ? COLORS.brand : status === "Low" ? COLORS.danger : COLORS.warning;
  const bg = status === "Good" ? "#F0FDF4" : status === "Low" ? "#FEF2F2" : "#FFFBEB";
  return (
    <View style={[styles.nutrTile, { backgroundColor: bg }]}>
      <Text style={[styles.nutrValue, { color }]}>{value}</Text>
      <Text style={styles.nutrUnit}>{unit}</Text>
      <View style={styles.divider} />
      <Text style={styles.nutrLabel}>{label}: {status === "Good" ? "Normal" : status}</Text>
    </View>
  );
}

function PickerModal({ visible, onClose, title, options, onSelect }: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>{title}</Text>
        {options.map((o: any) => (
          <Pressable key={o.key} testID={`picker-${o.key}`} style={styles.modalItem} onPress={() => onSelect(o)}>
            <Text style={styles.modalItemName}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  sub: { color: "rgba(255,255,255,0.85)", marginTop: 4 },
  scroll: { padding: SPACING.lg, paddingBottom: 140 },
  card: { backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  sectionLabel: { color: COLORS.brand, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  dfLabel: { color: COLORS.text, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  dfBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  dfValue: { color: COLORS.text, fontWeight: "600" },
  cta: {
    marginTop: SPACING.lg, backgroundColor: COLORS.brand, borderRadius: RADIUS.md,
    paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  err: { color: COLORS.danger, marginTop: SPACING.md, textAlign: "center" },
  row3: { flexDirection: "row", justifyContent: "space-between", marginTop: SPACING.md, gap: SPACING.sm },
  nutrTile: { flex: 1, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: "center" },
  nutrValue: { fontSize: 24, fontWeight: "800" },
  nutrUnit: { color: COLORS.textMuted, fontSize: 11 },
  divider: { height: 1, backgroundColor: COLORS.border, width: "100%", marginVertical: 6 },
  nutrLabel: { fontSize: 11, color: COLORS.text, fontWeight: "700" },
  warnBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    backgroundColor: COLORS.warningBg, borderRadius: RADIUS.md, padding: SPACING.md,
    marginTop: SPACING.md, borderWidth: 1, borderColor: "#FCD34D",
  },
  warnText: { flex: 1, color: COLORS.text, fontSize: 13 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modelBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.brandLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill,
  },
  modelBadgeText: { color: COLORS.brand, fontWeight: "800", fontSize: 10 },
  summary: { color: COLORS.text, marginTop: SPACING.md, fontStyle: "italic" },
  recCard: {
    flexDirection: "row", gap: SPACING.md,
    backgroundColor: "#F7F9F7", borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.md,
  },
  priorityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  recTitle: { color: COLORS.text, fontWeight: "800", fontSize: 14 },
  recDetail: { color: COLORS.textMuted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  priorityPill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, marginTop: SPACING.sm },
  priorityText: { fontSize: 10, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: {
    position: "absolute", left: SPACING.lg, right: SPACING.lg, top: "25%",
    backgroundColor: "#fff", borderRadius: RADIUS.lg, padding: SPACING.lg,
  },
  modalTitle: { fontWeight: "800", fontSize: 16, marginBottom: SPACING.md, color: COLORS.text },
  modalItem: { padding: SPACING.md, borderRadius: RADIUS.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalItemName: { color: COLORS.text, fontWeight: "600" },
});
