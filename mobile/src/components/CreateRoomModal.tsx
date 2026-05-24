import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

const L = {
  blue: "#3D6FFF",
  blueLight: "#6B9FFF",
  navy: "#1A2A4A",
  muted: "#9AAACA",
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
  border: "#DDEAFF",
  cellBg: "#EEF2FF",
  red: "#FF3D6F",
};

export type ColorChoice = "cyan" | "random" | "red";

export type CreateRoomConfig = {
  color: ColorChoice;
  isPrivate: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (config: CreateRoomConfig) => void;
};

type ColorOption = {
  value: ColorChoice;
  label: string;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// A cor é só cosmética — independente da escolha, você sempre joga
// saindo de baixo do tabuleiro (perspectiva local fixa).
const COLOR_OPTIONS: ColorOption[] = [
  {
    value: "cyan",
    label: "Ciano",
    accent: L.blue,
    icon: "ellipse",
  },
  {
    value: "random",
    label: "Random",
    accent: L.muted,
    icon: "shuffle",
  },
  {
    value: "red",
    label: "Vermelho",
    accent: L.red,
    icon: "ellipse",
  },
];

export const CreateRoomModal = ({ visible, onClose, onConfirm }: Props) => {
  const [color, setColor] = useState<ColorChoice>("random");
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (visible) {
      setColor("random");
      setIsPrivate(false);
    }
  }, [visible]);

  const onTogglePrivate = () => setIsPrivate((p) => !p);

  const onSubmit = () => onConfirm({ color, isPrivate });

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Animated.View entering={FadeInDown.duration(340).delay(40)} style={styles.cardWrap}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.title}>Criar sala</Text>
            <Text style={styles.subtitle}>Configure sua partida online.</Text>

            {/* Seleção de cor (cosmética — você sempre joga saindo de baixo) */}
            <Text style={styles.sectionLabel}>Sua cor</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((opt) => {
                const selected = color === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setColor(opt.value)}
                    style={[
                      styles.colorCard,
                      selected && { borderColor: opt.accent, backgroundColor: `${opt.accent}14` },
                    ]}
                  >
                    <View
                      style={[
                        styles.colorIcon,
                        { borderColor: opt.accent, backgroundColor: selected ? opt.accent : "transparent" },
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={18}
                        color={selected ? "#0b1014" : opt.accent}
                      />
                    </View>
                    <Text style={styles.colorLabel}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.colorHint}>
              Você sempre joga saindo de baixo do tabuleiro.
            </Text>

            {/* Checkbox privada — a senha real é gerada pelo server e
                aparece na tela de espera (game.password do RoomDetail). */}
            <Pressable style={styles.privateRow} onPress={onTogglePrivate}>
              <View
                style={[
                  styles.checkbox,
                  isPrivate && { backgroundColor: L.blue, borderColor: L.blue },
                ]}
              >
                {isPrivate && <Ionicons name="checkmark" size={16} color={L.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.privateLabel}>Sala privada</Text>
                <Text style={styles.privateSub}>
                  O servidor gera uma senha — você compartilha com seu convidado
                </Text>
              </View>
            </Pressable>

            {/* Ações */}
            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
              >
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={onSubmit}
                style={({ pressed }) => [{ flex: 1.4 }, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={[L.blue, L.blueLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnPrimary}
                >
                  <Text style={styles.btnPrimaryText}>Criar</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,42,74,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  cardWrap: {
    width: "100%",
    maxWidth: 420,
  },
  card: {
    width: "100%",
    backgroundColor: L.cardBg,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: L.border,
    shadowColor: L.blue,
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  title: {
    color: L.navy,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: L.muted,
    fontSize: 13,
    marginBottom: 18,
  },
  sectionLabel: {
    color: L.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  colorRow: {
    flexDirection: "row",
    gap: 8,
  },
  colorCard: {
    flex: 1,
    backgroundColor: L.cellBg,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: L.border,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  colorIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  colorLabel: {
    color: L.navy,
    fontSize: 13,
    fontWeight: "700",
  },
  colorHint: {
    color: L.muted,
    fontSize: 11,
    marginTop: 10,
    fontStyle: "italic",
    textAlign: "center",
  },
  privateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: L.cellBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: L.border,
    padding: 14,
    marginTop: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: L.border,
    alignItems: "center",
    justifyContent: "center",
  },
  privateLabel: {
    color: L.navy,
    fontSize: 14,
    fontWeight: "700",
  },
  privateSub: {
    color: L.muted,
    fontSize: 11,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: L.white,
    borderWidth: 1,
    borderColor: L.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    color: L.navy,
    fontWeight: "700",
    fontSize: 14,
  },
  btnPrimary: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: L.white,
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
