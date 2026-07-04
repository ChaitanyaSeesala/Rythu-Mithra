import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { store } from "@/src/lib/api";

LogBox.ignoreAllLogs(true);

// Preserve prewarm logic for icon fonts.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  const [storeReady, setStoreReady] = useState(false);

  useEffect(() => {
    store.init().finally(() => setStoreReady(true));
  }, []);

  useEffect(() => {
    if ((loaded || error) && storeReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, storeReady]);

  if ((!loaded && !error) || !storeReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0F5D2A" />
        <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
