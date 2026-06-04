// === AddFriend (mobile) ===
// Input de username + envio (onAdd) com feedback. O compartilhamento por link
// (token) é tratado pelo FriendsButton, não aqui.

import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const C = { blue: "#3D6FFF", navy: "#1A2A4A", muted: "#9AAACA", white: "#FFFFFF", border: "#DDEAFF", green: "#16A34A", red: "#E04256" };

type AddResult = { ok: boolean; error?: string };

type Props = {
  onAdd: (username: string) => Promise<AddResult>;
};

export const AddFriend = ({ onAdd }: Props) => {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    const username = value.trim();
    if (!username || busy) return;
    setBusy(true);
    setFeedback(null);
    const res = await onAdd(username);
    setBusy(false);
    if (res.ok) {
      setFeedback({ ok: true, text: "Pedido enviado!" });
      setValue("");
    } else {
      setFeedback({ ok: false, text: res.error ?? "Não foi possível enviar o pedido." });
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="person-add" size={14} color={C.blue} />
        <Text style={styles.headerTitle}>ADICIONAR AMIGO</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="Username do amigo"
            value={value}
            onChangeText={setValue}
            placeholder="username"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            style={styles.input}
          />
          <Pressable
            accessibilityLabel="Adicionar amigo"
            onPress={submit}
            disabled={busy || value.trim().length === 0}
            style={[styles.addBtn, (busy || value.trim().length === 0) && { opacity: 0.5 }]}
          >
            <Text style={styles.addText}>Adicionar</Text>
          </Pressable>
        </View>
        {feedback && (
          <Text accessibilityRole="text" style={[styles.feedback, { color: feedback.ok ? C.green : C.red }]}>
            {feedback.text}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: "#F5F8FF" },
  headerTitle: { color: C.navy, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  body: { padding: 12, gap: 8 },
  inputRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: C.border, color: C.navy, fontSize: 13 },
  addBtn: { backgroundColor: C.blue, paddingHorizontal: 14, justifyContent: "center", borderRadius: 10 },
  addText: { color: C.white, fontSize: 13, fontWeight: "800" },
  feedback: { fontSize: 12, fontWeight: "700" },
});
