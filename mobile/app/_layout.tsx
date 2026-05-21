import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DragLayer } from "../src/components/DragLayer";
import { DragOverlayProvider, useDragOverlay } from "../src/state/dragOverlay";
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
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <DragOverlayProvider>
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
        </Stack>
        <DragOverlayRenderer />
      </DragOverlayProvider>
    </GestureHandlerRootView>
  );
}
