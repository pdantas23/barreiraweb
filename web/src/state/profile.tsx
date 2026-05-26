import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ProfilePayload } from "@barreira/shared";
import { getSocket } from "../net/socket";
import { useAuth } from "./auth";

const STORAGE_KEY = "barreira.displayName";

type ProfileState = {
  displayName: string | null;
};

const ProfileContext = createContext<ProfileState>({ displayName: null });

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [displayName, setDisplayName] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );

  useEffect(() => {
    const socket = getSocket();
    const onProfile = (payload: ProfilePayload) => {
      setDisplayName(payload.displayName);
      localStorage.setItem(STORAGE_KEY, payload.displayName);
    };
    socket.on("profile", onProfile);
    return () => {
      socket.off("profile", onProfile);
    };
  }, []);

  return (
    <ProfileContext.Provider value={{ displayName }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = (): ProfileState => useContext(ProfileContext);

// Prioridade de nome exibido pro oponente:
//   1. username escolhido no cadastro (se logado)
//   2. displayName anonimo gerado pelo server (anonimoXXXX)
//   3. "Jogador" como fallback caso o Supabase de profile ainda nao tenha respondido
export const usePlayerName = (): string => {
  const { username } = useAuth();
  const { displayName } = useProfile();
  return username ?? displayName ?? "Jogador";
};
