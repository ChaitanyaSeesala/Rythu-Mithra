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
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { COLORS, RADIUS, SPACING, AuthApi, store } from "@/src/lib/api";

export default function SignupScreen() {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async () => {
    if (mobile.length < 10) {
      setError("Enter a valid mobile number");
      return;
    }
    setLoading(true);
    try {
      await AuthApi.sendOtp(mobile);
      setOtpSent(true);
      setError(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!otp || !password) {
      setError("Enter OTP and Password");
      return;
    }
    setLoading(true);
    try {
      const res = await AuthApi.signup(mobile, otp, password);
      if (res.farmer) store.setUser(res.farmer);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.brandDark, COLORS.brand]} style={styles.header}>
        <SafeAreaView edges={["top"]} style={{ alignItems: "center" }}>
          <Text style={styles.headerTitle}>{store.t("create_account")}</Text>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.formWrap}>
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.label}>{store.t("mobile")}</Text>
          <TextInput
            value={mobile}
            onChangeText={setMobile}
            placeholder="9876543210"
            keyboardType="phone-pad"
            style={styles.input}
            editable={!otpSent}
          />

          {otpSent && (
            <>
              <Text style={[styles.label, { marginTop: SPACING.lg }]}>Enter OTP</Text>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                keyboardType="number-pad"
                style={styles.input}
              />

              <Text style={[styles.label, { marginTop: SPACING.lg }]}>{store.t("password")}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 6 characters"
                secureTextEntry
                style={styles.input}
              />
            </>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={otpSent ? handleSignup : handleSendOtp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>{otpSent ? store.t("signup") : "Verify Mobile"}</Text>
            )}
          </Pressable>

          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Back to Login</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.brandDark },
  header: { paddingBottom: SPACING.xl },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginTop: SPACING.md },
  formWrap: { flex: 1, backgroundColor: COLORS.card, marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  form: { padding: SPACING.xl },
  label: { color: COLORS.text, fontWeight: "700", fontSize: 13, marginBottom: SPACING.sm },
  input: { backgroundColor: "#F1F5F2", borderRadius: RADIUS.md, padding: 14, fontSize: 16, borderWidth: 1, borderColor: COLORS.border },
  errorText: { color: COLORS.danger, marginTop: SPACING.md, textAlign: "center", fontWeight: "600" },
  primaryBtn: { backgroundColor: COLORS.brand, padding: 16, borderRadius: RADIUS.md, alignItems: "center", marginTop: SPACING.xl },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  backBtn: { marginTop: SPACING.lg, alignItems: "center" },
  backBtnText: { color: COLORS.brand, fontWeight: "600" },
});
