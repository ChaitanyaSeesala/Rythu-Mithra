import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useState } from "react";

import { COLORS } from "@/src/lib/api";
import VoiceSheet from "@/src/components/VoiceSheet";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const [voiceOpen, setVoiceOpen] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.brandDark,
          tabBarInactiveTintColor: "#9AA69E",
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopColor: COLORS.border,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="advice"
          options={{
            title: "Advice",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "bulb" : "bulb-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="planner"
          options={{
            title: "Planner",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "calendar" : "calendar-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* Floating mic FAB */}
      <Pressable
        testID="voice-fab"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setVoiceOpen(true);
        }}
        style={[styles.fab, { bottom: 60 + insets.bottom + 16 }]}
      >
        <Ionicons name="mic" size={24} color="#fff" />
      </Pressable>

      <VoiceSheet visible={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.brandDark,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
