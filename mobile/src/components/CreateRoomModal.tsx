import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { theme } from "../theme";

export type ColorChoice = "cyan" | "random" | "red";

export type CreateRoomConfig = {
  color: ColorChoice;
  isPrivate: boolean;
  password: string | null;
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
    accent: theme.player1,
    icon: "ellipse",
  },
  {
    value: "random",
    label: "Random",
    accent: theme.textMuted,
    icon: "shuffle",
  },
  {
    value: "red",
    label: "Vermelho",
    accent: theme.player2,
    icon: "ellipse",
  },
];

// Senha mockada: 6 caracteres alfanuméricos sem confundir (sem 0/O/1/I).
const generatePassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

export const CreateRoomModal = ({ visible, onClose, onConfirm }: Props) => {
  const [color, setColor] = useState<ColorChoice>("random");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState<string>("");

  // Sempre que o modal abre OU o usuário ativa "privada", regenera a senha
  // pra dar feedback visual claro. Estrutura — lógica real ainda não plugada.
  useEffect(() => {
    if (visible) {
      setColor("random");
      setIsPrivate(false);
      setPassword(generatePassword());
    }
  }, [visible]);

  const onTogglePrivate = () => {
    setIsPrivate((p) => {
      if (!p) setPassword(generatePassword());
      return !p;
    });
  };

  const onRefreshPassword = () => setPassword(generatePassword());

  const onSubmit = () => {
    onConfirm({
      color,
      isPrivate,
      password: isPrivate ? password : null,
    });
  };

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

            {/* Checkbox privada */}
            <Pressable style={styles.privateRow} onPress={onTogglePrivate}>
              <View
                style={[
                  styles.checkbox,
                  isPrivate && { backgroundColor: theme.player1, borderColor: theme.player1 },
                ]}
              >
                {isPrivate && <Ionicons name="checkmark" size={16} color="#0b1014" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.privateLabel}>Sala privada</Text>
                <Text style={styles.privateSub}>
                  Só quem tiver a senha consegue entrar
                </Text>
              </View>
            </Pressable>

            {/* Senha gerada (estrutura) */}
            {isPrivate && (
              <View style={styles.passwordBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.passwordTag}>SENHA</Text>
                  <Text style={styles.passwordValue}>{password}</Text>
                </View>
                <Pressable onPress={onRefreshPassword} style={styles.passwordRefresh}>
                  <Ionicons name="refresh" size={18} color={theme.textMuted} />
                </Pressable>
              </View>
            )}

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
                style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
              >
                <Text style={styles.btnPrimaryText}>Criar</Text>
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
    backgroundColor: "rgba(0,0,0,0.65)",
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
  sectionLabel: {
    color: theme.textMuted,
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
    backgroundColor: "#1f1f27",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#2a2a35",
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
    color: theme.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  colorHint: {
    color: theme.textMuted,
    fontSize: 11,
    marginTop: 10,
    fontStyle: "italic",
    textAlign: "center",
  },
  privateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1f1f27",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2a35",
    padding: 14,
    marginTop: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#444",
    alignItems: "center",
    justifyContent: "center",
  },
  privateLabel: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  privateSub: {
    color: theme.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  passwordBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16161c",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a35",
    padding: 14,
    marginTop: 10,
  },
  passwordTag: {
    color: theme.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  passwordValue: {
    color: theme.player1,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 4,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  passwordRefresh: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1f1f27",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2a2a35",
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
