import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ProfilePayload } from "@barreira/shared";
import { getSocket } from "../net/socket";

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

export const usePlayerName = (): string => {
  const { displayName } = useProfile();
  return displayName ?? "Jogador";
};
