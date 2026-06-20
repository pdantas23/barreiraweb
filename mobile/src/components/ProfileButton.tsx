import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

type Props = {
  onPress?: () => void;
};

// Botão de perfil no canto superior direito. Sem função real ainda — só placeholder
// pra abrir tela de perfil/configurações/estatísticas no futuro.
export const ProfileButton = ({ onPress }: Props) => {
  const handlePress =
    onPress ?? (() => Alert.alert("Perfil", "Em breve 🚧"));

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel="Perfil"
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      hitSlop={10}
    >
      <View style={styles.inner}>
        <Ionicons name="person" size={20} color={theme.textPrimary} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
});
