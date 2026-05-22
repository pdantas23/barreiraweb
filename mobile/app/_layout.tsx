import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DragLayer } from "../src/components/DragLayer";
import { initClientId } from "../src/net/clientId";
import { DragOverlayProvider, useDragOverlay } from "../src/state/dragOverlay";
import { ProfileProvider } from "../src/state/profile";
import { theme } from "../src/theme";

// O overlay é renderizado COMO IRMÃO DO STACK, dentro do GestureHandlerRootView.
// Isso garante que position:absolute do DragLayer é relativo ao MESMO root
// que o gesture-handler usa pra reportar e.absoluteX/Y. Coords coincidem 1:1
// — sem header offset, sem statusbar offset, sem mismatch.
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
  // Bootstrap síncrono do clientId: lê/gera ANTES de renderizar qualquer
  // tela que possa chamar getSocket(). Sem isso, getClientId() ficaria
  // sem cache e cairia no warning "chamado antes do initClientId".
  const [bootstrapped, setBootstrapped] = useState(false);
  useEffect(() => {
    initClientId().finally(() => setBootstrapped(true));
  }, []);

  if (!bootstrapped) {
    // Tela vazia durante o bootstrap (geralmente <50ms).
    // O splash do Expo cobre a transição visualmente.
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <DragOverlayProvider>
        <ProfileProvider>
          <StatusBar style="light" />
          <Stack
            // Colocando headerShown: false aqui, ele remove o cabeçalho de TODAS as telas!
            screenOptions={{
              headerShown: false,
              headerStyle: { backgroundColor: theme.bg },
              headerTintColor: theme.textPrimary,
              contentStyle: { backgroundColor: theme.bg },
            }}
          >
            {/* Declarando as telas só por garantia */}
            <Stack.Screen name="index" />
            <Stack.Screen name="game" />
            <Stack.Screen name="online" />
            <Stack.Screen name="online-game" />
          </Stack>
          <DragOverlayRenderer />
        </ProfileProvider>
      </DragOverlayProvider>
    </GestureHandlerRootView>
  );
}
