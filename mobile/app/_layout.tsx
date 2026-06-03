import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import { DragLayer } from "../src/components/DragLayer";
import { SplashOverlay } from "../src/components/SplashOverlay";
import { AppGate } from "../src/components/AppGate";
import { initClientId } from "../src/net/clientId";
import { DragOverlayProvider, useDragOverlay } from "../src/state/dragOverlay";
import { AudioSettingsProvider } from "../src/state/audioSettings";
import { ProfileProvider } from "../src/state/profile";
import { AuthProvider } from "../src/state/auth";
import { theme } from "../src/theme";

const DragOverlayRenderer = () => {
  const { overlay, dragX, dragY } = useDragOverlay();
  if (!overlay) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <DragLayer
        type={overlay.type}
        dragX={dragX}
        dragY={dragY}
        layout={overlay.layout}
      />
    </View>
  );
};

export default function RootLayout() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [fontsLoaded] = useFonts({ BebasNeue_400Regular });

  useEffect(() => {
    initClientId().finally(() => setBootstrapped(true));
  }, []);

  if (!bootstrapped) {
    return <View style={{ flex: 1, backgroundColor: "#000000" }} />;
  }
  void fontsLoaded;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <DragOverlayProvider>
        <AudioSettingsProvider>
          <AuthProvider>
            <ProfileProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  headerStyle: { backgroundColor: theme.bg },
                  headerTintColor: theme.textPrimary,
                  contentStyle: { backgroundColor: theme.bg },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="game" />
                <Stack.Screen name="online" />
                <Stack.Screen name="online-game" />
                <Stack.Screen name="amigos" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="privacy" />
                <Stack.Screen name="perfil" />
                <Stack.Screen name="auth" options={{ animation: "fade" }} />
              </Stack>
              <DragOverlayRenderer />
              <AppGate />
              <SplashOverlay />
            </ProfileProvider>
          </AuthProvider>
        </AudioSettingsProvider>
      </DragOverlayProvider>
    </GestureHandlerRootView>
  );
}
