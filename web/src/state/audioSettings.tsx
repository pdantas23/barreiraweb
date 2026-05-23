import React, { createContext, useContext, useState } from "react";

type AudioSettings = {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  setMusicEnabled: (v: boolean) => void;
  setSfxEnabled: (v: boolean) => void;
};

const MUSIC_KEY = "audio_music";
const SFX_KEY = "audio_sfx";

const AudioSettingsContext = createContext<AudioSettings>({
  musicEnabled: true,
  sfxEnabled: true,
  setMusicEnabled: () => {},
  setSfxEnabled: () => {},
});

export const useAudioSettings = () => useContext(AudioSettingsContext);

export const AudioSettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [musicEnabled, setMusicState] = useState(() => localStorage.getItem(MUSIC_KEY) !== "0");
  const [sfxEnabled, setSfxState] = useState(() => localStorage.getItem(SFX_KEY) !== "0");

  const setMusicEnabled = (v: boolean) => {
    setMusicState(v);
    localStorage.setItem(MUSIC_KEY, v ? "1" : "0");
  };

  const setSfxEnabled = (v: boolean) => {
    setSfxState(v);
    localStorage.setItem(SFX_KEY, v ? "1" : "0");
  };

  return (
    <AudioSettingsContext.Provider value={{ musicEnabled, sfxEnabled, setMusicEnabled, setSfxEnabled }}>
      {children}
    </AudioSettingsContext.Provider>
  );
};
