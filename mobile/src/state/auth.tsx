// Contexto global de auth no mobile.
//
// Espelha web/src/state/auth.tsx mas SEM signUp/signIn — esses fluxos
// rodam no site (via WebBrowser). O app só recebe a sessão pronta via
// deep link (barreira://auth?...), chama setSession() pra hidratar, e
// daí em diante usa session.access_token em socket handshakes + queries.
//
// Quando logado:
//  - session !== null
//  - username vem de user_metadata
//  - trofeusCasual vem de SELECT na tabela profiles
//
// Quando anônimo: session=null. O app ainda funciona via clientId.

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
import { getHandshakeToken, reconnectSocket } from "../net/socket";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  username: string | null;
  trofeusCasual: number | null;
  signOut: () => Promise<void>;
  /** Re-busca trofeus_casual do banco. Chamar após cada vitória casual. */
  refreshTrofeus: () => Promise<void>;
  /** Chamado pelo deep link handler com tokens vindos do site. */
  setSessionFromTokens: (params: {
    access_token: string;
    refresh_token: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [trofeusCasual, setTrofeusCasual] = useState<number | null>(null);

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
      // Reconecta o socket pra o novo handshake levar (ou não) o access_token
      // — MAS só se o token realmente mudou em relação ao do handshake atual.
      // INITIAL_SESSION/TOKEN_REFRESHED disparam em todo cold start; como o
      // auth callback do socket já lê a sessão antes do handshake, reconectar
      // à toa derrubava a 1ª RPC do lobby ("Sem conexão" falso) e podia
      // resetar uma partida. handshakeToken === undefined = socket ainda não
      // conectou → ele pega o token certo sozinho, sem reconnect.
      const newToken = sess?.access_token ?? null;
      const handshakeToken = getHandshakeToken();
      if (handshakeToken !== undefined && handshakeToken !== newToken) {
        console.log("[auth-state-change] token mudou — reconectando socket");
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

  useEffect(() => {
    void refreshTrofeus();
  }, [refreshTrofeus]);

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
  };

  const setSessionFromTokens = async ({
    access_token,
    refresh_token,
  }: {
    access_token: string;
    refresh_token: string;
  }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      console.warn("[auth] setSession falhou:", error.message);
      return { ok: false, error: error.message };
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
        signOut,
        refreshTrofeus,
        setSessionFromTokens,
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
