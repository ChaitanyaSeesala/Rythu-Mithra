import { Ionicons } from "@expo/vector-icons";
import { AudioModule, RecordingPresets, useAudioRecorder } from "expo-audio";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";

import { BACKEND_URL, COLORS, RADIUS, SPACING, loadToken } from "@/src/lib/api";

export default function VoiceSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<"idle" | "recording" | "processing" | "done" | "error">("idle");
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (visible) {
      setPhase("idle");
      setTranscript("");
      setErrorMsg("");
    }
  }, [visible]);

  const start = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErrorMsg("Microphone permission required");
        setPhase("error");
        return;
      }
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase("recording");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      setErrorMsg(e.message || "Could not start recording");
      setPhase("error");
    }
  };

  const stopAndSend = async () => {
    try {
      setPhase("processing");
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No recording captured");

      const token = await loadToken();
      const form = new FormData();
      // Read file as blob-compatible object
      form.append("audio", {
        // @ts-ignore RN form data file shape
        uri,
        name: "voice.m4a",
        type: "audio/m4a",
      } as any);
      const res = await fetch(`${BACKEND_URL}/api/voice/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Transcription failed");
      setTranscript(data.text || "(no speech detected)");
      setPhase("done");
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {}
    } catch (e: any) {
      setErrorMsg(e.message || "Transcription failed");
      setPhase("error");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet} testID="voice-sheet">
        <View style={styles.handle} />
        <Text style={styles.title}>Voice Query</Text>
        <Text style={styles.subtitle}>Ask about your farm in your language</Text>

        <View style={styles.center}>
          {phase === "idle" && (
            <Pressable testID="voice-start" style={styles.micBig} onPress={start}>
              <Ionicons name="mic" size={44} color="#fff" />
            </Pressable>
          )}
          {phase === "recording" && (
            <Pressable testID="voice-stop" style={[styles.micBig, { backgroundColor: COLORS.danger }]} onPress={stopAndSend}>
              <Ionicons name="stop" size={40} color="#fff" />
            </Pressable>
          )}
          {phase === "processing" && (
            <View style={styles.micBig}>
              <Ionicons name="hourglass" size={40} color="#fff" />
            </View>
          )}
          {phase === "done" && (
            <View style={styles.transcriptBox} testID="voice-transcript">
              <Ionicons name="chatbubble-ellipses" size={22} color={COLORS.brand} />
              <Text style={styles.transcriptText}>{transcript}</Text>
            </View>
          )}
          {phase === "error" && (
            <View style={styles.transcriptBox}>
              <Ionicons name="alert-circle" size={22} color={COLORS.danger} />
              <Text style={[styles.transcriptText, { color: COLORS.danger }]}>{errorMsg}</Text>
            </View>
          )}

          <Text style={styles.hint}>
            {phase === "idle" && "Tap the mic to start"}
            {phase === "recording" && "Recording… tap to stop"}
            {phase === "processing" && "Transcribing your voice…"}
            {phase === "done" && "Transcription ready"}
            {phase === "error" && "Try again"}
          </Text>
        </View>

        <Pressable style={styles.closeBtn} onPress={onClose} testID="voice-close">
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, marginBottom: SPACING.lg },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  subtitle: { color: COLORS.textMuted, marginTop: 4 },
  center: { alignItems: "center", marginVertical: SPACING.xl },
  micBig: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.brand,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  hint: { marginTop: SPACING.lg, color: COLORS.textMuted, fontWeight: "600" },
  transcriptBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    backgroundColor: "#F1F5F2",
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  transcriptText: { flex: 1, color: COLORS.text, fontSize: 15, lineHeight: 22 },
  closeBtn: { alignItems: "center", padding: SPACING.md },
  closeText: { color: COLORS.brand, fontWeight: "700", fontSize: 15 },
});
