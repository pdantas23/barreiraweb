import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { theme } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  // password é opcional — undefined quando o usuário não preencheu (sala
  // pública entrada via "Entrar com código"). String vazia também conta
  // como "não preencheu" pra não trafegar lixo até o server.
  onConfirm: (code: string, password?: string) => void;
  // Quando o user clica numa sala privada da lista, abrimos o modal com
  // o code já preenchido e bloqueado pra não confundir.
  initialCode?: string;
  lockCode?: boolean;
  // Força o campo senha a aparecer e ser obrigatório. Usado pra salas
  // privadas vindas da lista. Sem isso, senha não é exibida (sala pública).
  requirePassword?: boolean;
};

const CODE_LENGTH = 6;
const PASSWORD_LENGTH = 6;

export const JoinByCodeModal = ({
  visible,
  onClose,
  onConfirm,
  initialCode,
  lockCode = false,
  requirePassword = false,
}: Props) => {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (visible) {
      setCode(initialCode ?? "");
      setPassword("");
    }
  }, [visible, initialCode]);

  const onChangeCode = (raw: string) => {
    // Normaliza: maiúsculas, sem espaços, alfanumérico, truncado em CODE_LENGTH.
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
    setCode(cleaned);
  };

  const onChangePassword = (raw: string) => {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, PASSWORD_LENGTH);
    setPassword(cleaned);
  };

  const codeOk = code.length === CODE_LENGTH;
  const passwordOk = !requirePassword || password.length === PASSWORD_LENGTH;
  const canSubmit = codeOk && passwordOk;

  const submit = () => {
    if (!canSubmit) return;
    onConfirm(code, password.length > 0 ? password : undefined);
  };

  const title = requirePassword ? "Entrar em sala privada" : "Entrar com código";
  const subtitle = requirePassword
    ? "Essa sala é privada. Peça a senha pra quem criou."
    : `Digite o código de ${CODE_LENGTH} caracteres da sala.`;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Animated.View entering={FadeInDown.duration(340).delay(40)} style={styles.cardWrap}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            {lockCode ? (
              <View style={styles.lockedCode}>
                <Ionicons name="lock-closed" size={16} color={theme.textMuted} />
                <Text style={styles.lockedCodeText}>{code}</Text>
              </View>
            ) : (
              <>
                <TextInput
                  value={code}
                  onChangeText={onChangeCode}
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={CODE_LENGTH}
                  placeholder="ABCD12"
                  placeholderTextColor="#3a3a48"
                  style={styles.input}
                  selectionColor={theme.player1}
                />
                <View style={styles.dots}>
                  {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i < code.length && { backgroundColor: theme.player1 },
                      ]}
                    />
                  ))}
                </View>
              </>
            )}

            {requirePassword && (
              <>
                <Text style={styles.passwordLabel}>Senha</Text>
                <TextInput
                  value={password}
                  onChangeText={onChangePassword}
                  autoFocus={lockCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={PASSWORD_LENGTH}
                  placeholder="XXXXXX"
                  placeholderTextColor="#3a3a48"
                  style={styles.input}
                  selectionColor={theme.player2}
                  secureTextEntry={false}
                />
                <View style={styles.dots}>
                  {Array.from({ length: PASSWORD_LENGTH }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i < password.length && { backgroundColor: theme.player2 },
                      ]}
                    />
                  ))}
                </View>
              </>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}
              >
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  !canSubmit && styles.btnPrimaryDisabled,
                  pressed && canSubmit && styles.pressed,
                ]}
              >
                <Text style={styles.btnPrimaryText}>Entrar</Text>
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
    maxWidth: 380,
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
  input: {
    color: theme.textPrimary,
    backgroundColor: "#1f1f27",
    borderWidth: 1,
    borderColor: "#2a2a35",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  lockedCode: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#1f1f27",
    borderWidth: 1,
    borderColor: "#2a2a35",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  lockedCodeText: {
    color: theme.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 6,
    fontVariant: ["tabular-nums"],
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2a2a35",
  },
  passwordLabel: {
    color: theme.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
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
  btnPrimaryDisabled: {
    backgroundColor: "#2a2a35",
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
