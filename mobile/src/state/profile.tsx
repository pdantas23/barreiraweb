// Estado global da identidade do jogador (displayName, clientId).
//
// Bootstrap em 2 fases:
// 1. Lê displayName cacheado do AsyncStorage (mostra na UI mesmo offline)
// 2. Quando o server emite `profile`, sobrescreve com o valor autoritativo
//    e re-cacheia no AsyncStorage
//
// Render rule: se displayName === null, renderiza "Jogador" como fallback
// (caso o app abra sem internet, primeira vez). Isso é raro porque a tela
// inicial vai conectar e o profile chega em ~200ms.

import AsyncStorage from "@react-native-async-storage/async-storage";
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
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    // 1) Bootstrap do cache local — render imediato sem esperar server
    AsyncStorage.getItem(STORAGE_KEY)
      .then((cached) => {
        if (cached) setDisplayName(cached);
      })
      .catch(() => {
        // Cache miss / erro de leitura — segue sem fallback
      });

    // 2) Listener do server — atualiza quando chegar `profile`
    const socket = getSocket();
    const onProfile = (payload: ProfilePayload) => {
      setDisplayName(payload.displayName);
      AsyncStorage.setItem(STORAGE_KEY, payload.displayName).catch(() => {});
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

// Prioridade do nome exibido (igual ao web):
//   1. username escolhido no cadastro (se logado)
//   2. displayName anônimo gerado pelo server (anonimoXXXX)
//   3. "Jogador" como fallback enquanto o profile não respondeu
// Sem o username aqui, a sala mostrava o nome anônimo mesmo pro usuário logado.
export const usePlayerName = (): string => {
  const { username } = useAuth();
  const { displayName } = useProfile();
  return username ?? displayName ?? "Jogador";
};
