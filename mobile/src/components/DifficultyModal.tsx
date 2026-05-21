import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export type Difficulty = "easy" | "medium" | "hard";

type Option = {
  value: Difficulty;
  label: string;
  description: string;
  // Cor do "facho" colorido na esquerda do card — comunica intensidade.
  accent: string;
};

const OPTIONS: Option[] = [
  {
    value: "easy",
    label: "Fácil",
    description: "Bot relaxa, joga entre as 6 melhores opções.",
    accent: "#5cd97a",
  },
  {
    value: "medium",
    label: "Médio",
    description: "Bot greedy clássico: minimiza sua distância, maximiza a sua.",
    accent: "#f0c14b",
  },
  {
    value: "hard",
    label: "Difícil",
    description: "Minimax com alfa-beta: pensa 2 lances à frente.",
    accent: "#f25f5c",
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (difficulty: Difficulty) => void;
};

export const DifficultyModal = ({ visible, onClose, onConfirm }: Props) => {
  const [selected, setSelected] = useState<Difficulty>("medium");

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Pressable interno só pra "consumir" o tap e impedir que o backdrop feche */}
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
          <Text style={styles.title}>Escolha a dificuldade</Text>
          <Text style={styles.subtitle}>Você joga contra a CPU.</Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => {
              const isSelected = selected === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setSelected(opt.value)}
                  style={[
                    styles.option,
                    isSelected && { borderColor: opt.accent },
                  ]}
                >
                  <View style={[styles.accent, { backgroundColor: opt.accent }]} />
                  <View style={styles.optionBody}>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      isSelected && { borderColor: opt.accent, backgroundColor: opt.accent },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
            >
              <Text style={styles.btnSecondaryText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(selected)}
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.btnPrimaryText}>Jogar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: theme.boardBg,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "#2a2a35",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  title: {
    color: theme.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: theme.textMuted,
    fontSize: 13,
    marginBottom: 18,
  },
  options: {
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f1f27",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#2a2a35",
    paddingVertical: 12,
    paddingRight: 14,
    overflow: "hidden",
  },
  accent: {
    width: 6,
    alignSelf: "stretch",
    marginRight: 12,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  optionBody: {
    flex: 1,
  },
  optionLabel: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  optionDesc: {
    color: theme.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#444",
    marginLeft: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#3a3a48",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    color: theme.textMuted,
    fontWeight: "700",
    fontSize: 14,
  },
  btnPrimary: {
    flex: 1.4,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: theme.player1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: "#0b1014",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
