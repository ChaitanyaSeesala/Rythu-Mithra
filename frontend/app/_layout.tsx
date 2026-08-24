import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { store } from "@/src/lib/api";
import { initDatabase } from "@/src/lib/db";
import { useSync } from "@/src/hooks/useSync";

LogBox.ignoreAllLogs(true);

// Preserve prewarm logic for icon fonts.
SplashScreen.preventAutoHideAsync();

function AppEntry() {
  // Start the background sync engine
  useSync();

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await initDatabase();
        await store.init();
      } catch (e) {
        console.warn(e);
      } finally {
        setReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if ((loaded || error) && ready) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, ready]);

  if ((!loaded && !error) || !ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0F5D2A" />
        <AppEntry />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
