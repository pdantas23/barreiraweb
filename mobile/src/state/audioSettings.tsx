import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type AudioSettings = {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  setMusicEnabled: (v: boolean) => void;
  setSfxEnabled: (v: boolean) => void;
};

const MUSIC_KEY = "audio_music";
const SFX_KEY = "audio_sfx";

const AudioSettingsContext = createContext<AudioSettings>({
  musicEnabled: false,
  sfxEnabled: true,
  setMusicEnabled: () => {},
  setSfxEnabled: () => {},
});

export const useAudioSettings = () => useContext(AudioSettingsContext);

export const AudioSettingsProvider = ({ children }: { children: React.ReactNode }) => {
  // Música começa desabilitada — user liga em Configurações se quiser. Se já
  // tinha ligado antes, AsyncStorage guarda "1" e o useEffect abaixo restaura.
  const [musicEnabled, setMusicState] = useState(false);
  const [sfxEnabled, setSfxState] = useState(true);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(MUSIC_KEY),
      AsyncStorage.getItem(SFX_KEY),
    ]).then(([music, sfx]) => {
      // Música: só liga se user explicitamente escolheu ("1"). Sem valor
      // salvo (primeira execução) ou "0" mantém o default off.
      if (music === "1") setMusicState(true);
      if (sfx === "0") setSfxState(false);
    });
  }, []);

  const setMusicEnabled = (v: boolean) => {
    setMusicState(v);
    AsyncStorage.setItem(MUSIC_KEY, v ? "1" : "0");
  };

  const setSfxEnabled = (v: boolean) => {
    setSfxState(v);
    AsyncStorage.setItem(SFX_KEY, v ? "1" : "0");
  };

  return (
    <AudioSettingsContext.Provider value={{ musicEnabled, sfxEnabled, setMusicEnabled, setSfxEnabled }}>
      {children}
    </AudioSettingsContext.Provider>
  );
};
