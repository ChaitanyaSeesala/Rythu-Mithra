import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { COLORS, RADIUS, SPACING, AuthApi, store } from "@/src/lib/api";

export default function LoginScreen() {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!mobile || !password) {
      setError("Enter mobile and password");
      return;
    }
    setLoading(true);
    try {
      // Ported logic: Uses AuthApi.login which hits auth.php and saves to local DB
      const res = await AuthApi.login(mobile.trim(), password);

      if (res.farmer) {
        store.setUser(res.farmer);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e.message || "Login failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[COLORS.brandDark, COLORS.brand]}
        style={styles.header}
      >
        <SafeAreaView edges={["top"]} style={{ alignItems: "center" }}>
          <View style={styles.logoBox}>
            <Ionicons name="leaf" size={44} color="#fff" />
          </View>
          <Text style={styles.brandTitle}>RythuMitra</Text>
          <Text style={styles.brandCaption}>DBR INNOVATIVE TECH</Text>
          <Text style={styles.brandTag}>Smart Precision Farming</Text>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.formWrap}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{store.t("welcome_back")}</Text>
          <Text style={styles.subtitle}>{store.t("sign_in_sub")}</Text>

          <Text style={styles.label}>{store.t("mobile")}</Text>
          <TextInput
            testID="login-mobile-input"
            value={mobile}
            onChangeText={setMobile}
            placeholder="9876543210"
            placeholderTextColor="#9AA69E"
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: SPACING.lg }]}>{store.t("password")}</Text>
          <View style={styles.pwRow}>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9AA69E"
              secureTextEntry={!showPw}
              style={[styles.input, { flex: 1, marginTop: 0 }]}
            />
            <Pressable
              onPress={() => setShowPw((v) => !v)}
              style={styles.eyeBtn}
              testID="toggle-password-visibility"
            >
              <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={COLORS.textMuted} />
            </Pressable>
          </View>

          <Pressable style={styles.forgot} testID="forgot-password-link">
            <Text style={styles.forgotText}>{store.t("forgot")}</Text>
          </Pressable>

          {error && (
            <Text testID="login-error" style={styles.errorText}>
              {error}
            </Text>
          )}

          <Pressable
            testID="login-submit-button"
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            disabled={loading}
            onPress={submit}
          >
            <Text style={styles.primaryBtnText}>{loading ? "Signing in…" : store.t("login")}</Text>
          </Pressable>

          <Pressable
            testID="go-to-signup-button"
            style={styles.secondaryBtn}
            onPress={() => router.push("/(auth)/signup")}
          >
            <Text style={styles.secondaryBtnText}>{store.t("create_account")}</Text>
          </Pressable>

          <Text style={styles.terms}>
            By continuing you agree to our <Text style={styles.termsLink}>Terms & Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.brandDark },
  header: {
    paddingBottom: SPACING.xl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logoBox: {
    width: 84,
    height: 84,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  brandTitle: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: 0.5 },
  brandCaption: { color: "rgba(255,255,255,0.85)", fontSize: 11, letterSpacing: 2, marginTop: 4, fontWeight: "700" },
  brandTag: { color: "#D3E8D9", fontSize: 14, marginTop: 6 },
  formWrap: { flex: 1, backgroundColor: COLORS.card, marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  form: { padding: SPACING.xl, paddingBottom: SPACING.xxl },
  title: { fontSize: 24, fontWeight: "800", color: COLORS.text, marginTop: SPACING.sm },
  subtitle: { color: COLORS.textMuted, marginTop: 4, marginBottom: SPACING.xl },
  label: { color: COLORS.text, fontWeight: "700", fontSize: 13, marginBottom: SPACING.sm },
  input: {
    backgroundColor: "#F1F5F2",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pwRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  eyeBtn: { padding: SPACING.md },
  forgot: { alignSelf: "flex-end", marginTop: SPACING.md },
  forgotText: { color: COLORS.brand, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: COLORS.brand,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginTop: SPACING.lg,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondaryBtn: {
    marginTop: SPACING.md,
    paddingVertical: 15,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.brand,
    alignItems: "center",
  },
  secondaryBtnText: { color: COLORS.brand, fontWeight: "700", fontSize: 16 },
  terms: { textAlign: "center", color: COLORS.textMuted, marginTop: SPACING.xl, fontSize: 12 },
  termsLink: { color: COLORS.brand, fontWeight: "600" },
  errorText: { color: COLORS.danger, marginTop: SPACING.md, textAlign: "center", fontWeight: "600" },
});
