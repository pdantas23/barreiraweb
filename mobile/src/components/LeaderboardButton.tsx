// Botão de troféu (leaderboard) autocontido: ícone na navbar + modal do ranking.
// Usado no TopBar (à esquerda do nome do usuário). Antes o ranking só abria pelo
// header do lobby; agora vive na navbar principal, em qualquer tela com TopBar.

import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Leaderboard } from "./Leaderboard";
import { playButtonSound } from "../hooks/useButtonSound";

const C = {
  white: "#FFFFFF",
  muted: "#9AAACA",
  blue: "#3D6FFF",
  gold: "#F4B619",
  cellBg: "#EEF2FF",
} as const;

export function LeaderboardButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => { playButtonSound(); setOpen(true); }}
        accessibilityLabel="Ver leaderboard"
        accessibilityRole="button"
        hitSlop={6}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
      >
        <Ionicons name="trophy" size={16} color={C.gold} />
      </Pressable>

      {/* Só monta o conteúdo (e o fetch do Leaderboard) quando aberto. */}
      <Modal
        transparent
        visible={open}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        {open && (
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
              <Pressable
                onPress={() => { playButtonSound(); setOpen(false); }}
                accessibilityLabel="Fechar"
                style={({ pressed }) => [styles.close, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="close" size={20} color={C.muted} />
              </Pressable>
              <View>
                <Leaderboard />
              </View>
            </Pressable>
          </Pressable>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: { width: "100%", maxWidth: 360 },
  close: {
    position: "absolute",
    top: -14,
    right: -6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.cellBg,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowColor: C.blue,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
});
