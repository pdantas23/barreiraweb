import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Flag "já passou pelo tutorial" — por DISPOSITIVO (espelha o padrão de
// audioSettings.tsx). Reinstalar/trocar de aparelho mostra de novo, e isso é
// aceito (decisão de produto). Cobre anônimo e logado sem backend.
const TUTORIAL_KEY = "tutorial_seen";

type TutorialContextValue = {
  /** true = o usuário já concluiu OU pulou o tutorial alguma vez neste aparelho. */
  seen: boolean;
  /** true enquanto o AsyncStorage não respondeu — evita piscar o tutorial. */
  loading: boolean;
  /** Marca como visto e persiste. Idempotente. */
  markSeen: () => void;
};

const TutorialContext = createContext<TutorialContextValue>({
  seen: false,
  loading: true,
  markSeen: () => {},
});

export const useTutorial = () => useContext(TutorialContext);

/**
 * Decisão pura: deve abrir o tutorial agora? Só quando o storage já resolveu
 * (não loading) e o usuário ainda não viu. Fica fora do provider de propósito
 * pra ser testável sem renderizar React.
 */
export const shouldShowTutorial = (seen: boolean, loading: boolean): boolean =>
  !loading && !seen;

export const TutorialProvider = ({ children }: { children: React.ReactNode }) => {
  const [seen, setSeen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(TUTORIAL_KEY)
      .then((v) => {
        if (!cancelled && v === "1") setSeen(true);
      })
      .catch(() => {
        // Storage indisponível: trata como "não viu" (mostra o tutorial). O pior
        // caso é repetir pra quem já viu — nunca pular pra quem nunca viu.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = () => {
    setSeen(true);
    void AsyncStorage.setItem(TUTORIAL_KEY, "1").catch(() => {});
  };

  return (
    <TutorialContext.Provider value={{ seen, loading, markSeen }}>
      {children}
    </TutorialContext.Provider>
  );
};
