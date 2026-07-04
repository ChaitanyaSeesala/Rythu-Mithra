import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem("rm_token");
      setToken(t);
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#1E8A3E" size="large" />
      </View>
    );
  }
  return token ? <Redirect href="/(tabs)/home" /> : <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F5D2A", alignItems: "center", justifyContent: "center" },
});
