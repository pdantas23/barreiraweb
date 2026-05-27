// === Contexto global de autenticacao ===
//
// Encapsula o estado do Supabase Auth e expoe API simples pros componentes.
//
// Como funciona:
//  - No mount, le sessao persistida no localStorage (Supabase cuida)
//  - Inscreve em onAuthStateChange pra reagir a login/logout/refresh
//  - Expoe user/session + signUp/signIn/signOut
//
// O username e os termos vao em user_metadata (JSON livre do Supabase Auth).
// Quando o sistema migrar pra tabela `players` (futuro), espelhar de la.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../net/supabase";
import { reconnectSocket } from "../net/socket";

type AuthState = {
  /** Sessao ativa do Supabase (com access_token JWT) ou null se anonimo */
  session: Session | null;
  /** Usuario logado ou null */
  user: User | null;
  /** True enquanto carrega a sessao inicial do localStorage */
  loading: boolean;
  /** Username escolhido no cadastro (vem do user_metadata) */
  username: string | null;
  /** Trofeus_casual do user logado. null = anonimo ou ainda carregando. */
  trofeusCasual: number | null;

  signUp: (params: SignUpParams) => Promise<SignUpResult>;
  signIn: (params: SignInParams) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  /** Re-busca trofeus_casual do banco. Chamar apos cada vitoria casual. */
  refreshTrofeus: () => Promise<void>;
  /** Envia email com link para resetar senha (redireciona pra /reset-password). */
  sendPasswordReset: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Troca a senha do user logado. Chamado pela tela /reset-password depois do link. */
  updatePassword: (newPassword: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

type SignUpParams = {
  username: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
};
type SignUpResult = { ok: true } | { ok: false; error: string };

type SignInParams = { emailOrUsername: string; password: string };
type SignInResult = { ok: true } | { ok: false; error: string };

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [trofeusCasual, setTrofeusCasual] = useState<number | null>(null);

  // Bootstrap inicial: le sessao persistida (sync no localStorage)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      console.log("[auth-state-change]", {
        event,
        hasSession: !!sess,
        userId: sess?.user?.id ?? null,
      });
      setSession(sess);
      // Login/logout/refresh muda o JWT que o socket usa pra premiar
      // trofeus. Re-conecta pra o server receber o token atualizado.
      //
      // INITIAL_SESSION é crítico: dispara quando o SDK termina de carregar
      // a sessão persistida no localStorage. Se o socket já tinha conectado
      // antes disso (race comum em cold start), o handshake foi feito como
      // anônimo — sem reconnect aqui, o user fica "anônimo" pro server até
      // o próximo SIGNED_IN/TOKEN_REFRESHED, e a guarda de self-match falha.
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "INITIAL_SESSION"
      ) {
        reconnectSocket();
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;

  const refreshTrofeus = useCallback(async (): Promise<void> => {
    if (!userId) {
      setTrofeusCasual(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("trofeus_casual")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[auth] refreshTrofeus falhou:", error.message);
      return;
    }
    setTrofeusCasual((data?.trofeus_casual as number | undefined) ?? 0);
  }, [userId]);

  // Carrega trofeus sempre que o user muda (login, logout, refresh)
  useEffect(() => {
    void refreshTrofeus();
  }, [refreshTrofeus]);

  const signUp = async ({
    username,
    email,
    password,
    acceptedTerms,
  }: SignUpParams): Promise<SignUpResult> => {
    if (!acceptedTerms) {
      return { ok: false, error: "Voce precisa aceitar os termos e a politica de privacidade." };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // user_metadata fica em raw_user_meta_data no banco;
        // acessivel via session.user.user_metadata depois.
        data: {
          username: username.trim(),
          accepted_terms_at: new Date().toISOString(),
        },
      },
    });
    if (error) {
      return { ok: false, error: translateError(error.message) };
    }
    return { ok: true };
  };

  const signIn = async ({
    emailOrUsername,
    password,
  }: SignInParams): Promise<SignInResult> => {
    const input = emailOrUsername.trim();
    let email = input;

    // Se nao parece email, assume que e username e traduz via RPC
    if (!input.includes("@")) {
      const { data, error } = await supabase.rpc("email_from_username", {
        p_username: input,
      });
      if (error) {
        return { ok: false, error: "Erro ao buscar usuario. Tenta de novo." };
      }
      if (!data) {
        return { ok: false, error: "Username nao encontrado." };
      }
      email = data as string;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, error: translateError(error.message) };
    }
    return { ok: true };
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  const sendPasswordReset = async (
    email: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const input = email.trim();
    if (!input) return { ok: false, error: "Informe seu email." };
    const { error } = await supabase.auth.resetPasswordForEmail(input, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      return { ok: false, error: translateError(error.message) };
    }
    return { ok: true };
  };

  const updatePassword = async (
    newPassword: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (newPassword.length < 6) {
      return { ok: false, error: "A senha precisa ter pelo menos 6 caracteres." };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { ok: false, error: translateError(error.message) };
    }
    return { ok: true };
  };

  const user = session?.user ?? null;
  const username = (user?.user_metadata?.username as string | undefined) ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        username,
        trofeusCasual,
        signUp,
        signIn,
        signOut,
        refreshTrofeus,
        sendPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  }
  return ctx;
};

// Mensagens do Supabase vem em ingles; traduz as mais comuns.
const translateError = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou senha incorretos.";
  if (m.includes("user already registered")) return "Esse email ja esta cadastrado.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("unable to validate email")) return "Email invalido.";
  if (m.includes("email rate limit")) return "Muitas tentativas. Tenta de novo em alguns minutos.";
  return msg;
};
