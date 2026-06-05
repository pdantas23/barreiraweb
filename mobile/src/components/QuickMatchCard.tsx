// Card "Partida Rápida" (matchmaking online) — fica acima da lista de salas.
// Espelha o card da web: gradiente azul, raio, título/subtítulo e botão JOGAR.

import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  white: "#FFFFFF",
} as const;

export function QuickMatchCard({
  onPlay,
  disabled = false,
}: {
  onPlay: () => void;
  disabled?: boolean;
}) {
  return (
    <LinearGradient
      colors={[C.blue, C.blueLight]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Cronômetro decorativo esmaecido */}
      <Ionicons
        name="stopwatch-outline"
        size={120}
        color={C.white}
        style={styles.deco}
      />

      <View style={styles.iconCircle}>
        <Ionicons name="flash" size={24} color={C.white} />
      </View>

      <View style={styles.texts}>
        <Text style={styles.title}>Partida Rápida</Text>
        <Text style={styles.subtitle}>Encontre um adversário em segundos</Text>
      </View>

      <Pressable
        onPress={onPlay}
        disabled={disabled}
        accessibilityLabel="Buscar partida rápida"
        accessibilityRole="button"
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }, disabled && { opacity: 0.6 }]}
      >
        <Text style={styles.btnText}>JOGAR</Text>
        <Ionicons name="arrow-forward" size={16} color={C.blue} />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: C.blue,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  deco: { position: "absolute", right: -14, top: -8, opacity: 0.14 },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, minWidth: 0 },
  title: { color: C.white, fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600", marginTop: 2 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.white,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  btnText: { color: C.blue, fontWeight: "900", fontSize: 13, letterSpacing: 0.5 },
});
