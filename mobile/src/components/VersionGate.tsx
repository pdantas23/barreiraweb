// === VersionGate ===
//
// Apresentacional: dado o VersionStatus, mostra
//  - "blocked"  → modal NÃO-dismissível (força atualizar pra continuar);
//  - "outdated" → banner dismissível no topo;
//  - "ok"       → nada.
// O botão "Atualizar" chama onUpdate (abre a store no container).

import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { VersionStatus } from "../version";

const C = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  cellBg: "#EEF2FF",
} as const;

type Props = {
  status: VersionStatus;
  onUpdate: () => void;
};

export const VersionGate = ({ status, onUpdate }: Props) => {
  const [dismissed, setDismissed] = useState(false);

  if (status === "ok") return null;

  if (status === "blocked") {
    // Não-dismissível: sem onRequestClose efetivo e sem botão de fechar.
    return (
      <Modal transparent visible animationType="fade" statusBarTranslucent>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Ionicons name="rocket" size={40} color={C.blue} style={{ marginBottom: 10 }} />
            <Text style={styles.title}>Nova versão disponível!</Text>
            <Text style={styles.body}>Atualize para continuar jogando Barreira.</Text>
            <Pressable
              accessibilityLabel="Atualizar agora"
              onPress={onUpdate}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaText}>Atualizar agora</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // outdated → banner dismissível
  if (dismissed) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.bannerText}>Atualização disponível — novidades te esperam 🎮</Text>
      <Pressable accessibilityLabel="Atualizar" onPress={onUpdate} style={styles.bannerBtn}>
        <Text style={styles.bannerBtnText}>Atualizar</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Dispensar aviso de atualização"
        onPress={() => setDismissed(true)}
        style={styles.bannerClose}
      >
        <Ionicons name="close" size={18} color={C.white} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "800", color: C.navy, marginBottom: 8, textAlign: "center" },
  body: { fontSize: 14, color: C.muted, textAlign: "center", marginBottom: 18 },
  cta: {
    backgroundColor: C.blue,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  ctaText: { color: C.white, fontWeight: "900", fontSize: 15 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.blue,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bannerText: { flex: 1, color: C.white, fontSize: 12, fontWeight: "700" },
  bannerBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  bannerBtnText: { color: C.white, fontWeight: "900", fontSize: 12 },
  bannerClose: { padding: 4 },
});
