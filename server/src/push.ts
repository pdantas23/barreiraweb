// === Expo Push Notifications ===
//
// Registro de tokens (tabela push_tokens) e envio via Expo Push API.
// O envio é best-effort: falha de rede nunca derruba o fluxo do socket.

import { getSupabase } from "./db.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
};

// Upsert do token (chave = token; troca de device atualiza user/plataforma).
export const upsertPushToken = async (
  userId: string,
  token: string,
  platform: "ios" | "android",
): Promise<void> => {
  const { error } = await getSupabase()
    .from("push_tokens")
    .upsert(
      { user_id: userId, token, platform, updated_at: new Date().toISOString() },
      { onConflict: "token" },
    );
  if (error) throw new Error(`push_tokens upsert: ${error.message}`);
};

// Tokens de push de um username (via profiles.user_id).
export const getPushTokensForUsername = async (
  username: string,
): Promise<string[]> => {
  const sb = getSupabase();
  const { data: prof } = await sb
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();
  if (!prof) return [];
  const { data } = await sb.from("push_tokens").select("token").eq("user_id", prof.user_id);
  return (data ?? []).map((r: { token: string }) => r.token);
};

// Envia uma leva de mensagens pro Expo (em chunks de 100). Best-effort.
export const sendExpoPush = async (messages: ExpoMessage[]): Promise<void> => {
  if (!messages.length) return;
  const chunks: ExpoMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));
  for (const chunk of chunks) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      console.warn("[push] envio falhou:", err);
    }
  }
};

// Push de convite de partida (quando o alvo está offline). Best-effort.
export const sendInvitePush = (toUsername: string, fromUsername: string): void => {
  void (async () => {
    const tokens = await getPushTokensForUsername(toUsername);
    await sendExpoPush(
      tokens.map((to) => ({
        to,
        title: "Barreira",
        body: `${fromUsername} te convidou para jogar Barreira! 🎯`,
        sound: "default",
        data: { type: "game-invite", from: fromUsername },
      })),
    );
  })();
};
