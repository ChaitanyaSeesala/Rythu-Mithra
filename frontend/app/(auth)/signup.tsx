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

import { COLORS, RADIUS, SPACING, apiFetch, saveToken, store } from "@/src/lib/api";

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name || !mobile || !password) {
      setError("Fill name, mobile, and password");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: any }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: name.trim(),
          mobile: mobile.trim(),
          email: email.trim(),
          password,
        }),
      });
      await saveToken(res.token);
      store.setUser(res.user);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setError(e.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.brandDark, COLORS.brand]} style={styles.header}>
        <SafeAreaView edges={["top"]}>
          <Pressable onPress={() => router.back()} style={styles.back} testID="back-to-login">
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>
          <View style={{ alignItems: "center", paddingBottom: SPACING.lg }}>
            <View style={styles.logoBox}>
              <Ionicons name="leaf" size={36} color="#fff" />
            </View>
            <Text style={styles.brandTitle}>Create Account</Text>
            <Text style={styles.brandTag}>Join RythuMitra today</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.formWrap}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Field label="Full Name" testID="signup-name-input" value={name} onChangeText={setName} placeholder="Ramesh Kumar" />
          <Field label="Mobile Number" testID="signup-mobile-input" value={mobile} onChangeText={setMobile} placeholder="9876543210" keyboardType="phone-pad" />
          <Field label="Email (optional)" testID="signup-email-input" value={email} onChangeText={setEmail} placeholder="you@farm.com" keyboardType="email-address" />
          <Field label="Password" testID="signup-password-input" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />

          {error && (
            <Text testID="signup-error" style={styles.errorText}>
              {error}
            </Text>
          )}

          <Pressable testID="signup-submit-button" style={[styles.primaryBtn, loading && { opacity: 0.6 }]} disabled={loading} onPress={submit}>
            <Text style={styles.primaryBtnText}>{loading ? "Creating…" : "Sign Up"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  secureTextEntry?: boolean;
  testID?: string;
}) {
  return (
    <View style={{ marginTop: SPACING.lg }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        testID={props.testID}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#9AA69E"
        keyboardType={props.keyboardType}
        secureTextEntry={props.secureTextEntry}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.brandDark },
  header: { paddingBottom: SPACING.xl, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  back: { padding: SPACING.md, marginLeft: SPACING.sm },
  logoBox: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  brandTitle: { color: "#fff", fontSize: 24, fontWeight: "800" },
  brandTag: { color: "#D3E8D9", fontSize: 14, marginTop: 4 },
  formWrap: { flex: 1, backgroundColor: COLORS.card, marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  form: { padding: SPACING.xl, paddingBottom: SPACING.xxl },
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
  primaryBtn: { backgroundColor: COLORS.brand, paddingVertical: 16, borderRadius: RADIUS.md, alignItems: "center", marginTop: SPACING.xl },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  errorText: { color: COLORS.danger, marginTop: SPACING.md, textAlign: "center", fontWeight: "600" },
});
